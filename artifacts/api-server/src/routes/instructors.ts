import { Router } from "express";
import { eq, ilike, and, or, inArray, desc, type SQL } from "drizzle-orm";
import { db, instructorsTable, instructorPaymentsTable, instructorAttendanceTable, coursesTable, studentsTable, receiptsTable, vouchersTable, classesTable, instructorClassesTable } from "@workspace/db";
import { requireAuth, requireAdminOrStaff, requireAdmin, getSessionUser } from "../middlewares/auth";

const router = Router();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

async function generateInstructorCode(): Promise<string> {
  const count = await db.$count(instructorsTable);
  return `I-${String(count + 1).padStart(3, "0")}`;
}

async function generatePaymentNumber(): Promise<string> {
  const count = await db.$count(instructorPaymentsTable);
  return `SAL-${String(count + 1).padStart(6, "0")}`;
}

// GET /instructors
router.get("/instructors", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { courseId, status, search } = req.query as Record<string, string>;

  // Instructors can only see themselves
  if (session.role === "instructor" && session.instructorId) {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, session.instructorId));
    if (!instructor) return res.json([]);
    const assignedClasses = await getInstructorClasses(instructor.id);
    return res.json([{ ...toInstructorResponse(instructor), assignedClasses }]);
  }

  const conditions: SQL[] = [];
  if (courseId) conditions.push(eq(instructorsTable.courseId, Number(courseId)));
  if (status) conditions.push(eq(instructorsTable.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(instructorsTable.name, `%${search}%`),
        ilike(instructorsTable.instructorCode, `%${search}%`),
        ilike(instructorsTable.phone as any, `%${search}%`)
      ) as SQL
    );
  }

  const rows = await db
    .select()
    .from(instructorsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(instructorsTable.name);

  const result = await Promise.all(rows.map(async (i) => ({
    ...toInstructorResponse(i),
    assignedClasses: await getInstructorClasses(i.id),
  })));

  return res.json(result);
});

// POST /instructors — admin or staff
router.post("/instructors", requireAdminOrStaff, async (req, res) => {
  const { name, fatherName, phone, address, specialization, courseId, paymentModel, monthlySalary, lectureRate, commissionPercent, joinDate, status, classIds } = req.body;

  if (!name || !joinDate) {
    return res.status(400).json({ error: "validation_error", message: "name and joinDate are required" });
  }

  let courseName: string | null = null;
  if (courseId) {
    const [c] = await db.select().from(coursesTable).where(eq(coursesTable.id, Number(courseId)));
    if (!c) return res.status(400).json({ error: "not_found", message: "Course not found" });
    courseName = c.name;
  }

  const instructorCode = await generateInstructorCode();
  const model = paymentModel ?? "salary";

  const [instructor] = await db
    .insert(instructorsTable)
    .values({
      instructorCode,
      name: String(name).trim(),
      fatherName: fatherName ?? null,
      phone: phone ?? null,
      address: address ?? null,
      specialization: specialization ?? null,
      courseId: courseId ? Number(courseId) : null,
      courseName,
      paymentModel: model,
      monthlySalary: model === "salary" ? String(monthlySalary ?? "0") : "0",
      lectureRate: model === "per_lecture" ? String(lectureRate ?? "0") : "0",
      commissionPercent: model === "commission" ? String(commissionPercent ?? "0") : "0",
      joinDate,
      status: status ?? "active",
    })
    .returning();

  // Assign classes
  if (Array.isArray(classIds) && classIds.length > 0) {
    await assignClasses(instructor.id, classIds.map(Number));
  }

  const assignedClasses = await getInstructorClasses(instructor.id);
  return res.status(201).json({ ...toInstructorResponse(instructor), assignedClasses });
});

