import { Router } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, instructorAttendanceTable, instructorsTable, classesTable, studentAttendanceTable, studentsTable, instructorClassesTable } from "@workspace/db";
import { requireAuth, requireAdmin, requireAdminOrStaff, getSessionUser } from "../middlewares/auth";

const router = Router();

// ── Instructor Attendance ──────────────────────────────────────────────────

// GET /attendance
router.get("/attendance", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { instructorId, classId, date } = req.query as Record<string, string>;

  let rows = await db
    .select()
    .from(instructorAttendanceTable)
    .orderBy(desc(instructorAttendanceTable.attendanceDate), instructorAttendanceTable.checkInTime);

  if (session.role === "instructor" && session.instructorId) {
    rows = rows.filter((r) => r.instructorId === session.instructorId);
  } else {
    if (instructorId) rows = rows.filter((r) => r.instructorId === Number(instructorId));
  }
  if (classId) rows = rows.filter((r) => r.classId === Number(classId));
  if (date) rows = rows.filter((r) => r.attendanceDate === date);

  return res.json(rows.map(toAttendance));
});

// POST /attendance/checkin
router.post("/attendance/checkin", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { instructorId, classId, attendanceDate, checkInTime, remarks } = req.body;

  const resolvedId = session.role === "instructor" && session.instructorId
    ? session.instructorId
    : Number(instructorId);

  if (!resolvedId || !checkInTime) {
    return res.status(400).json({ error: "instructorId and checkInTime are required" });
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, resolvedId));
  if (!instructor) return res.status(404).json({ error: "Instructor not found" });

  const today = attendanceDate ?? new Date().toISOString().slice(0, 10);

  const [existing] = await db
    .select()
    .from(instructorAttendanceTable)
    .where(and(
      eq(instructorAttendanceTable.instructorId, resolvedId),
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
    instructorId: resolvedId,
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
router.put("/attendance/:id/checkout", requireAuth, async (req, res) => {
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

// DELETE /attendance/:id — admin only
router.delete("/attendance/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(instructorAttendanceTable).where(eq(instructorAttendanceTable.id, id));
  return res.status(204).send();
});

// GET /attendance/stats/:instructorId
router.get("/attendance/stats/:instructorId", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const instructorId = Number(req.params.instructorId);

  // Instructors can only see their own stats
  if (session.role === "instructor" && session.instructorId && session.instructorId !== instructorId) {
    return res.status(403).json({ error: "Access denied" });
  }

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

// ── Student Attendance ────────────────────────────────────────────────────

// GET /student-attendance — get attendance records for a class/date
router.get("/student-attendance", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { classId, date, studentId, month, year } = req.query as Record<string, string>;

  let query = db
    .select({
      sa: studentAttendanceTable,
      student: { id: studentsTable.id, name: studentsTable.name, studentCode: studentsTable.studentCode },
    })
    .from(studentAttendanceTable)
    .innerJoin(studentsTable, eq(studentAttendanceTable.studentId, studentsTable.id));

  const conditions = [];

  // Instructors can only see attendance for their assigned classes
  if (session.role === "instructor" && session.instructorId) {
    const assigned = await db
      .select({ classId: instructorClassesTable.classId })
      .from(instructorClassesTable)
      .where(eq(instructorClassesTable.instructorId, session.instructorId));
    const classIds = assigned.map(a => a.classId);
    if (classIds.length === 0) return res.json([]);
    conditions.push(inArray(studentAttendanceTable.classId, classIds));
  }

  if (classId) conditions.push(eq(studentAttendanceTable.classId, Number(classId)));
  if (date) conditions.push(eq(studentAttendanceTable.attendanceDate, date));
  if (studentId) conditions.push(eq(studentAttendanceTable.studentId, Number(studentId)));

  const rows = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query)
    .orderBy(desc(studentAttendanceTable.attendanceDate), studentsTable.name);

  // Month/year filter
  let result = rows;
  if (month && year) {
    result = rows.filter(r => {
      const d = new Date(r.sa.attendanceDate);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    });
  }

  return res.json(result.map(r => ({
    id: r.sa.id,
    studentId: r.sa.studentId,
    studentName: r.student.name,
    studentCode: r.student.studentCode,
    classId: r.sa.classId,
    attendanceDate: r.sa.attendanceDate,
    status: r.sa.status,
    markedBy: r.sa.markedBy ?? undefined,
    remarks: r.sa.remarks ?? undefined,
    createdAt: r.sa.createdAt.toISOString(),
  })));
});

// POST /student-attendance/bulk — mark attendance for multiple students at once
router.post("/student-attendance/bulk", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { classId, attendanceDate, records } = req.body;
  // records: Array<{ studentId, status, remarks? }>

  if (!classId || !attendanceDate || !Array.isArray(records)) {
    return res.status(400).json({ error: "classId, attendanceDate, and records[] required" });
  }

  // Instructors can only mark attendance for their assigned classes
  if (session.role === "instructor" && session.instructorId) {
    const [assigned] = await db
      .select()
      .from(instructorClassesTable)
      .where(and(
        eq(instructorClassesTable.instructorId, session.instructorId),
        eq(instructorClassesTable.classId, Number(classId))
      ));
    if (!assigned) return res.status(403).json({ error: "Access denied — not your class" });
  }

  // Upsert: delete existing for this class+date then insert
  await db.delete(studentAttendanceTable)
    .where(and(
      eq(studentAttendanceTable.classId, Number(classId)),
      eq(studentAttendanceTable.attendanceDate, attendanceDate)
    ));

  if (records.length > 0) {
    const values = records.map((r: any) => ({
      studentId: Number(r.studentId),
      classId: Number(classId),
      attendanceDate: String(attendanceDate),
      status: r.status ?? "present",
      markedBy: session.instructorId ?? null,
      remarks: r.remarks ?? null,
    }));
    await db.insert(studentAttendanceTable).values(values);
  }

  return res.json({ ok: true, count: records.length });
});

// POST /student-attendance — mark single record
router.post("/student-attendance", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { studentId, classId, attendanceDate, status, remarks } = req.body;

  if (!studentId || !classId || !attendanceDate) {
    return res.status(400).json({ error: "studentId, classId, attendanceDate required" });
  }

  // Check if already exists, update if so
  const [existing] = await db
    .select()
    .from(studentAttendanceTable)
    .where(and(
      eq(studentAttendanceTable.studentId, Number(studentId)),
      eq(studentAttendanceTable.classId, Number(classId)),
      eq(studentAttendanceTable.attendanceDate, attendanceDate)
    ));

  if (existing) {
    const [updated] = await db
      .update(studentAttendanceTable)
      .set({ status: status ?? "present", remarks: remarks ?? null })
      .where(eq(studentAttendanceTable.id, existing.id))
      .returning();
    return res.json({ id: updated.id, studentId: updated.studentId, classId: updated.classId, attendanceDate: updated.attendanceDate, status: updated.status });
  }

  const [record] = await db.insert(studentAttendanceTable).values({
    studentId: Number(studentId),
    classId: Number(classId),
    attendanceDate,
    status: status ?? "present",
    markedBy: session.instructorId ?? null,
    remarks: remarks ?? null,
  }).returning();

  return res.status(201).json({ id: record.id, studentId: record.studentId, classId: record.classId, attendanceDate: record.attendanceDate, status: record.status });
});

