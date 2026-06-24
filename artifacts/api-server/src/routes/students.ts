import { Router } from "express";
import { eq, ilike, and, or, type SQL } from "drizzle-orm";
import { db, studentsTable, coursesTable, vouchersTable } from "@workspace/db";

const router = Router();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Auto-generate next student code (100001, 100002, ...)
async function generateStudentCode(): Promise<string> {
  const count = await db.$count(studentsTable);
  return String(100001 + count);
}

// Calculate end date from enrollment date + durationMonths
function calcEndDate(enrollmentDate: string, durationMonths: number): string {
  const d = new Date(enrollmentDate);
  d.setMonth(d.getMonth() + durationMonths);
  return d.toISOString().slice(0, 10);
}

// GET /students
router.get("/students", async (req, res) => {
  const { courseId, course, status, search } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (courseId) conditions.push(eq(studentsTable.courseId, Number(courseId)));
  if (course) conditions.push(eq(studentsTable.course, course));
  if (status) conditions.push(eq(studentsTable.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(studentsTable.name, `%${search}%`),
        ilike(studentsTable.studentCode, `%${search}%`),
        ilike(studentsTable.phone as any, `%${search}%`)
      ) as SQL
    );
  }

  const rows = await db
    .select({ student: studentsTable, course: coursesTable })
    .from(studentsTable)
    .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(studentsTable.name);

  return res.json(rows.map(({ student, course }) => toStudentResponse(student, course)));
});

// POST /students
router.post("/students", async (req, res) => {
  const { name, courseId, fatherName, phone, address, status, enrollmentDate, discountAmount } = req.body;

  if (!name || !courseId || !enrollmentDate) {
    return res.status(400).json({ error: "validation_error", message: "name, courseId, and enrollmentDate are required" });
  }

  // Fetch course
  const [courseRow] = await db.select().from(coursesTable).where(eq(coursesTable.id, Number(courseId)));
  if (!courseRow) {
    return res.status(400).json({ error: "not_found", message: "Course not found" });
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
      fatherName: fatherName ?? null,
      phone: phone ?? null,
      address: address ?? null,
      status: status ?? "active",
      enrollmentDate,
      endDate,
      discountAmount: String(discountAmount ?? "0"),
    })
    .returning();

  return res.status(201).json(toStudentResponse(student, courseRow));
});

// GET /students/:id
router.get("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ student: studentsTable, course: coursesTable })
    .from(studentsTable)
    .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
    .where(eq(studentsTable.id, id));

  if (!row) return res.status(404).json({ error: "not_found", message: "Student not found" });
  return res.json(toStudentResponse(row.student, row.course));
});

// PUT /students/:id
router.put("/students/:id", async (req, res) => {
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

  // If courseId or enrollmentDate changed, recalculate endDate
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

// DELETE /students/:id
router.delete("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!existing) return res.status(404).json({ error: "not_found", message: "Student not found" });
  try {
    await db.delete(studentsTable).where(eq(studentsTable.id, id));
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === "23503") {
      return res.status(400).json({
        error: "has_records",
        message: "Cannot delete this student — they have linked vouchers or receipts. Delete those first, or mark the student as inactive instead.",
      });
    }
    throw err;
  }
});

// GET /students/:id/ledger
router.get("/students/:id/ledger", async (req, res) => {
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

  return res.json({
    student: toStudentResponse(row.student, row.course),
    entries,
    totalFee: entries.reduce((s, e) => s + e.fee, 0),
    totalReceived: entries.reduce((s, e) => s + e.received, 0),
    totalPending: entries.reduce((s, e) => s + e.pending, 0),
  });
});

export function toStudentResponse(
  s: typeof studentsTable.$inferSelect,
  c: typeof coursesTable.$inferSelect | null | undefined
) {
  const discount = parseFloat(s.discountAmount as string ?? "0");
  const monthlyFee = c ? parseFloat(c.monthlyFee as string) : 0;
  const durationMonths = c ? c.durationMonths : 1;
  // discountAmount is a TOTAL discount on the whole course, spread evenly per month
  const effectiveFee = Math.max(0, (monthlyFee * durationMonths - discount) / durationMonths);
  return {
    id: s.id,
    studentCode: s.studentCode,
    name: s.name,
    course: s.course,
    courseId: s.courseId ?? undefined,
    fatherName: s.fatherName ?? undefined,
    phone: s.phone ?? undefined,
    address: s.address ?? undefined,
    status: s.status,
    enrollmentDate: s.enrollmentDate,
    endDate: s.endDate ?? undefined,
    discountAmount: discount,
    effectiveFee,
    createdAt: s.createdAt.toISOString(),
  };
}

export default router;
