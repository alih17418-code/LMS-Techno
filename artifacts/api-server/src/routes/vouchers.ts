import { Router } from "express";
import { eq, and, inArray, type SQL } from "drizzle-orm";
import { db, studentsTable, vouchersTable, receiptsTable, coursesTable } from "@workspace/db";

const router = Router();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// GET /vouchers
router.get("/vouchers", async (req, res) => {
  const { studentId, courseId, course, month, year, status } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (month) conditions.push(eq(vouchersTable.month, Number(month)));
  if (year) conditions.push(eq(vouchersTable.year, Number(year)));
  if (status) conditions.push(eq(vouchersTable.status, status));

  let rows = await db
    .select({ voucher: vouchersTable, student: studentsTable })
    .from(vouchersTable)
    .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(vouchersTable.year, vouchersTable.month, studentsTable.name);

  if (studentId) rows = rows.filter((r) => r.student.id === Number(studentId));
  if (courseId) rows = rows.filter((r) => r.student.courseId === Number(courseId));
  if (course) rows = rows.filter((r) => r.student.course === course);

  const voucherIds = rows.map((r) => r.voucher.id);
  let receipts: typeof receiptsTable.$inferSelect[] = [];
  if (voucherIds.length > 0) {
    receipts = await db
      .select()
      .from(receiptsTable)
      .where(inArray(receiptsTable.voucherId, voucherIds));
  }

  const receiptsByVoucherId = new Map<number, typeof receiptsTable.$inferSelect[]>();
  for (const r of receipts) {
    const list = receiptsByVoucherId.get(r.voucherId) ?? [];
    list.push(r);
    receiptsByVoucherId.set(r.voucherId, list);
  }

  return res.json(rows.map(({ voucher, student }) =>
    toVoucherResponse(voucher, student, receiptsByVoucherId.get(voucher.id) ?? [])
  ));
});

// POST /vouchers/generate
router.post("/vouchers/generate", async (req, res) => {
  const { courseId, month, year } = req.body;

  if (!courseId || !month || !year) {
    return res.status(400).json({ error: "validation_error", message: "courseId, month, and year are required" });
  }

  const [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.id, Number(courseId)));

  if (!course) {
    return res.status(400).json({ error: "not_found", message: "Course not found" });
  }

  const baseMonthlyFee = parseFloat(course.monthlyFee as string);

  const students = await db
    .select()
    .from(studentsTable)
    .where(and(eq(studentsTable.courseId, Number(courseId)), eq(studentsTable.status, "active")));

  if (students.length === 0) {
    return res.status(400).json({
      error: "no_students",
      message: `No active students found for course ${course.name}.`,
    });
  }

  const details: Array<{ studentId: number; studentName: string; studentCode: string; status: string; reason?: string }> = [];
  let generated = 0; let skipped = 0; let errors = 0;

  for (const student of students) {
    // Always enforce enrollment period — compute endDate from enrollment + course duration
    // even if student.endDate is null (handles legacy records)
    if (student.enrollmentDate) {
      const enrollDate = new Date(student.enrollmentDate + "T00:00:00");
      const enrollMonthYear = enrollDate.getFullYear() * 12 + enrollDate.getMonth();

      // Compute effective end date from course duration (guaranteed, ignores stored endDate)
      const computedEnd = new Date(student.enrollmentDate + "T00:00:00");
      computedEnd.setMonth(computedEnd.getMonth() + course.durationMonths);
      // endMonthYear is exclusive: the first month AFTER the course ends
      const endMonthYear = computedEnd.getFullYear() * 12 + computedEnd.getMonth();

      const voucherMonthYear = Number(year) * 12 + (Number(month) - 1);

      if (voucherMonthYear < enrollMonthYear) {
        skipped++;
        details.push({ studentId: student.id, studentName: student.name, studentCode: student.studentCode, status: "skipped", reason: `Before enrollment date (${student.enrollmentDate})` });
        continue;
      }
      if (voucherMonthYear >= endMonthYear) {
        skipped++;
        details.push({ studentId: student.id, studentName: student.name, studentCode: student.studentCode, status: "skipped", reason: `Beyond course duration (${course.durationMonths} month(s) max — only ${course.durationMonths} voucher(s) allowed)` });
        continue;
      }

      // Skip months already covered by opening balance (migration)
      const openingMonthsPaid = Number(student.openingMonthsPaid ?? 0);
      if (openingMonthsPaid > 0) {
        const voucherMonthIndex = voucherMonthYear - enrollMonthYear; // 0-based: 0 = first month
        if (voucherMonthIndex < openingMonthsPaid) {
          skipped++;
          details.push({ studentId: student.id, studentName: student.name, studentCode: student.studentCode, status: "skipped", reason: `Month ${voucherMonthIndex + 1} already paid before system migration (opening balance: ${openingMonthsPaid} month${openingMonthsPaid > 1 ? "s" : ""} paid)` });
          continue;
        }
      }
    }

    const [existing] = await db
      .select()
      .from(vouchersTable)
      .where(and(
        eq(vouchersTable.studentId, student.id),
        eq(vouchersTable.month, Number(month)),
        eq(vouchersTable.year, Number(year)),
        eq(vouchersTable.voucherType, "monthly")
      ));

    if (existing) {
      skipped++;
      details.push({ studentId: student.id, studentName: student.name, studentCode: student.studentCode, status: "skipped", reason: `Voucher already exists for ${MONTH_NAMES[Number(month) - 1]} ${year}` });
      continue;
    }

    // discountAmount is a TOTAL course discount — spread evenly per month
    const totalCourseFee = baseMonthlyFee * course.durationMonths;
    const discount = parseFloat(student.discountAmount as string ?? "0");
    const effectiveFee = Math.max(0, (totalCourseFee - discount) / course.durationMonths);

    try {
      await db.insert(vouchersTable).values({
        studentId: student.id,
        month: Number(month),
        year: Number(year),
        voucherType: "monthly",
        totalFee: String(effectiveFee),
        totalReceived: "0",
        pendingAmount: String(effectiveFee),
        status: "unpaid",
      });
      generated++;
      details.push({ studentId: student.id, studentName: student.name, studentCode: student.studentCode, status: "generated" });
    } catch {
      errors++;
      details.push({ studentId: student.id, studentName: student.name, studentCode: student.studentCode, status: "error", reason: "Failed to create voucher" });
    }
  }

  return res.json({ generated, skipped, errors, details });
});

