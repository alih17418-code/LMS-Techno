import { Router } from "express";
import { db } from "@workspace/db";
import { interneesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

function requireStaff(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "staff"].includes(req.session.role ?? "")) return res.status(403).json({ error: "Forbidden" });
  next();
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function generateCode(id: number) {
  const year = new Date().getFullYear();
  return `INT-${year}-${String(id).padStart(4, "0")}`;
}

// GET all internees
router.get("/internees", requireStaff, async (req, res) => {
  const list = await db.select().from(interneesTable).orderBy(desc(interneesTable.createdAt));
  res.json(list);
});

// GET single internee (admin/staff OR the internee themselves)
router.get("/internees/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = (req.session as any).role;
  const interneeId = (req.session as any).interneeId;
  if (!["admin", "staff"].includes(role) && interneeId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [row] = await db.select().from(interneesTable).where(eq(interneesTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// POST create internee
router.post("/internees", requireStaff, async (req, res) => {
  const { name, fatherName, email, phone, address, department, position, startDate, endDate,
    attendanceMode, requiredHours, fixedStartTime, fixedEndTime, notes } = req.body;
  if (!name || !startDate) return res.status(400).json({ error: "Name and start date are required" });
  // Insert with placeholder code, update after
  const [created] = await db.insert(interneesTable).values({
    interneeCode: "TEMP",
    name, fatherName: fatherName || null, email: email || null, phone: phone || null,
    address: address || null, department: department || null, position: position || null,
    startDate, endDate: endDate || null, status: "active",
    attendanceMode: attendanceMode || "hourly",
    requiredHours: requiredHours ?? "5",
    fixedStartTime: fixedStartTime || null, fixedEndTime: fixedEndTime || null,
    notes: notes || null,
  }).returning();
  const code = generateCode(created.id);
  const [updated] = await db.update(interneesTable).set({ interneeCode: code }).where(eq(interneesTable.id, created.id)).returning();
  res.status(201).json(updated);
});

// PATCH update internee
router.patch("/internees/:id", requireStaff, async (req, res) => {
  const id = Number(req.params.id);
  const { name, fatherName, email, phone, address, department, position, startDate, endDate,
    status, attendanceMode, requiredHours, fixedStartTime, fixedEndTime, notes } = req.body;
  const [updated] = await db.update(interneesTable).set({
    ...(name !== undefined && { name }),
    ...(fatherName !== undefined && { fatherName }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
    ...(address !== undefined && { address }),
    ...(department !== undefined && { department }),
    ...(position !== undefined && { position }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(status !== undefined && { status }),
    ...(attendanceMode !== undefined && { attendanceMode }),
    ...(requiredHours !== undefined && { requiredHours }),
    ...(fixedStartTime !== undefined && { fixedStartTime }),
    ...(fixedEndTime !== undefined && { fixedEndTime }),
    ...(notes !== undefined && { notes }),
  }).where(eq(interneesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// DELETE internee
router.delete("/internees/:id", requireStaff, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(interneesTable).where(eq(interneesTable.id, id));
  res.json({ ok: true });
});

export default router;
