import { Router } from "express";
import { db } from "@workspace/db";
import { interneeAttendanceTable, interneesTable, dailyReportsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireStaff(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "staff"].includes((req.session as any).role ?? "")) return res.status(403).json({ error: "Forbidden" });
  next();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function timeStr() {
  return new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

// GET attendance for an internee
router.get("/internees/:id/attendance", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const records = await db.select().from(interneeAttendanceTable)
    .where(eq(interneeAttendanceTable.interneeId, id))
    .orderBy(desc(interneeAttendanceTable.attendanceDate));
  res.json(records);
});

// GET all attendance (admin/staff)
router.get("/internee-attendance", requireStaff, async (req, res) => {
  const records = await db.select().from(interneeAttendanceTable)
    .orderBy(desc(interneeAttendanceTable.attendanceDate));
  res.json(records);
});

// POST check-in
router.post("/internees/:id/checkin", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = (req.session as any).role;
  const sessionInterneeId = (req.session as any).interneeId;
  if (role === "internee" && sessionInterneeId !== id) return res.status(403).json({ error: "Forbidden" });

  const today = todayStr();
  const existing = await db.select().from(interneeAttendanceTable)
    .where(and(eq(interneeAttendanceTable.interneeId, id), eq(interneeAttendanceTable.attendanceDate, today)));

  if (existing.length > 0) return res.status(400).json({ error: "Already checked in today" });

  const [intern] = await db.select().from(interneesTable).where(eq(interneesTable.id, id));
  if (!intern) return res.status(404).json({ error: "Internee not found" });

  const [created] = await db.insert(interneeAttendanceTable).values({
    interneeId: id,
    interneeName: intern.name,
    attendanceDate: today,
    checkInTime: timeStr(),
    status: "present",
    dailyReportSubmitted: false,
  }).returning();
  res.status(201).json(created);
});

// POST check-out
router.post("/internees/:id/checkout", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = (req.session as any).role;
  const sessionInterneeId = (req.session as any).interneeId;
  if (role === "internee" && sessionInterneeId !== id) return res.status(403).json({ error: "Forbidden" });

  const today = todayStr();
  const [record] = await db.select().from(interneeAttendanceTable)
    .where(and(eq(interneeAttendanceTable.interneeId, id), eq(interneeAttendanceTable.attendanceDate, today)));

  if (!record) return res.status(400).json({ error: "Not checked in today" });
  if (record.checkOutTime) return res.status(400).json({ error: "Already checked out" });

  // Check if daily report submitted for today
  const reports = await db.select().from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.interneeId, id), eq(dailyReportsTable.reportDate, today)));
  if (reports.length === 0) return res.status(400).json({ error: "Please submit today's daily report before checking out" });

  // Compute total hours
  const checkInParts = record.checkInTime?.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
  let totalHours = null;
  if (checkInParts) {
    let h = Number(checkInParts[1]);
    const m = Number(checkInParts[2]);
    const s = Number(checkInParts[3]);
    if (checkInParts[4].toUpperCase() === "PM" && h !== 12) h += 12;
    if (checkInParts[4].toUpperCase() === "AM" && h === 12) h = 0;
    const inMinutes = h * 60 + m + s / 60;
    const now = new Date();
    const outMinutes = now.getHours() * 60 + now.getMinutes();
    totalHours = String(((outMinutes - inMinutes) / 60).toFixed(2));
  }

  const [updated] = await db.update(interneeAttendanceTable)
    .set({ checkOutTime: timeStr(), totalHours, dailyReportSubmitted: true })
    .where(eq(interneeAttendanceTable.id, record.id))
    .returning();
  res.json(updated);
});

// DELETE attendance record (admin only)
router.delete("/internee-attendance/:id", requireStaff, async (req, res) => {
  await db.delete(interneeAttendanceTable).where(eq(interneeAttendanceTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
