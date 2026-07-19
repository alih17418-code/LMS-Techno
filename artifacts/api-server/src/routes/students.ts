import { Router } from "express";
import { eq, ilike, and, or, type SQL } from "drizzle-orm";
import { db, studentsTable, coursesTable, vouchersTable, classesTable, instructorClassesTable, receiptsTable, certificatesTable } from "@workspace/db";
import { requireAuth, requireAdminOrStaff, requireAdmin, getSessionUser } from "../middlewares/auth";

const router = Router();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

async function generateStudentCode(): Promise<string> {
  const count = await db.$count(studentsTable);
  return String(100001 + count);
}

function calcEndDate(enrollmentDate: string, durationMonths: number): string {
  const d = new Date(enrollmentDate);
  d.setMonth(d.getMonth() + durationMonths);
  return d.toISOString().slice(0, 10);
}

// GET /students
router.get("/students", requireAuth, async (req, res) => {
  const session = getSessionUser(req);
  const { courseId, course, status, search, classId } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (courseId) conditions.push(eq(studentsTable.courseId, Number(courseId)));
  if (course) conditions.push(eq(studentsTable.course, course));
  if (status) conditions.push(eq(studentsTable.status, status));
  if (classId) conditions.push(eq(studentsTable.classId, Number(classId)));
  if (search) {
    conditions.push(
      or(
        ilike(studentsTable.name, `%${search}%`),
        ilike(studentsTable.studentCode, `%${search}%`),
        ilike(studentsTable.phone as any, `%${search}%`)
      ) as SQL
    );
  }

  // Instructors only see students in their assigned classes
  if (session.role === "instructor" && session.instructorId) {
    const assignedClasses = await db
      .select({ classId: instructorClassesTable.classId })
      .from(instructorClassesTable)
      .where(eq(instructorClassesTable.instructorId, session.instructorId));
    const classIds = assignedClasses.map(c => c.classId);

    if (classIds.length === 0) return res.json([]);

    // Filter students to those in assigned classes
    const rows = await db
      .select({ student: studentsTable, course: coursesTable })
      .from(studentsTable)
      .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
      .where(and(
        ...conditions,
        or(...classIds.map(id => eq(studentsTable.classId, id))) as SQL
      ))
      .orderBy(studentsTable.name);
    return res.json(rows.map(({ student, course }) => toStudentResponse(student, course)));
  }

  const rows = await db
    .select({ student: studentsTable, course: coursesTable })
    .from(studentsTable)
    .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(studentsTable.name);

  return res.json(rows.map(({ student, course }) => toStudentResponse(student, course)));
});

// POST /students — admin or staff only
router.post("/students", requireAdminOrStaff, async (req, res) => {
  const {
    name, courseId, classId, fatherName, phone, address, status,
    enrollmentDate, batchStartDate, discountAmount,
    openingPaidAmount, openingPendingAmount, openingPresentDays, openingAbsentDays, openingMonthsPaid,
  } = req.body;

  if (!name || !courseId || !enrollmentDate) {
    return res.status(400).json({ error: "validation_error", message: "name, courseId, and enrollmentDate are required" });
  }

  const [courseRow] = await db.select().from(coursesTable).where(eq(coursesTable.id, Number(courseId)));
  if (!courseRow) {
    return res.status(400).json({ error: "not_found", message: "Course not found" });
  }

  let className: string | null = null;
  if (classId) {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, Number(classId)));
    className = cls?.className ?? null;
  }

  const studentCode = await generateStudentCode();
  const endDate = calcEndDate(enrollmentDate, courseRow.durationMonths);

  const [student] = await db
    .insert(studentsTable)
    .values({
      studentCode,
      name: String(name).trim(),
      courseId: Number(courseId),
      course: courseRow.name,
      classId: classId ? Number(classId) : null,
      className,
      fatherName: fatherName ?? null,
      phone: phone ?? null,
      address: address ?? null,
      status: status ?? "active",
      enrollmentDate,
      batchStartDate: batchStartDate ?? null,
      endDate,
      discountAmount: String(discountAmount ?? "0"),
      openingPaidAmount: String(openingPaidAmount ?? "0"),
      openingPendingAmount: String(openingPendingAmount ?? "0"),
      openingPresentDays: Number(openingPresentDays ?? 0),
      openingAbsentDays: Number(openingAbsentDays ?? 0),
      openingMonthsPaid: Number(openingMonthsPaid ?? 0),
    })
    .returning();

  // Create historical vouchers + receipts for already-paid months
  const paidMonths = Number(openingMonthsPaid ?? 0);
  if (paidMonths > 0) {
    const disc = Number(discountAmount ?? 0);
    const totalPayable = Math.max(0, Number(courseRow.monthlyFee) * courseRow.durationMonths - disc);
    const effectiveMonthly = courseRow.durationMonths > 0 ? totalPayable / courseRow.durationMonths : Number(courseRow.monthlyFee);
    const feeStr = effectiveMonthly.toFixed(2);
    const baseDate = new Date(enrollmentDate);

    for (let i = 0; i < paidMonths; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();

      const [voucher] = await db.insert(vouchersTable).values({
        studentId: student.id,
        month,
        year,
        voucherType: "monthly",
        totalFee: feeStr,
        totalReceived: feeStr,
        pendingAmount: "0.00",
        status: "paid",
      }).returning();

      const receiptNumber = `OPEN-${studentCode}-M${i + 1}`;
      await db.insert(receiptsTable).values({
        receiptNumber,
        voucherId: voucher.id,
        studentId: student.id,
        amountReceived: feeStr,
        paymentMethod: "cash",
        remarks: "Opening balance — paid before system migration",
        paymentDate: d.toISOString().slice(0, 10),
      });
    }
  }

  return res.status(201).json(toStudentResponse(student, courseRow));
});

