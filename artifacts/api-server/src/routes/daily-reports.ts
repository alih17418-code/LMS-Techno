import { Router } from "express";
import { db } from "@workspace/db";
import { dailyReportsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}
function requireStaff(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "staff"].includes((req.session as any).role ?? "")) return res.status(403).json({ error: "Forbidden" });
  next();
}

// GET all daily reports (admin/staff)
router.get("/daily-reports", requireStaff, async (req, res) => {
  const list = await db.select().from(dailyReportsTable).orderBy(desc(dailyReportsTable.reportDate));
  res.json(list);
});

// GET reports for an internee
router.get("/internees/:id/daily-reports", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = (req.session as any).role;
  const interneeId = (req.session as any).interneeId;
  if (role === "internee" && interneeId !== id) return res.status(403).json({ error: "Forbidden" });
  const list = await db.select().from(dailyReportsTable)
    .where(eq(dailyReportsTable.interneeId, id))
    .orderBy(desc(dailyReportsTable.reportDate));
  res.json(list);
});

// POST create report
router.post("/internees/:id/daily-reports", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = (req.session as any).role;
  const sessionInterneeId = (req.session as any).interneeId;
  if (role === "internee" && sessionInterneeId !== id) return res.status(403).json({ error: "Forbidden" });

  const { reportDate, tasksCompleted, workSummary, problemsFaced, learnings, hoursWorked } = req.body;
  if (!reportDate || !tasksCompleted || !workSummary) {
    return res.status(400).json({ error: "reportDate, tasksCompleted, and workSummary are required" });
  }
  // Check for duplicate
  const existing = await db.select().from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.interneeId, id), eq(dailyReportsTable.reportDate, reportDate)));
  if (existing.length > 0) return res.status(400).json({ error: "Report for this date already exists" });

  const [created] = await db.insert(dailyReportsTable).values({
    interneeId: id, reportDate, tasksCompleted, workSummary,
    problemsFaced: problemsFaced || null, learnings: learnings || null,
    hoursWorked: hoursWorked || null, status: "submitted",
  }).returning();
  res.status(201).json(created);
});

// PATCH update report
router.patch("/daily-reports/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { tasksCompleted, workSummary, problemsFaced, learnings, hoursWorked } = req.body;
  const [updated] = await db.update(dailyReportsTable).set({
    ...(tasksCompleted !== undefined && { tasksCompleted }),
    ...(workSummary !== undefined && { workSummary }),
    ...(problemsFaced !== undefined && { problemsFaced }),
    ...(learnings !== undefined && { learnings }),
    ...(hoursWorked !== undefined && { hoursWorked }),
    updatedAt: new Date(),
  }).where(eq(dailyReportsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// DELETE report
router.delete("/daily-reports/:id", requireStaff, async (req, res) => {
  await db.delete(dailyReportsTable).where(eq(dailyReportsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