// GET /student-attendance/summary/:studentId — summary stats for a student
router.get("/student-attendance/summary/:studentId", requireAuth, async (req, res) => {
  const studentId = Number(req.params.studentId);
  const { classId } = req.query as Record<string, string>;

  const conditions = [eq(studentAttendanceTable.studentId, studentId)];
  if (classId) conditions.push(eq(studentAttendanceTable.classId, Number(classId)));

  const records = await db
    .select()
    .from(studentAttendanceTable)
    .where(and(...conditions))
    .orderBy(desc(studentAttendanceTable.attendanceDate));

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));

  const presentDays = records.filter(r => r.status === "present").length;
  const absentDays = records.filter(r => r.status === "absent").length;
  const lateDays = records.filter(r => r.status === "late").length;
  const totalDays = records.length;

  // Include opening balance
  const openingPresent = student?.openingPresentDays ?? 0;
  const openingAbsent = student?.openingAbsentDays ?? 0;

  return res.json({
    studentId,
    totalRecords: totalDays,
    presentDays: presentDays + openingPresent,
    absentDays: absentDays + openingAbsent,
    lateDays,
    openingPresentDays: openingPresent,
    openingAbsentDays: openingAbsent,
    attendancePercent: (totalDays + openingPresent + openingAbsent) > 0
      ? Math.round(((presentDays + openingPresent) / (totalDays + openingPresent + openingAbsent)) * 100)
      : 0,
    records: records.map(r => ({
      id: r.id,
      attendanceDate: r.attendanceDate,
      status: r.status,
      classId: r.classId,
    })),
  });
});

// DELETE /student-attendance/:id — admin only
router.delete("/student-attendance/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(studentAttendanceTable).where(eq(studentAttendanceTable.id, id));
  return res.status(204).send();
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