// GET /students/:id
router.get("/students/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const session = getSessionUser(req);

  const [row] = await db
    .select({ student: studentsTable, course: coursesTable })
    .from(studentsTable)
    .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
    .where(eq(studentsTable.id, id));

  if (!row) return res.status(404).json({ error: "not_found", message: "Student not found" });

  // Instructors can only view students in their assigned classes
  if (session.role === "instructor" && session.instructorId) {
    if (!row.student.classId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const [assigned] = await db
      .select()
      .from(instructorClassesTable)
      .where(and(
        eq(instructorClassesTable.instructorId, session.instructorId),
        eq(instructorClassesTable.classId, row.student.classId)
      ));
    if (!assigned) return res.status(403).json({ error: "Access denied" });
  }

  return res.json(toStudentResponse(row.student, row.course));
});

// PUT /students/:id — admin or staff only
router.put("/students/:id", requireAdminOrStaff, async (req, res) => {
  const id = Number(req.params.id);

  const [existing] = await db
    .select({ student: studentsTable })
    .from(studentsTable)
    .where(eq(studentsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Student not found" });

  const updateData: Partial<typeof studentsTable.$inferInsert> = {};
  const body = req.body;

  if (body.name !== undefined) updateData.name = String(body.name).trim();
  if (body.status !== undefined) updateData.status = body.status;
  if (body.fatherName !== undefined) updateData.fatherName = body.fatherName;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.discountAmount !== undefined) updateData.discountAmount = String(body.discountAmount);
  if (body.batchStartDate !== undefined) updateData.batchStartDate = body.batchStartDate ?? null;
  if (body.openingPaidAmount !== undefined) updateData.openingPaidAmount = String(body.openingPaidAmount);
  if (body.openingPendingAmount !== undefined) updateData.openingPendingAmount = String(body.openingPendingAmount);
  if (body.openingPresentDays !== undefined) updateData.openingPresentDays = Number(body.openingPresentDays);
  if (body.openingAbsentDays !== undefined) updateData.openingAbsentDays = Number(body.openingAbsentDays);
  if (body.openingMonthsPaid !== undefined) updateData.openingMonthsPaid = Number(body.openingMonthsPaid);

  // Class assignment
  if (body.classId !== undefined) {
    if (body.classId === null || body.classId === "") {
      updateData.classId = null;
      updateData.className = null;
    } else {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, Number(body.classId)));
      updateData.classId = Number(body.classId);
      updateData.className = cls?.className ?? null;
    }
  }

  let courseRow: typeof coursesTable.$inferSelect | undefined;
  if (body.courseId !== undefined) {
    const [c] = await db.select().from(coursesTable).where(eq(coursesTable.id, Number(body.courseId)));
    if (!c) return res.status(400).json({ error: "not_found", message: "Course not found" });
    courseRow = c;
    updateData.courseId = Number(body.courseId);
    updateData.course = c.name;
  }
  if (body.enrollmentDate !== undefined) updateData.enrollmentDate = body.enrollmentDate;
  if (body.courseId !== undefined || body.enrollmentDate !== undefined) {
    const enrollment = body.enrollmentDate ?? existing.student.enrollmentDate;
    const duration = courseRow?.durationMonths ?? (
      existing.student.courseId
        ? (await db.select().from(coursesTable).where(eq(coursesTable.id, existing.student.courseId!)))[0]?.durationMonths ?? 1
        : 1
    );
    updateData.endDate = calcEndDate(enrollment, duration);
  }

  const [updated] = await db
    .update(studentsTable)
    .set(updateData)
    .where(eq(studentsTable.id, id))
    .returning();

  const [updatedCourse] = updated.courseId
    ? await db.select().from(coursesTable).where(eq(coursesTable.id, updated.courseId))
    : [null];

  return res.json(toStudentResponse(updated, updatedCourse));
});

