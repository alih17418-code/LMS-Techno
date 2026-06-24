import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, instructorAttendanceTable, instructorsTable, classesTable } from "@workspace/db";

const router = Router();

// GET /attendance
router.get("/attendance", async (req, res) => {
  const { instructorId, classId, date } = req.query as Record<string, string>;

  let rows = await db
    .select()
    .from(instructorAttendanceTable)
    .orderBy(desc(instructorAttendanceTable.attendanceDate), instructorAttendanceTable.checkInTime);

  if (instructorId) rows = rows.filter((r) => r.instructorId === Number(instructorId));
  if (classId) rows = rows.filter((r) => r.classId === Number(classId));
  if (date) rows = rows.filter((r) => r.attendanceDate === date);

  return res.json(rows.map(toAttendance));
});

// POST /attendance/checkin
router.post("/attendance/checkin", async (req, res) => {
  const { instructorId, classId, attendanceDate, checkInTime, remarks } = req.body;
  if (!instructorId || !checkInTime) {
    return res.status(400).json({ error: "instructorId and checkInTime are required" });
  }

  const [instructor] = await db
    .select()
    .from(instructorsTable)
    .where(eq(instructorsTable.id, Number(instructorId)));
  if (!instructor) return res.status(404).json({ error: "Instructor not found" });

  const today = attendanceDate ?? new Date().toISOString().slice(0, 10);

  // Check duplicate
  const [existing] = await db
    .select()
    .from(instructorAttendanceTable)
    .where(and(
      eq(instructorAttendanceTable.instructorId, Number(instructorId)),
      eq(instructorAttendanceTable.attendanceDate, today),
      ...(classId ? [eq(instructorAttendanceTable.classId, Number(classId))] : []),
    ));
  if (existing) {
    return res.status(400).json({ error: "Check-in already recorded for this date", existingId: existing.id });
  }

  let className: string | undefined;
  if (classId) {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, Number(classId)));
    className = cls?.className;
  }

  const [record] = await db.insert(instructorAttendanceTable).values({
    instructorId: Number(instructorId),
    instructorName: instructor.name,
    classId: classId ? Number(classId) : null,
    className: className ?? null,
    attendanceDate: today,
    checkInTime: String(checkInTime),
    status: "present",
    remarks: remarks ?? null,
  }).returning();

  return res.status(201).json(toAttendance(record));
});

// PUT /attendance/:id/checkout
router.put("/attendance/:id/checkout", async (req, res) => {
  const id = Number(req.params.id);
  const { checkOutTime } = req.body;
  if (!checkOutTime) return res.status(400).json({ error: "checkOutTime required" });

  const [updated] = await db
    .update(instructorAttendanceTable)
    .set({ checkOutTime: String(checkOutTime) })
    .where(eq(instructorAttendanceTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Record not found" });
  return res.json(toAttendance(updated));
});

// DELETE /attendance/:id
router.delete("/attendance/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(instructorAttendanceTable).where(eq(instructorAttendanceTable.id, id));
  return res.status(204).send();
});

// GET /attendance/stats/:instructorId — lecture count for payments
router.get("/attendance/stats/:instructorId", async (req, res) => {
  const instructorId = Number(req.params.instructorId);
  const { month, year } = req.query as Record<string, string>;

  let records = await db
    .select()
    .from(instructorAttendanceTable)
    .where(eq(instructorAttendanceTable.instructorId, instructorId));

  if (month && year) {
    records = records.filter((r) => {
      const d = new Date(r.attendanceDate);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    });
  }

  const lectureCount = records.filter((r) => r.status === "present").length;
  const ratePerLecture = 150;
  return res.json({ instructorId, lectureCount, ratePerLecture, earnings: lectureCount * ratePerLecture, records: records.map(toAttendance) });
});

function toAttendance(r: typeof instructorAttendanceTable.$inferSelect) {
  return {
    id: r.id,
    instructorId: r.instructorId,
    instructorName: r.instructorName,
    classId: r.classId ?? undefined,
    className: r.className ?? undefined,
    attendanceDate: r.attendanceDate,
    checkInTime: r.checkInTime,
    checkOutTime: r.checkOutTime ?? undefined,
    status: r.status,
    remarks: r.remarks ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
