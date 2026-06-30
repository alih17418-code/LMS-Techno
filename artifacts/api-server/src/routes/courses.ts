import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, coursesTable, studentsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// GET /courses
router.get("/courses", async (_req, res) => {
  const rows = await db.select().from(coursesTable).orderBy(coursesTable.name);
  return res.json(rows.map(toCourseResponse));
});

// POST /courses
router.post("/courses", async (req, res) => {
  const { name, code, category, durationMonths, monthlyFee, description } = req.body;
  if (!name || !code || !durationMonths || !monthlyFee) {
    return res.status(400).json({ error: "validation_error", message: "name, code, durationMonths, and monthlyFee are required" });
  }

  const trimmedName = String(name).trim();
  const upperCode = String(code).toUpperCase().trim();

  const [byCode] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.code, upperCode));
  if (byCode) return res.status(400).json({ error: "duplicate_code", message: `Course code '${upperCode}' already exists` });

  const [byName] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.name, trimmedName));
  if (byName) return res.status(400).json({ error: "duplicate_name", message: `A course named '${trimmedName}' already exists` });

  try {
    const [created] = await db
      .insert(coursesTable)
      .values({
        name: trimmedName,
        code: upperCode,
        category: category === "major" ? "major" : "other",
        durationMonths: Number(durationMonths),
        monthlyFee: String(monthlyFee),
        description: description || null,
      })
      .returning();
    return res.status(201).json(toCourseResponse(created));
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ error: "duplicate", message: "A course with that name or code already exists" });
    }
    throw err;
  }
});

// GET /courses/:id
router.get("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "bad_request", message: "Invalid ID" });

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
  if (!course) return res.status(404).json({ error: "not_found", message: "Course not found" });

  return res.json(toCourseResponse(course));
});

// PUT /courses/:id
router.put("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "bad_request", message: "Invalid ID" });

  const [existing] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Course not found" });

  const updateData: Partial<typeof coursesTable.$inferInsert> = {};
  if (req.body.name !== undefined) updateData.name = String(req.body.name).trim();
  if (req.body.code !== undefined) updateData.code = String(req.body.code).toUpperCase().trim();
  if (req.body.category !== undefined) updateData.category = req.body.category === "major" ? "major" : "other";
  if (req.body.durationMonths !== undefined) updateData.durationMonths = Number(req.body.durationMonths);
  if (req.body.monthlyFee !== undefined) updateData.monthlyFee = String(req.body.monthlyFee);
  if (req.body.description !== undefined) updateData.description = req.body.description || null;

  try {
    const [updated] = await db
      .update(coursesTable)
      .set(updateData)
      .where(eq(coursesTable.id, id))
      .returning();
    return res.json(toCourseResponse(updated));
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ error: "duplicate", message: "A course with that name or code already exists" });
    }
    throw err;
  }
});

// DELETE /courses/:id
router.delete("/courses/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "bad_request", message: "Invalid ID" });

  const students = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.courseId, id))
    .limit(1);

  if (students.length > 0) {
    return res.status(400).json({
      error: "has_students",
      message: "Cannot delete a course that has enrolled students. Move or remove students first.",
    });
  }

  await db.delete(coursesTable).where(eq(coursesTable.id, id));
  return res.status(204).send();
});

export function toCourseResponse(c: typeof coursesTable.$inferSelect) {
  const fee = parseFloat(c.monthlyFee as string);
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    category: c.category,
    durationMonths: c.durationMonths,
    monthlyFee: fee,
    totalFee: fee * c.durationMonths,
    description: c.description ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
