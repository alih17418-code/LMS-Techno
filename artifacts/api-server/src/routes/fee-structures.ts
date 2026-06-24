import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, feeStructuresTable } from "@workspace/db";
import {
  CreateFeeStructureBody,
  UpdateFeeStructureParams,
  UpdateFeeStructureBody,
  DeleteFeeStructureParams,
} from "@workspace/api-zod";

const router = Router();

// GET /fee-structures
router.get("/fee-structures", async (_req, res) => {
  const rows = await db.select().from(feeStructuresTable).orderBy(feeStructuresTable.course);
  return res.json(rows.map(toFeeStructureResponse));
});

// POST /fee-structures
router.post("/fee-structures", async (req, res) => {
  const parsed = CreateFeeStructureBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", message: parsed.error.message });
  }

  // Upsert: if course already exists, update it
  const existing = await db
    .select()
    .from(feeStructuresTable)
    .where(eq(feeStructuresTable.course, parsed.data.course));

  if (existing.length > 0) {
    const [updated] = await db
      .update(feeStructuresTable)
      .set({
        monthlyFee: String(parsed.data.monthlyFee),
        description: parsed.data.description,
      })
      .where(eq(feeStructuresTable.course, parsed.data.course))
      .returning();
    return res.status(201).json(toFeeStructureResponse(updated));
  }

  const [created] = await db
    .insert(feeStructuresTable)
    .values({
      course: parsed.data.course,
      monthlyFee: String(parsed.data.monthlyFee),
      description: parsed.data.description,
    })
    .returning();

  return res.status(201).json(toFeeStructureResponse(created));
});

// PUT /fee-structures/:id
router.put("/fee-structures/:id", async (req, res) => {
  const paramsParsed = UpdateFeeStructureParams.safeParse(req.params);
  if (!paramsParsed.success) return res.status(400).json({ error: "bad_request", message: "Invalid ID" });

  const bodyParsed = UpdateFeeStructureBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "validation_error", message: bodyParsed.error.message });
  }

  const [existing] = await db
    .select()
    .from(feeStructuresTable)
    .where(eq(feeStructuresTable.id, paramsParsed.data.id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Fee structure not found" });

  const updateData: Partial<typeof feeStructuresTable.$inferInsert> = {};
  if (bodyParsed.data.course !== undefined) updateData.course = bodyParsed.data.course;
  if (bodyParsed.data.monthlyFee !== undefined) updateData.monthlyFee = String(bodyParsed.data.monthlyFee);
  if (bodyParsed.data.description !== undefined) updateData.description = bodyParsed.data.description;

  const [updated] = await db
    .update(feeStructuresTable)
    .set(updateData)
    .where(eq(feeStructuresTable.id, paramsParsed.data.id))
    .returning();

  return res.json(toFeeStructureResponse(updated));
});

// DELETE /fee-structures/:id
router.delete("/fee-structures/:id", async (req, res) => {
  const parsed = DeleteFeeStructureParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "bad_request", message: "Invalid ID" });

  await db.delete(feeStructuresTable).where(eq(feeStructuresTable.id, parsed.data.id));
  return res.status(204).send();
});

function toFeeStructureResponse(f: typeof feeStructuresTable.$inferSelect) {
  return {
    id: f.id,
    course: f.course,
    monthlyFee: parseFloat(f.monthlyFee as string),
    description: f.description ?? undefined,
    createdAt: f.createdAt.toISOString(),
  };
}

export default router;
