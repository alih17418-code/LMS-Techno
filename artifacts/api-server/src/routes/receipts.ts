import { Router } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, studentsTable, vouchersTable, receiptsTable } from "@workspace/db";

const router = Router();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// GET /receipts
router.get("/receipts", async (req, res) => {
  const { voucherId, studentId, month, year } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (voucherId) conditions.push(eq(receiptsTable.voucherId, Number(voucherId)));
  if (studentId) conditions.push(eq(receiptsTable.studentId, Number(studentId)));

  const rows = await db
    .select({ receipt: receiptsTable, student: studentsTable, voucher: vouchersTable })
    .from(receiptsTable)
    .innerJoin(studentsTable, eq(receiptsTable.studentId, studentsTable.id))
    .innerJoin(vouchersTable, eq(receiptsTable.voucherId, vouchersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(receiptsTable.paymentDate);

  let filtered = rows;
  if (month) filtered = filtered.filter((r) => r.voucher.month === Number(month));
  if (year) filtered = filtered.filter((r) => r.voucher.year === Number(year));

  return res.json(filtered.map(({ receipt, student, voucher }) =>
    toReceiptResponse(receipt, student, voucher)
  ));
});

// POST /receipts
router.post("/receipts", async (req, res) => {
  const { voucherId, amountReceived, paymentMethod, remarks, paymentDate } = req.body;

  if (!voucherId || !amountReceived || !paymentMethod || !paymentDate) {
    return res.status(400).json({ error: "validation_error", message: "voucherId, amountReceived, paymentMethod, and paymentDate are required" });
  }

  const [row] = await db
    .select({ voucher: vouchersTable, student: studentsTable })
    .from(vouchersTable)
    .innerJoin(studentsTable, eq(vouchersTable.studentId, studentsTable.id))
    .where(eq(vouchersTable.id, Number(voucherId)));

  if (!row) return res.status(400).json({ error: "not_found", message: "Voucher not found" });

  const { voucher, student } = row;
  const pending = parseFloat(voucher.pendingAmount as string);
  const totalReceived = parseFloat(voucher.totalReceived as string);

  if (voucher.status === "paid") {
    return res.status(400).json({ error: "already_paid", message: "Voucher already settled. No further payments allowed." });
  }

  const amount = Number(amountReceived);
  if (amount > pending) {
    return res.status(400).json({
      error: "overpayment",
      message: `Payment amount (${amount}) exceeds remaining balance (${pending}).`,
    });
  }

  const receiptCount = await db.$count(receiptsTable);
  const receiptNumber = `RCP-${String(receiptCount + 1).padStart(6, "0")}`;

  const [receipt] = await db
    .insert(receiptsTable)
    .values({
      receiptNumber,
      voucherId: Number(voucherId),
      studentId: student.id,
      amountReceived: String(amount),
      paymentMethod,
      remarks: remarks ?? null,
      paymentDate,
    })
    .returning();

  const newTotalReceived = totalReceived + amount;
  const newPending = parseFloat(voucher.totalFee as string) - newTotalReceived;
  const newStatus = newPending <= 0 ? "paid" : newTotalReceived > 0 ? "partial" : "unpaid";

  await db.update(vouchersTable)
    .set({ totalReceived: String(newTotalReceived), pendingAmount: String(Math.max(0, newPending)), status: newStatus })
    .where(eq(vouchersTable.id, Number(voucherId)));

  const [updatedVoucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, Number(voucherId)));

  return res.status(201).json(toReceiptResponse(receipt, student, updatedVoucher));
});

// GET /receipts/:id
router.get("/receipts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ receipt: receiptsTable, student: studentsTable, voucher: vouchersTable })
    .from(receiptsTable)
    .innerJoin(studentsTable, eq(receiptsTable.studentId, studentsTable.id))
    .innerJoin(vouchersTable, eq(receiptsTable.voucherId, vouchersTable.id))
    .where(eq(receiptsTable.id, id));

  if (!row) return res.status(404).json({ error: "not_found", message: "Receipt not found" });
  return res.json(toReceiptResponse(row.receipt, row.student, row.voucher));
});

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
