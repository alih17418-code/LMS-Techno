import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, classesTable, coursesTable, instructorsTable } from "@workspace/db";

const router = Router();

// GET /classes
router.get("/classes", async (req, res) => {
  const { courseId, instructorId } = req.query as Record<string, string>;

  let rows = await db
    .select()
    .from(classesTable)
    .orderBy(classesTable.year, classesTable.className);

  if (courseId) rows = rows.filter((r) => r.courseId === Number(courseId));
  if (instructorId) rows = rows.filter((r) => r.instructorId === Number(instructorId));

  return res.json(rows.map(toClass));
});

// POST /classes
router.post("/classes", async (req, res) => {
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

  return res.status(201).json(toClass(cls));
});

// PUT /classes/:id
router.put("/classes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { className, instructorId, batch, section, semester } = req.body;
  const update: Partial<typeof classesTable.$inferInsert> = {};
  if (className !== undefined) update.className = String(className).trim();
  if (batch !== undefined) update.batch = batch ? String(batch).trim() : null;
  if (section !== undefined) update.section = section ? String(section).trim() : null;
  if (semester !== undefined) update.semester = semester ? Number(semester) : null;
  if (instructorId !== undefined) {
    update.instructorId = instructorId ? Number(instructorId) : null;
    if (instructorId) {
      const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, Number(instructorId)));
      update.instructorName = instructor?.name ?? null;
    } else {
      update.instructorName = null;
    }
  }

  const [updated] = await db.update(classesTable).set(update).where(eq(classesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Class not found" });
  return res.json(toClass(updated));
});

// DELETE /classes/:id
router.delete("/classes/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(classesTable).where(eq(classesTable.id, id));
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
