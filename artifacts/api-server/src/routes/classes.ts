import { Router } from "express";
import { eq, inArray, and } from "drizzle-orm";
import { db, classesTable, coursesTable, instructorsTable, instructorClassesTable } from "@workspace/db";
import { requireAuth, requireAdminOrStaff, requireAdmin, getSessionUser } from "../middlewares/auth";

const router = Router();

// GET /classes
router.get("/classes", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { courseId, instructorId } = req.query as Record<string, string>;

  // Instructors see only their assigned classes
  if (session.role === "instructor" && session.instructorId) {
    const assigned = await db
      .select({ classId: instructorClassesTable.classId })
      .from(instructorClassesTable)
      .where(eq(instructorClassesTable.instructorId, session.instructorId));
    const classIds = assigned.map(a => a.classId);
    if (classIds.length === 0) return res.json([]);
    const rows = await db
      .select()
      .from(classesTable)
      .where(inArray(classesTable.id, classIds))
      .orderBy(classesTable.year, classesTable.className);
    return res.json(rows.map(toClass));
  }

  let rows = await db
    .select()
    .from(classesTable)
    .orderBy(classesTable.year, classesTable.className);

  if (courseId) rows = rows.filter((r) => r.courseId === Number(courseId));
  if (instructorId) {
    // Filter by instructor assignment via junction table
    const assigned = await db
      .select({ classId: instructorClassesTable.classId })
      .from(instructorClassesTable)
      .where(eq(instructorClassesTable.instructorId, Number(instructorId)));
    const classIds = new Set(assigned.map(a => a.classId));
    rows = rows.filter(r => classIds.has(r.id) || r.instructorId === Number(instructorId));
  }

  return res.json(rows.map(toClass));
});

// POST /classes — admin or staff
router.post("/classes", requireAdminOrStaff, async (req, res) => {
  const { className, courseId, instructorId, batch, year, section, semester } = req.body;
  if (!className || !courseId || !year) {
    return res.status(400).json({ error: "className, courseId, and year are required" });
  }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, Number(courseId)));
  if (!course) return res.status(400).json({ error: "Course not found" });

  let instructorName: string | undefined;
  if (instructorId) {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, Number(instructorId)));
    instructorName = instructor?.name;
  }

  const [cls] = await db.insert(classesTable).values({
    className: String(className).trim(),
    courseId: Number(courseId),
    courseName: course.name,
    instructorId: instructorId ? Number(instructorId) : null,
    instructorName: instructorName ?? null,
    batch: batch ? String(batch).trim() : null,
    year: Number(year),
    section: section ? String(section).trim() : null,
    semester: semester ? Number(semester) : null,
  }).returning();

  // Also add to instructor_classes junction table
  if (instructorId) {
    await db.insert(instructorClassesTable)
      .values({ instructorId: Number(instructorId), classId: cls.id })
      .onConflictDoNothing();
  }

  return res.status(201).json(toClass(cls));
});

// PUT /classes/:id — admin or staff
router.put("/classes/:id", requireAdminOrStaff, async (req, res) => {
  const id = Number(req.params.id);
  const { className, instructorId, batch, section, semester } = req.body;
  const update: Partial<typeof classesTable.$inferInsert> = {};
  if (className !== undefined) update.className = String(className).trim();
  if (batch !== undefined) update.batch = batch ? String(batch).trim() : null;
  if (section !== undefined) update.section = section ? String(section).trim() : null;
  if (semester !== undefined) update.semester = semester ? Number(semester) : null;

  const [existing] = await db.select().from(classesTable).where(eq(classesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Class not found" });

  if (instructorId !== undefined) {
    update.instructorId = instructorId ? Number(instructorId) : null;
    if (instructorId) {
      const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, Number(instructorId)));
      update.instructorName = instructor?.name ?? null;
      // Update junction table: remove old primary instructor, add new one
      if (existing.instructorId && existing.instructorId !== Number(instructorId)) {
        await db.delete(instructorClassesTable)
          .where(eq(instructorClassesTable.instructorId, existing.instructorId));
      }
      await db.insert(instructorClassesTable)
        .values({ instructorId: Number(instructorId), classId: id })
        .onConflictDoNothing();
    } else {
      update.instructorName = null;
    }
  }

  const [updated] = await db.update(classesTable).set(update).where(eq(classesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Class not found" });
  return res.json(toClass(updated));
});

// DELETE /classes/:id — admin only
router.delete("/classes/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(classesTable).where(eq(classesTable.id, id));
  return res.status(204).send();
});

// GET /classes/:id/instructors — list all instructors assigned to a class with subjects
router.get("/classes/:id/instructors", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db
    .select({ ic: instructorClassesTable, inst: instructorsTable })
    .from(instructorClassesTable)
    .innerJoin(instructorsTable, eq(instructorClassesTable.instructorId, instructorsTable.id))
    .where(eq(instructorClassesTable.classId, id));
  return res.json(rows.map(r => ({
    id: r.ic.id,
    instructorId: r.inst.id,
    instructorName: r.inst.name,
    subject: r.ic.subject ?? null,
  })));
});

// POST /classes/:id/instructors — assign instructor to class with subject
router.post("/classes/:id/instructors", requireAdminOrStaff, async (req, res) => {
  const classId = Number(req.params.id);
  const { instructorId, subject } = req.body;
  if (!instructorId) return res.status(400).json({ error: "instructorId is required" });

  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, Number(instructorId)));
  if (!instructor) return res.status(404).json({ error: "Instructor not found" });

  await db.insert(instructorClassesTable)
    .values({ instructorId: Number(instructorId), classId, subject: subject ? String(subject).trim() : null })
    .onConflictDoNothing();

  // If no primary instructor set yet, set this one
  if (!cls.instructorId) {
    await db.update(classesTable).set({ instructorId: instructor.id, instructorName: instructor.name }).where(eq(classesTable.id, classId));
  }

  const rows = await db
    .select({ ic: instructorClassesTable, inst: instructorsTable })
    .from(instructorClassesTable)
    .innerJoin(instructorsTable, eq(instructorClassesTable.instructorId, instructorsTable.id))
    .where(eq(instructorClassesTable.classId, classId));
  return res.status(201).json(rows.map(r => ({
    id: r.ic.id,
    instructorId: r.inst.id,
    instructorName: r.inst.name,
    subject: r.ic.subject ?? null,
  })));
});

// DELETE /classes/:id/instructors/:instructorId — remove instructor from class
router.delete("/classes/:id/instructors/:instructorId", requireAdminOrStaff, async (req, res) => {
  const classId = Number(req.params.id);
  const instructorId = Number(req.params.instructorId);
  await db.delete(instructorClassesTable)
    .where(and(eq(instructorClassesTable.classId, classId), eq(instructorClassesTable.instructorId, instructorId)));
  return res.status(204).send();
});

function toClass(c: typeof classesTable.$inferSelect) {
  return {
    id: c.id,
    className: c.className,
    courseId: c.courseId,
    courseName: c.courseName,
    instructorId: c.instructorId ?? undefined,
    instructorName: c.instructorName ?? undefined,
    batch: c.batch ?? undefined,
    year: c.year,
    section: c.section ?? undefined,
    semester: c.semester ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