// GET /instructors/:id
router.get("/instructors/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const session = getSessionUser(req);

  // Instructors can only view themselves
  if (session.role === "instructor" && session.instructorId && session.instructorId !== id) {
    return res.status(403).json({ error: "Access denied" });
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, id));
  if (!instructor) return res.status(404).json({ error: "not_found", message: "Instructor not found" });

  const payments = await db
    .select()
    .from(instructorPaymentsTable)
    .where(eq(instructorPaymentsTable.instructorId, id))
    .orderBy(instructorPaymentsTable.year, instructorPaymentsTable.month);

  const attendance = await db
    .select()
    .from(instructorAttendanceTable)
    .where(eq(instructorAttendanceTable.instructorId, id))
    .orderBy(desc(instructorAttendanceTable.attendanceDate));

  const totalLectures = attendance.reduce((s, a) => s + (a.lectureCount ?? 1), 0);
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amountPaid as string), 0);

  let totalEarned = 0;
  if (instructor.paymentModel === "per_lecture") {
    totalEarned = totalLectures * parseFloat(instructor.lectureRate as string);
  } else if (instructor.paymentModel === "salary") {
    const monthKeys = new Set(
      attendance.map((a) => {
        const d = new Date(a.attendanceDate);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );
    const monthlySalary = parseFloat(instructor.monthlySalary as string) || 0;
    totalEarned = monthKeys.size * monthlySalary;
  } else if (instructor.paymentModel === "commission" && instructor.courseId) {
    const studentRows = await db
      .select({ voucher: vouchersTable })
      .from(vouchersTable)
      .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
      .where(eq(studentsTable.courseId, instructor.courseId));
    const totalRevenue = studentRows.reduce((s, r) => s + parseFloat(r.voucher.totalReceived as string), 0);
    totalEarned = totalRevenue * (parseFloat(instructor.commissionPercent as string) / 100);
  }

  const assignedClasses = await getInstructorClasses(id);

  // Class-based financial data for instructor portal
  const classFinancials = await getClassFinancials(assignedClasses.map(c => c.classId));

  return res.json({
    ...toInstructorResponse(instructor),
    assignedClasses,
    classFinancials,
    payments: payments.map((p) => toPaymentResponse(p, instructor)),
    attendance: attendance.map((a) => toAttendanceResponse(a)),
    totalLectures,
    totalEarned,
    totalPaid,
    pendingEarnings: Math.max(0, totalEarned - totalPaid),
  });
});

// PUT /instructors/:id — admin or staff
router.put("/instructors/:id", requireAdminOrStaff, async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Instructor not found" });

  const update: Partial<typeof instructorsTable.$inferInsert> = {};
  const b = req.body;

  if (b.name !== undefined) update.name = String(b.name).trim();
  if (b.fatherName !== undefined) update.fatherName = b.fatherName;
  if (b.phone !== undefined) update.phone = b.phone;
  if (b.address !== undefined) update.address = b.address;
  if (b.specialization !== undefined) update.specialization = b.specialization;
  if (b.paymentModel !== undefined) update.paymentModel = b.paymentModel;
  if (b.monthlySalary !== undefined) update.monthlySalary = String(b.monthlySalary);
  if (b.lectureRate !== undefined) update.lectureRate = String(b.lectureRate);
  if (b.commissionPercent !== undefined) update.commissionPercent = String(b.commissionPercent);
  if (b.joinDate !== undefined) update.joinDate = b.joinDate;
  if (b.status !== undefined) update.status = b.status;

  if (b.courseId !== undefined) {
    if (b.courseId === null || b.courseId === "") {
      update.courseId = null;
      update.courseName = null;
    } else {
      const [c] = await db.select().from(coursesTable).where(eq(coursesTable.id, Number(b.courseId)));
      if (!c) return res.status(400).json({ error: "not_found", message: "Course not found" });
      update.courseId = Number(b.courseId);
      update.courseName = c.name;
    }
  }

  const [updated] = await db.update(instructorsTable).set(update).where(eq(instructorsTable.id, id)).returning();

  // Update class assignments if provided
  if (Array.isArray(b.classIds)) {
    await db.delete(instructorClassesTable).where(eq(instructorClassesTable.instructorId, id));
    if (b.classIds.length > 0) {
      await assignClasses(id, b.classIds.map(Number));
    }
  }

  const assignedClasses = await getInstructorClasses(id);
  return res.json({ ...toInstructorResponse(updated), assignedClasses });
});

// DELETE /instructors/:id — admin only
router.delete("/instructors/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Instructor not found" });
  await db.delete(instructorsTable).where(eq(instructorsTable.id, id));
  return res.status(204).send();
});

// POST /instructors/:id/classes — assign classes to instructor
router.post("/instructors/:id/classes", requireAdminOrStaff, async (req, res) => {
  const id = Number(req.params.id);
  const { classIds } = req.body;
  if (!Array.isArray(classIds)) return res.status(400).json({ error: "classIds array required" });

  await db.delete(instructorClassesTable).where(eq(instructorClassesTable.instructorId, id));
  if (classIds.length > 0) {
    await assignClasses(id, classIds.map(Number));
  }

  const assignedClasses = await getInstructorClasses(id);
  return res.json({ instructorId: id, assignedClasses });
});

