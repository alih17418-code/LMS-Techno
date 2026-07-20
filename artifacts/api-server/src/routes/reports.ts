import { Router } from "express";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { db, studentsTable, vouchersTable, receiptsTable, coursesTable, instructorsTable, instructorPaymentsTable, instructorAttendanceTable, classesTable } from "@workspace/db";
import { instructorMonthlyLecturesTable } from "@workspace/db/schema";

const router = Router();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// GET /reports/dashboard
router.get("/reports/dashboard", async (_req, res) => {
  const [allStudents, allVouchers, allReceipts, allCourses, allInstructorPayments, allClasses, allInstructors, allAttendance, allMonthlyLectures] = await Promise.all([
    db.select().from(studentsTable),
    db.select().from(vouchersTable),
    db.select().from(receiptsTable),
    db.select().from(coursesTable),
    db.select().from(instructorPaymentsTable),
    db.select().from(classesTable),
    db.select().from(instructorsTable),
    db.select().from(instructorAttendanceTable),
    db.select().from(instructorMonthlyLecturesTable),
  ]);

  const courseMap = new Map(allCourses.map(c => [c.id, c]));

  function getStudentFinancials(s: typeof studentsTable.$inferSelect) {
    const course = s.courseId ? courseMap.get(s.courseId) : null;
    const monthlyFee = course ? Number(course.monthlyFee) : 0;
    const duration = course ? course.durationMonths : 1;
    const discount = Number(s.discountAmount) || 0;
    const totalPayable = Math.max(0, monthlyFee * duration - discount);
    const effectiveMonthly = duration > 0 ? totalPayable / duration : 0;
    const openingPaid = Number(s.openingPaidAmount) || 0;
    return { effectiveMonthly, totalPayable, openingPaid };
  }

  const activeStudents = allStudents.filter(s => s.status === "active");
  const monthlyExpectedFees = activeStudents.reduce((sum, s) => sum + getStudentFinancials(s).effectiveMonthly, 0);
  const totalCourseFees = allStudents.reduce((sum, s) => sum + getStudentFinancials(s).totalPayable, 0);
  const totalOpeningPaid = allStudents.reduce((sum, s) => sum + getStudentFinancials(s).openingPaid, 0);
  const totalReceiptsPaid = allReceipts.reduce((sum, r) => sum + Number(r.amountReceived), 0);
  const totalCollected = totalOpeningPaid + totalReceiptsPaid;
  const totalRemainingBalance = Math.max(0, totalCourseFees - totalCollected);
  const totalTeacherPayments = allInstructorPayments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
  const instituteProfit = totalCollected - totalTeacherPayments;

  // Course breakdown
  const courseBreakdown = allCourses.map(course => {
    const cStudents = allStudents.filter(s => s.courseId === course.id);
    if (cStudents.length === 0) return null;
    const studentIds = new Set(cStudents.map(s => s.id));
    const cVouchers = allVouchers.filter(v => studentIds.has(v.studentId));
    const cReceipts = allReceipts.filter(r => studentIds.has(r.studentId));
    const openingPaid = cStudents.reduce((sum, s) => sum + (Number(s.openingPaidAmount) || 0), 0);
    const receiptsPaid = cReceipts.reduce((sum, r) => sum + Number(r.amountReceived), 0);
    const collected = openingPaid + receiptsPaid;
    const monthlyTotal = cStudents.filter(s => s.status === "active").reduce((sum, s) => sum + getStudentFinancials(s).effectiveMonthly, 0);
    const courseTotal = cStudents.reduce((sum, s) => sum + getStudentFinancials(s).totalPayable, 0);
    const remaining = Math.max(0, courseTotal - collected);
    return {
      course: course.name,
      courseId: course.id,
      totalStudents: cStudents.length,
      activeStudents: cStudents.filter(s => s.status === "active").length,
      monthlyTotal,
      courseTotal,
      collected,
      remaining,
      totalFeeGenerated: cVouchers.reduce((s, v) => s + Number(v.totalFee), 0),
      totalReceived: collected,
      paidCount: cVouchers.filter(v => v.status === "paid").length,
      unpaidCount: cVouchers.filter(v => v.status === "unpaid").length,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // Batch breakdown (by class)
  const batchBreakdown = allClasses.map(cls => {
    const bStudents = allStudents.filter(s => s.classId === cls.id);
    if (bStudents.length === 0) return null;
    const studentIds = new Set(bStudents.map(s => s.id));
    const bReceipts = allReceipts.filter(r => studentIds.has(r.studentId));
    const openingPaid = bStudents.reduce((sum, s) => sum + (Number(s.openingPaidAmount) || 0), 0);
    const receiptsPaid = bReceipts.reduce((sum, r) => sum + Number(r.amountReceived), 0);
    const monthlyFees = bStudents.filter(s => s.status === "active").reduce((sum, s) => sum + getStudentFinancials(s).effectiveMonthly, 0);
    const teacherPayments = cls.instructorId
      ? allInstructorPayments.filter(p => p.instructorId === cls.instructorId).reduce((sum, p) => sum + Number(p.amountPaid), 0)
      : 0;
    return {
      classId: cls.id,
      className: cls.className,
      courseName: cls.courseName,
      batch: cls.batch ?? null,
      totalStudents: bStudents.length,
      monthlyFees,
      totalCollected: openingPaid + receiptsPaid,
      teacherPayments,
      profit: monthlyFees - teacherPayments,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // Recent receipts (newest first)
  const recentRows = await db
    .select({ receipt: receiptsTable, student: studentsTable, voucher: vouchersTable })
    .from(receiptsTable)
    .innerJoin(studentsTable, eq(receiptsTable.studentId, studentsTable.id))
    .innerJoin(vouchersTable, eq(receiptsTable.voucherId, vouchersTable.id))
    .orderBy(desc(receiptsTable.createdAt))
    .limit(10);
  const recentReceipts = recentRows.map(({ receipt, student, voucher }) =>
    toReceiptResponse(receipt, student, voucher)
  );

  const totalFeeGenerated = allVouchers.reduce((s, v) => s + Number(v.totalFee), 0);

  // Instructor earnings breakdown
  const instructorEarnings = allInstructors.map(inst => {
    const payments = allInstructorPayments.filter(p => p.instructorId === inst.id);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amountPaid), 0);
    // Count lectures from attendance (present days × lectureCount)
    const attendanceRecords = allAttendance.filter(a => a.instructorId === inst.id && a.status === "present");
    const attendanceLectures = attendanceRecords.reduce((s, a) => s + (a.lectureCount ?? 1), 0);
    // Also count from monthly lectures log
    const monthlyLectures = allMonthlyLectures.filter(l => l.instructorId === inst.id).reduce((s, l) => s + l.lecturesCount, 0);
    const totalLectures = Math.max(attendanceLectures, monthlyLectures);
    const totalEarned = inst.paymentModel === "per_lecture"
      ? totalLectures * Number(inst.lectureRate)
      : inst.paymentModel === "salary"
        ? Number(inst.monthlySalary) // approximation (latest month)
        : totalLectures * Number(inst.lectureRate);
    const pendingEarnings = Math.max(0, totalEarned - totalPaid);
    return {
      id: inst.id,
      name: inst.name,
      paymentModel: inst.paymentModel,
      lectureRate: Number(inst.lectureRate),
      totalLectures,
      totalEarned,
      totalPaid,
      pendingEarnings,
    };
  });

  const totalClassesConducted = instructorEarnings.reduce((s, i) => s + i.totalLectures, 0);
  const totalInstructorExpense = instructorEarnings.reduce((s, i) => s + i.totalEarned, 0);
  const avgCostPerClass = totalClassesConducted > 0 ? Math.round(totalInstructorExpense / totalClassesConducted) : 0;

  return res.json({
    totalStudents: allStudents.length,
    activeStudents: activeStudents.length,
    monthlyExpectedFees,
    totalCourseFees,
    totalCollected,
    totalRemainingBalance,
    totalTeacherPayments,
    instituteProfit,
    totalFeeGenerated,
    totalReceived: totalReceiptsPaid,
    totalPending: totalRemainingBalance,
    paidVouchers: allVouchers.filter(v => v.status === "paid").length,
    partialVouchers: allVouchers.filter(v => v.status === "partial").length,
    unpaidVouchers: allVouchers.filter(v => v.status === "unpaid").length,
    recentReceipts,
    courseBreakdown,
    batchBreakdown,
    instructorEarnings,
    totalClassesConducted,
    totalInstructorExpense,
    avgCostPerClass,
  });
});

// GET /reports/monthly
router.get("/reports/monthly", async (req, res) => {
  const { month, year, courseId, course } = req.query as Record<string, string>;
  if (!month || !year) {
    return res.status(400).json({ error: "bad_request", message: "month and year are required" });
  }

  const conditions: SQL[] = [eq(vouchersTable.month, Number(month)), eq(vouchersTable.year, Number(year))];

  const rows = await db
    .select({ voucher: vouchersTable, student: studentsTable })
    .from(vouchersTable)
    .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
    .where(and(...conditions));

  let filtered = rows;
  if (courseId) filtered = rows.filter((r) => r.student.courseId === Number(courseId));
  else if (course) filtered = rows.filter((r) => r.student.course === course);

  const vouchers = filtered.map(({ voucher, student }) => toVoucherSimple(voucher, student));

  return res.json({
    month: Number(month),
    year: Number(year),
    monthName: MONTH_NAMES[Number(month) - 1],
    course: course ?? null,
    totalStudents: vouchers.length,
    totalFeeGenerated: vouchers.reduce((s, v) => s + v.totalFee, 0),
    totalReceived: vouchers.reduce((s, v) => s + v.totalReceived, 0),
    totalPending: vouchers.reduce((s, v) => s + v.pendingAmount, 0),
    paidCount: vouchers.filter((v) => v.status === "paid").length,
    partialCount: vouchers.filter((v) => v.status === "partial").length,
    unpaidCount: vouchers.filter((v) => v.status === "unpaid").length,
    vouchers,
  });
});

// GET /reports/class-wise
router.get("/reports/class-wise", async (req, res) => {
  const { month, year } = req.query as Record<string, string>;

  let voucherConditions: SQL[] = [];
  if (month) voucherConditions.push(eq(vouchersTable.month, Number(month)));
  if (year) voucherConditions.push(eq(vouchersTable.year, Number(year)));

  const allRows = await db
    .select({ voucher: vouchersTable, student: studentsTable })
    .from(vouchersTable)
    .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
    .where(voucherConditions.length > 0 ? and(...voucherConditions) : undefined);

  const allStudents = await db.select().from(studentsTable);
  const allCourses = await db.select().from(coursesTable);

  const result = allCourses.map((course) => {
    const courseStudents = allStudents.filter((s) => s.courseId === course.id);
    const courseVouchers = allRows.filter((r) => r.student.courseId === course.id).map((r) => r.voucher);
    return buildClassReport(course.name, course.id, courseStudents.length, courseVouchers);
  });

  return res.json(result);
});

// GET /reports/student-wise
router.get("/reports/student-wise", async (req, res) => {
  const { courseId, course, month, year, status } = req.query as Record<string, string>;

  let voucherConditions: SQL[] = [];
  if (month) voucherConditions.push(eq(vouchersTable.month, Number(month)));
  if (year) voucherConditions.push(eq(vouchersTable.year, Number(year)));

  const rows = await db
    .select({ voucher: vouchersTable, student: studentsTable })
    .from(vouchersTable)
    .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
    .where(voucherConditions.length > 0 ? and(...voucherConditions) : undefined);

  let filtered = rows;
  if (courseId) filtered = filtered.filter((r) => r.student.courseId === Number(courseId));
  else if (course) filtered = filtered.filter((r) => r.student.course === course);

  const studentMap = new Map<number, { student: typeof studentsTable.$inferSelect; totalFee: number; totalReceived: number; totalPending: number }>();
  for (const { voucher, student } of filtered) {
    const e = studentMap.get(student.id) ?? { student, totalFee: 0, totalReceived: 0, totalPending: 0 };
    e.totalFee += parseFloat(voucher.totalFee as string);
    e.totalReceived += parseFloat(voucher.totalReceived as string);
    e.totalPending += parseFloat(voucher.pendingAmount as string);
    studentMap.set(student.id, e);
  }

  let result = Array.from(studentMap.values()).map(({ student, totalFee, totalReceived, totalPending }) => ({
    studentId: student.id,
    studentName: student.name,
    studentCode: student.studentCode,
    rollNumber: student.studentCode,
    course: student.course,
    totalFee,
    totalReceived,
    totalPending,
    status: totalPending <= 0 ? "paid" : totalReceived > 0 ? "partial" : "unpaid",
  }));

  if (status) result = result.filter((r) => r.status === status);
  return res.json(result);
});

// GET /reports/receipts
router.get("/reports/receipts", async (req, res) => {
  const { month, year, courseId, course } = req.query as Record<string, string>;

  const rows = await db
    .select({ receipt: receiptsTable, student: studentsTable, voucher: vouchersTable })
    .from(receiptsTable)
    .innerJoin(studentsTable, eq(receiptsTable.studentId, studentsTable.id))
    .innerJoin(vouchersTable, eq(receiptsTable.voucherId, vouchersTable.id))
    .orderBy(receiptsTable.paymentDate);

  let filtered = rows;
  if (month) filtered = filtered.filter((r) => r.voucher.month === Number(month));
  if (year) filtered = filtered.filter((r) => r.voucher.year === Number(year));
  if (courseId) filtered = filtered.filter((r) => r.student.courseId === Number(courseId));
  else if (course) filtered = filtered.filter((r) => r.student.course === course);

  return res.json(filtered.map(({ receipt, student, voucher }) => ({
    receiptNumber: receipt.receiptNumber,
    studentName: student.name,
    studentCode: student.studentCode,
    course: student.course,
    month: voucher.month,
    year: voucher.year,
    monthName: MONTH_NAMES[voucher.month - 1],
    amountReceived: parseFloat(receipt.amountReceived as string),
    paymentMethod: receipt.paymentMethod,
    paymentDate: receipt.paymentDate,
    remarks: receipt.remarks ?? undefined,
  })));
});

// GET /reports/instructor-earnings
router.get("/reports/instructor-earnings", async (req, res) => {
  const { year, month, courseId, paymentModel } = req.query as Record<string, string>;

  if (!year) {
    return res.status(400).json({ error: "bad_request", message: "year is required" });
  }

  const yr = Number(year);
  const mo = month ? Number(month) : undefined;

  // Load all instructors (optionally filtered)
  let instructors = await db.select().from(instructorsTable);
  if (courseId) instructors = instructors.filter((i) => i.courseId === Number(courseId));
  if (paymentModel) instructors = instructors.filter((i) => i.paymentModel === paymentModel);

  const instructorIds = instructors.map((i) => i.id);
  if (instructorIds.length === 0) return res.json([]);

  // Load attendance records for these instructors in this year
  const allAttendance = await db.select().from(instructorAttendanceTable);
  const attendByInstructor = new Map<number, typeof instructorAttendanceTable.$inferSelect[]>();
  for (const a of allAttendance) {
    if (!instructorIds.includes(a.instructorId)) continue;
    const aYear = Number(a.attendanceDate.slice(0, 4));
    const aMo = Number(a.attendanceDate.slice(5, 7));
    if (aYear !== yr) continue;
    if (mo !== undefined && aMo !== mo) continue;
    const list = attendByInstructor.get(a.instructorId) ?? [];
    list.push(a);
    attendByInstructor.set(a.instructorId, list);
  }

  // Load payments for these instructors in this year
  const allPayments = await db.select().from(instructorPaymentsTable);
  const payByInstructor = new Map<number, typeof instructorPaymentsTable.$inferSelect[]>();
  for (const p of allPayments) {
    if (!instructorIds.includes(p.instructorId)) continue;
    if (p.year !== yr) continue;
    if (mo !== undefined && p.month !== mo) continue;
    const list = payByInstructor.get(p.instructorId) ?? [];
    list.push(p);
    payByInstructor.set(p.instructorId, list);
  }

  // Load course revenue for commission model (total received from student vouchers per course)
  const courseRevenueMap = new Map<number, Map<string, number>>(); // courseId → "YYYY-MM" → revenue
  const commissionInstructors = instructors.filter((i) => i.paymentModel === "commission" && i.courseId);
  if (commissionInstructors.length > 0) {
    const allVouchers = await db
      .select({ voucher: vouchersTable, student: studentsTable })
      .from(vouchersTable)
      .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id));
    for (const { voucher, student } of allVouchers) {
      if (!student.courseId) continue;
      if (voucher.year !== yr) continue;
      if (mo !== undefined && voucher.month !== mo) continue;
      const key = `${voucher.year}-${String(voucher.month).padStart(2, "0")}`;
      const map = courseRevenueMap.get(student.courseId) ?? new Map<string, number>();
      map.set(key, (map.get(key) ?? 0) + parseFloat(voucher.totalReceived as string));
      courseRevenueMap.set(student.courseId, map);
    }
  }

  // Determine which months to iterate over
  const months = mo !== undefined ? [mo] : Array.from({ length: 12 }, (_, i) => i + 1);

  const result = instructors.map((instructor) => {
    const attendList = attendByInstructor.get(instructor.id) ?? [];
    const payList = payByInstructor.get(instructor.id) ?? [];
    const lectureRateVal = parseFloat(instructor.lectureRate as string);
    const commPct = parseFloat(instructor.commissionPercent as string);
    const monthlySalaryVal = parseFloat(instructor.monthlySalary as string);

    const monthRows = months.map((m) => {
      const monthKey = `${yr}-${String(m).padStart(2, "0")}`;
      const monthAttend = attendList.filter((a) => Number(a.attendanceDate.slice(5, 7)) === m);
      const monthPay = payList.filter((p) => p.month === m);

      const lecturesDelivered = monthAttend.reduce((s, a) => s + (a.lectureCount ?? 1), 0);
      const paid = monthPay.reduce((s, p) => s + parseFloat(p.amountPaid as string), 0);

      let earned = 0;
      if (instructor.paymentModel === "per_lecture") {
        earned = lecturesDelivered * lectureRateVal;
      } else if (instructor.paymentModel === "salary") {
        earned = monthlySalaryVal;
      } else if (instructor.paymentModel === "commission" && instructor.courseId) {
        const rev = courseRevenueMap.get(instructor.courseId)?.get(monthKey) ?? 0;
        earned = rev * (commPct / 100);
      }

      return {
        month: m,
        year: yr,
        monthName: MONTH_NAMES[m - 1],
        lecturesDelivered,
        earned,
        paid,
        balance: Math.max(0, earned - paid),
      };
    }).filter((row) => {
      // For salary, always show the month; for others, only show months with activity
      if (instructor.paymentModel === "salary") return true;
      return row.earned > 0 || row.paid > 0 || row.lecturesDelivered > 0;
    });

    const totalLectures = monthRows.reduce((s, r) => s + r.lecturesDelivered, 0);
    const totalEarned = monthRows.reduce((s, r) => s + r.earned, 0);
    const totalPaid = monthRows.reduce((s, r) => s + r.paid, 0);

    return {
      instructorId: instructor.id,
      instructorCode: instructor.instructorCode,
      instructorName: instructor.name,
      courseName: instructor.courseName ?? null,
      paymentModel: instructor.paymentModel,
      lectureRate: lectureRateVal,
      commissionPercent: commPct,
      monthlySalary: monthlySalaryVal,
      status: instructor.status,
      months: monthRows,
      totalLectures,
      totalEarned,
      totalPaid,
      totalBalance: Math.max(0, totalEarned - totalPaid),
    };
  });

  // Summary totals
  const summary = {
    totalInstructors: result.length,
    totalEarned: result.reduce((s, r) => s + r.totalEarned, 0),
    totalPaid: result.reduce((s, r) => s + r.totalPaid, 0),
    totalBalance: result.reduce((s, r) => s + r.totalBalance, 0),
  };

  return res.json({ summary, instructors: result });
});

function buildClassReport(course: string, courseId: number, totalStudents: number, vouchers: typeof vouchersTable.$inferSelect[]) {
  return {
    course,
    courseId,
    totalStudents,
    totalFeeGenerated: vouchers.reduce((s, v) => s + parseFloat(v.totalFee as string), 0),
    totalReceived: vouchers.reduce((s, v) => s + parseFloat(v.totalReceived as string), 0),
    totalPending: vouchers.reduce((s, v) => s + parseFloat(v.pendingAmount as string), 0),
    paidCount: vouchers.filter((v) => v.status === "paid").length,
    partialCount: vouchers.filter((v) => v.status === "partial").length,
    unpaidCount: vouchers.filter((v) => v.status === "unpaid").length,
  };
}

function toVoucherSimple(v: typeof vouchersTable.$inferSelect, s: typeof studentsTable.$inferSelect) {
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
    receipts: [],
  };
}

function toReceiptResponse(
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