// GET /vouchers/:id
router.get("/vouchers/:id", async (req, res) => {
  const id = Number(req.params.id);

  const [row] = await db
    .select({ voucher: vouchersTable, student: studentsTable })
    .from(vouchersTable)
    .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
    .where(eq(vouchersTable.id, id));

  if (!row) return res.status(404).json({ error: "not_found", message: "Voucher not found" });

  const receipts = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.voucherId, id))
    .orderBy(receiptsTable.paymentDate);

  return res.json(toVoucherResponse(row.voucher, row.student, receipts));
});

// DELETE /vouchers/:id
router.delete("/vouchers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Voucher not found" });

  const related = await db.select().from(receiptsTable).where(eq(receiptsTable.voucherId, id));
  if (related.length > 0) {
    return res.status(400).json({ error: "has_payments", message: "Cannot delete a voucher that has recorded payments." });
  }

  await db.delete(vouchersTable).where(eq(vouchersTable.id, id));
  return res.status(204).send();
});

export function toVoucherResponse(
  v: typeof vouchersTable.$inferSelect,
  s: typeof studentsTable.$inferSelect,
  receipts: typeof receiptsTable.$inferSelect[]
) {
  return {
    id: v.id,
    studentId: v.studentId,
    studentName: s.name,
    studentCode: s.studentCode,
    studentRollNumber: s.studentCode,
    course: s.course,
    courseId: s.courseId ?? undefined,
    month: v.month,
    year: v.year,
    monthName: MONTH_NAMES[v.month - 1],
    voucherType: v.voucherType,
    totalFee: parseFloat(v.totalFee as string),
    totalReceived: parseFloat(v.totalReceived as string),
    pendingAmount: parseFloat(v.pendingAmount as string),
    status: v.status,
    createdAt: v.createdAt.toISOString(),
    receipts: receipts.map((r) => toReceiptResponse(r, s, v)),
  };
}

export function toReceiptResponse(
  r: typeof receiptsTable.$inferSelect,
  s: typeof studentsTable.$inferSelect,
  v: typeof vouchersTable.$inferSelect
) {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    voucherId: r.voucherId,
    studentId: r.studentId,
    studentName: s.name,
    studentCode: s.studentCode,
    course: s.course,
    month: v.month,
    year: v.year,
    amountReceived: parseFloat(r.amountReceived as string),
    paymentMethod: r.paymentMethod,
    remarks: r.remarks ?? undefined,
    paymentDate: r.paymentDate,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
