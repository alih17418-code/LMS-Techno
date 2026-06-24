import { Router } from "express";
import { eq, ilike, and, or, inArray, desc, type SQL } from "drizzle-orm";
import { db, instructorsTable, instructorPaymentsTable, instructorAttendanceTable, coursesTable, studentsTable, receiptsTable, vouchersTable } from "@workspace/db";

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
router.get("/instructors", async (req, res) => {
  const { courseId, status, search } = req.query as Record<string, string>;

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

  return res.json(rows.map(toInstructorResponse));
});

// POST /instructors
router.post("/instructors", async (req, res) => {
  const { name, fatherName, phone, address, specialization, courseId, paymentModel, monthlySalary, lectureRate, commissionPercent, joinDate, status } = req.body;

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

  return res.status(201).json(toInstructorResponse(instructor));
});

// GET /instructors/:id
router.get("/instructors/:id", async (req, res) => {
  const id = Number(req.params.id);
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
    // Count distinct calendar months that had attendance records
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

  return res.json({
    ...toInstructorResponse(instructor),
    payments: payments.map((p) => toPaymentResponse(p, instructor)),
    attendance: attendance.map((a) => toAttendanceResponse(a)),
    totalLectures,
    totalEarned,
    totalPaid,
    pendingEarnings: Math.max(0, totalEarned - totalPaid),
  });
});

// PUT /instructors/:id
router.put("/instructors/:id", async (req, res) => {
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
  return res.json(toInstructorResponse(updated));
});

// DELETE /instructors/:id
router.delete("/instructors/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Instructor not found" });
  await db.delete(instructorsTable).where(eq(instructorsTable.id, id));
  return res.status(204).send();
});

// GET /instructor-payments
router.get("/instructor-payments", async (req, res) => {
  const { instructorId, month, year } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (instructorId) conditions.push(eq(instructorPaymentsTable.instructorId, Number(instructorId)));
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

  return res.json(
    payments.map((p) => toPaymentResponse(p, instructorMap.get(p.instructorId)!))
  );
});

// POST /instructor-payments
router.post("/instructor-payments", async (req, res) => {
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

// DELETE /instructor-payments/:id
router.delete("/instructor-payments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorPaymentsTable).where(eq(instructorPaymentsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Payment not found" });
  await db.delete(instructorPaymentsTable).where(eq(instructorPaymentsTable.id, id));
  return res.status(204).send();
});

// GET /instructor-attendance
router.get("/instructor-attendance", async (req, res) => {
  const { instructorId, classId, from, to } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (instructorId) conditions.push(eq(instructorAttendanceTable.instructorId, Number(instructorId)));
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
router.post("/instructor-attendance", async (req, res) => {
  const { instructorId, classId, className, shift, attendanceDate, checkInTime, checkOutTime, lectureCount, status, remarks } = req.body;

  if (!instructorId || !attendanceDate || !checkInTime) {
    return res.status(400).json({ error: "validation_error", message: "instructorId, attendanceDate, checkInTime are required" });
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, Number(instructorId)));
  if (!instructor) return res.status(404).json({ error: "not_found", message: "Instructor not found" });

  const [record] = await db
    .insert(instructorAttendanceTable)
    .values({
      instructorId: Number(instructorId),
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

// DELETE /instructor-attendance/:id
router.delete("/instructor-attendance/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(instructorAttendanceTable).where(eq(instructorAttendanceTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Attendance record not found" });
  await db.delete(instructorAttendanceTable).where(eq(instructorAttendanceTable.id, id));
  return res.status(204).send();
});

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