// GET /instructor-payments
router.get("/instructor-payments", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { instructorId, month, year } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  // Instructors can only see their own payments
  if (session.role === "instructor" && session.instructorId) {
    conditions.push(eq(instructorPaymentsTable.instructorId, session.instructorId));
  } else {
    if (instructorId) conditions.push(eq(instructorPaymentsTable.instructorId, Number(instructorId)));
  }
  if (month) conditions.push(eq(instructorPaymentsTable.month, Number(month)));
  if (year) conditions.push(eq(instructorPaymentsTable.year, Number(year)));

  const payments = await db
    .select()
    .from(instructorPaymentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(instructorPaymentsTable.year, instructorPaymentsTable.month, instructorPaymentsTable.createdAt);

  const instructorIds = [...new Set(payments.map((p) => p.instructorId))];
  let instructors: typeof instructorsTable.$inferSelect[] = [];
  if (instructorIds.length > 0) {
    instructors = await db.select().from(instructorsTable).where(inArray(instructorsTable.id, instructorIds));
  }
  const instructorMap = new Map(instructors.map((i) => [i.id, i]));

  return res.json(payments.map((p) => toPaymentResponse(p, instructorMap.get(p.instructorId)!)));
});

// POST /instructor-payments — admin or staff
router.post("/instructor-payments", requireAdminOrStaff, async (req, res) => {
  const { instructorId, month, year, amountPaid, paymentMethod, paymentDate, remarks } = req.body;

  if (!instructorId || !month || !year || !amountPaid || !paymentMethod || !paymentDate) {
    return res.status(400).json({ error: "validation_error", message: "instructorId, month, year, amountPaid, paymentMethod, paymentDate are required" });
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, Number(instructorId)));
  if (!instructor) return res.status(404).json({ error: "not_found", message: "Instructor not found" });

  const paymentNumber = await generatePaymentNumber();

  const [payment] = await db
    .insert(instructorPaymentsTable)
    .values({
      paymentNumber,
      instructorId: Number(instructorId),
      month: Number(month),
      year: Number(year),
      amountPaid: String(amountPaid),
      paymentMethod,
      paymentDate,
      remarks: remarks ?? null,
    })
    .returning();

  return res.status(201).json(toPaymentResponse(payment, instructor));
});

// DELETE /instructor-payments/:id — admin only
router.delete("/instructor-payments/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorPaymentsTable).where(eq(instructorPaymentsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Payment not found" });
  await db.delete(instructorPaymentsTable).where(eq(instructorPaymentsTable.id, id));
  return res.status(204).send();
});

// GET /instructor-attendance
router.get("/instructor-attendance", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { instructorId, classId, from, to } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (session.role === "instructor" && session.instructorId) {
    conditions.push(eq(instructorAttendanceTable.instructorId, session.instructorId));
  } else {
    if (instructorId) conditions.push(eq(instructorAttendanceTable.instructorId, Number(instructorId)));
  }
  if (classId) conditions.push(eq(instructorAttendanceTable.classId, Number(classId)));

  const rows = await db
    .select()
    .from(instructorAttendanceTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(instructorAttendanceTable.attendanceDate));

  let filtered = rows;
  if (from) filtered = filtered.filter((r) => r.attendanceDate >= from);
  if (to) filtered = filtered.filter((r) => r.attendanceDate <= to);

  return res.json(filtered.map(toAttendanceResponse));
});

// POST /instructor-attendance
router.post("/instructor-attendance", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { instructorId, classId, className, shift, attendanceDate, checkInTime, checkOutTime, lectureCount, status, remarks } = req.body;

  // Instructors can only record their own
  const resolvedInstructorId = session.role === "instructor" && session.instructorId
    ? session.instructorId
    : Number(instructorId);

  if (!resolvedInstructorId || !attendanceDate || !checkInTime) {
    return res.status(400).json({ error: "validation_error", message: "instructorId, attendanceDate, checkInTime are required" });
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, resolvedInstructorId));
  if (!instructor) return res.status(404).json({ error: "not_found", message: "Instructor not found" });

  const [record] = await db
    .insert(instructorAttendanceTable)
    .values({
      instructorId: resolvedInstructorId,
      instructorName: instructor.name,
      classId: classId ? Number(classId) : null,
      className: className ?? null,
      shift: shift ?? null,
      attendanceDate,
      checkInTime,
      checkOutTime: checkOutTime ?? null,
      lectureCount: Number(lectureCount ?? 1),
      status: status ?? "present",
      remarks: remarks ?? null,
    })
    .returning();

  return res.status(201).json(toAttendanceResponse(record));
});

