import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, certificatesTable, studentsTable, vouchersTable, coursesTable } from "@workspace/db";

const router = Router();

async function generateCertNumber(): Promise<string> {
  const count = await db.$count(certificatesTable);
  return `TIPS-CERT-${String(2024 + Math.floor(count / 100)).slice(-4)}-${String(10001 + count).slice(-5)}`;
}

// GET /certificates
router.get("/certificates", async (req, res) => {
  const { studentId } = req.query as Record<string, string>;
  let rows = await db
    .select({ cert: certificatesTable })
    .from(certificatesTable)
    .orderBy(certificatesTable.createdAt);

  if (studentId) rows = rows.filter((r) => r.cert.studentId === Number(studentId));

  return res.json(rows.map((r) => toCert(r.cert)));
});

// POST /certificates — issue certificate
router.post("/certificates", async (req, res) => {
  const { studentId, issuedDate } = req.body;
  if (!studentId) return res.status(400).json({ error: "studentId is required" });

  // Get student
  const [row] = await db
    .select({ student: studentsTable, course: coursesTable })
    .from(studentsTable)
    .leftJoin(coursesTable, eq(studentsTable.courseId, coursesTable.id))
    .where(eq(studentsTable.id, Number(studentId)));
  if (!row) return res.status(404).json({ error: "Student not found" });

  // Check no pending fees
  const vouchers = await db
    .select()
    .from(vouchersTable)
    .where(and(eq(vouchersTable.studentId, Number(studentId))));

  const totalPending = vouchers.reduce((s, v) => s + parseFloat(v.pendingAmount as string), 0);
  if (totalPending > 0) {
    return res.status(400).json({
      error: "pending_fees",
      message: `Student must clear all dues before certificate issuance. Pending: PKR ${totalPending.toLocaleString()}`,
    });
  }

  // Check for duplicate
  const [existingCert] = await db
    .select()
    .from(certificatesTable)
    .where(and(eq(certificatesTable.studentId, Number(studentId)), eq(certificatesTable.isValid, "true")));
  if (existingCert) {
    return res.status(400).json({ error: "Certificate already issued", certificateNumber: existingCert.certificateNumber });
  }

  const certNumber = await generateCertNumber();
  const today = issuedDate ?? new Date().toISOString().slice(0, 10);

  const [cert] = await db.insert(certificatesTable).values({
    certificateNumber: certNumber,
    studentId: Number(studentId),
    studentName: row.student.name,
    studentCode: row.student.studentCode,
    courseName: row.student.course,
    issuedDate: today,
  }).returning();

  return res.status(201).json(toCert(cert));
});

// GET /certificates/verify/:number — public verification
router.get("/certificates/verify/:number", async (req, res) => {
  const certNumber = req.params.number;
  const [cert] = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.certificateNumber, certNumber));

  if (!cert) return res.status(404).json({ error: "Certificate not found" });
  return res.json({ ...toCert(cert), verified: true });
});

// GET /certificates/:id
router.get("/certificates/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, id));
  if (!cert) return res.status(404).json({ error: "Certificate not found" });
  return res.json(toCert(cert));
});

// DELETE /certificates/:id — revoke
router.delete("/certificates/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(certificatesTable)
    .set({ isValid: "false" })
    .where(eq(certificatesTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(toCert(updated));
});

function toCert(c: typeof certificatesTable.$inferSelect) {
  return {
    id: c.id,
    certificateNumber: c.certificateNumber,
    studentId: c.studentId,
    studentName: c.studentName,
    studentCode: c.studentCode,
    courseName: c.courseName,
    issuedDate: c.issuedDate,
    isValid: c.isValid === "true",
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