// DELETE /students/:id — admin only (cascades receipts, certificates, vouchers, attendance)
router.delete("/students/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Student not found" });
  // Delete restrict-FK children first, then the student (vouchers + attendance cascade)
  await db.delete(receiptsTable).where(eq(receiptsTable.studentId, id));
  await db.delete(certificatesTable).where(eq(certificatesTable.studentId, id));
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  return res.status(204).send();
});

// GET /students/:id/ledger
router.get("/students/:id/ledger", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const [row] = await db
    .select({ student: studentsTable, course: coursesTable })
    .from(studentsTable)
    .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
    .where(eq(studentsTable.id, id));
  if (!row) return res.status(404).json({ error: "not_found", message: "Student not found" });

  const vouchers = await db
    .select()
    .from(vouchersTable)
    .where(eq(vouchersTable.studentId, id))
    .orderBy(vouchersTable.year, vouchersTable.month);

  const entries = vouchers.map((v) => ({
    voucherId: v.id,
    month: v.month,
    year: v.year,
    monthName: MONTH_NAMES[v.month - 1],
    fee: parseFloat(v.totalFee as string),
    received: parseFloat(v.totalReceived as string),
    pending: parseFloat(v.pendingAmount as string),
    status: v.status,
  }));

  const student = toStudentResponse(row.student, row.course);
  const openingPaid = parseFloat(row.student.openingPaidAmount as string ?? "0");
  const openingPending = parseFloat(row.student.openingPendingAmount as string ?? "0");

  return res.json({
    student,
    entries,
    openingPaid,
    openingPending,
    totalFee: entries.reduce((s, e) => s + e.fee, 0),
    totalReceived: entries.reduce((s, e) => s + e.received, 0) + openingPaid,
    totalPending: entries.reduce((s, e) => s + e.pending, 0) + openingPending,
  });
});

export function toStudentResponse(
  s: typeof studentsTable.$inferSelect,
  c: typeof coursesTable.$inferSelect | null | undefined
) {
  const discount = parseFloat(s.discountAmount as string ?? "0");
  const monthlyFee = c ? parseFloat(c.monthlyFee as string) : 0;
  const durationMonths = c ? c.durationMonths : 1;
  const effectiveFee = Math.max(0, (monthlyFee * durationMonths - discount) / durationMonths);
  return {
    id: s.id,
    studentCode: s.studentCode,
    name: s.name,
    course: s.course,
    courseId: s.courseId ?? undefined,
    classId: s.classId ?? undefined,
    className: s.className ?? undefined,
    fatherName: s.fatherName ?? undefined,
    phone: s.phone ?? undefined,
    address: s.address ?? undefined,
    status: s.status,
    enrollmentDate: s.enrollmentDate,
    batchStartDate: s.batchStartDate ?? undefined,
    endDate: s.endDate ?? undefined,
    discountAmount: discount,
    effectiveFee,
    openingPaidAmount: parseFloat(s.openingPaidAmount as string ?? "0"),
    openingPendingAmount: parseFloat(s.openingPendingAmount as string ?? "0"),
    openingPresentDays: s.openingPresentDays ?? 0,
    openingAbsentDays: s.openingAbsentDays ?? 0,
    openingMonthsPaid: s.openingMonthsPaid ?? 0,
    createdAt: s.createdAt.toISOString(),
  };
}

export default router;