// DELETE /instructor-attendance/:id — admin only
router.delete("/instructor-attendance/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorAttendanceTable).where(eq(instructorAttendanceTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Attendance record not found" });
  await db.delete(instructorAttendanceTable).where(eq(instructorAttendanceTable.id, id));
  return res.status(204).send();
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function getInstructorClasses(instructorId: number) {
  const rows = await db
    .select({ ic: instructorClassesTable, cls: classesTable })
    .from(instructorClassesTable)
    .innerJoin(classesTable, eq(instructorClassesTable.classId, classesTable.id))
    .where(eq(instructorClassesTable.instructorId, instructorId));
  return rows.map(r => ({
    classId: r.cls.id,
    className: r.cls.className,
    courseName: r.cls.courseName,
    year: r.cls.year,
    section: r.cls.section ?? undefined,
  }));
}

async function assignClasses(instructorId: number, classIds: number[]) {
  const values = classIds.map(classId => ({ instructorId, classId }));
  if (values.length > 0) {
    await db.insert(instructorClassesTable).values(values).onConflictDoNothing();
  }
}

async function getClassFinancials(classIds: number[]) {
  if (classIds.length === 0) return { totalGenerated: 0, totalReceived: 0, totalPending: 0 };

  const studentRows = await db
    .select({ student: studentsTable })
    .from(studentsTable)
    .where(inArray(studentsTable.classId, classIds));

  const studentIds = studentRows.map(r => r.student.id);
  if (studentIds.length === 0) return { totalGenerated: 0, totalReceived: 0, totalPending: 0 };

  const vouchers = await db
    .select()
    .from(vouchersTable)
    .where(inArray(vouchersTable.studentId, studentIds));

  return {
    totalGenerated: vouchers.reduce((s, v) => s + parseFloat(v.totalFee as string), 0),
    totalReceived: vouchers.reduce((s, v) => s + parseFloat(v.totalReceived as string), 0),
    totalPending: vouchers.reduce((s, v) => s + parseFloat(v.pendingAmount as string), 0),
  };
}

function toInstructorResponse(i: typeof instructorsTable.$inferSelect) {
  return {
    id: i.id,
    instructorCode: i.instructorCode,
    name: i.name,
    fatherName: i.fatherName ?? undefined,
    phone: i.phone ?? undefined,
    address: i.address ?? undefined,
    specialization: i.specialization ?? undefined,
    courseId: i.courseId ?? undefined,
    courseName: i.courseName ?? undefined,
    paymentModel: i.paymentModel,
    monthlySalary: parseFloat(i.monthlySalary as string),
    lectureRate: parseFloat(i.lectureRate as string),
    commissionPercent: parseFloat(i.commissionPercent as string),
    joinDate: i.joinDate,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
  };
}

function toPaymentResponse(
  p: typeof instructorPaymentsTable.$inferSelect,
  i: typeof instructorsTable.$inferSelect
) {
  return {
    id: p.id,
    paymentNumber: p.paymentNumber,
    instructorId: p.instructorId,
    instructorName: i.name,
    instructorCode: i.instructorCode,
    specialization: i.specialization ?? undefined,
    courseName: i.courseName ?? undefined,
    month: p.month,
    year: p.year,
    monthName: MONTH_NAMES[p.month - 1],
    amountPaid: parseFloat(p.amountPaid as string),
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate,
    remarks: p.remarks ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

function toAttendanceResponse(a: typeof instructorAttendanceTable.$inferSelect) {
  return {
    id: a.id,
    instructorId: a.instructorId,
    instructorName: a.instructorName,
    classId: a.classId ?? undefined,
    className: a.className ?? undefined,
    shift: a.shift ?? undefined,
    attendanceDate: a.attendanceDate,
    checkInTime: a.checkInTime,
    checkOutTime: a.checkOutTime ?? undefined,
    lectureCount: a.lectureCount ?? 1,
    status: a.status,
    remarks: a.remarks ?? undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

export default router;
