import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectReportsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

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

// GET all projects
router.get("/projects", requireAuth, async (req, res) => {
  const role = (req.session as any).role;
  const interneeId = (req.session as any).interneeId;
  let list;
  if (["admin", "staff"].includes(role)) {
    list = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
  } else {
    list = await db.select().from(projectsTable).where(eq(projectsTable.interneeId, interneeId)).orderBy(desc(projectsTable.createdAt));
  }
  res.json(list);
});

// GET internee's projects
router.get("/internees/:id/projects", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.select().from(projectsTable).where(eq(projectsTable.interneeId, id)).orderBy(desc(projectsTable.createdAt));
  res.json(list);
});

// POST create project
router.post("/projects", requireStaff, async (req, res) => {
  const { name, description, interneeId, startDate, deadline, assignedBy } = req.body;
  if (!name || !startDate) return res.status(400).json({ error: "Name and start date are required" });
  const [created] = await db.insert(projectsTable).values({
    name, description: description || null,
    interneeId: interneeId ? Number(interneeId) : null,
    startDate, deadline: deadline || null, status: "active",
    assignedBy: assignedBy || (req.session as any).displayName || null,
  }).returning();
  res.status(201).json(created);
});

// PATCH update project
router.patch("/projects/:id", requireStaff, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, interneeId, startDate, deadline, status } = req.body;
  const [updated] = await db.update(projectsTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(interneeId !== undefined && { interneeId: interneeId ? Number(interneeId) : null }),
    ...(startDate !== undefined && { startDate }),
    ...(deadline !== undefined && { deadline }),
    ...(status !== undefined && { status }),
  }).where(eq(projectsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// DELETE project
router.delete("/projects/:id", requireStaff, async (req, res) => {
  await db.delete(projectsTable).where(eq(projectsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ── Project Reports ──

// GET reports for a project
router.get("/projects/:id/reports", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.select().from(projectReportsTable)
    .where(eq(projectReportsTable.projectId, id))
    .orderBy(desc(projectReportsTable.createdAt));
  res.json(list);
});

// GET all project reports for an internee
router.get("/internees/:id/project-reports", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.select().from(projectReportsTable)
    .where(eq(projectReportsTable.interneeId, id))
    .orderBy(desc(projectReportsTable.createdAt));
  res.json(list);
});

// POST create project report
router.post("/projects/:id/reports", requireAuth, async (req, res) => {
  const projectId = Number(req.params.id);
  const interneeId = (req.session as any).interneeId;
  const role = (req.session as any).role;
  const { reportType, content, hoursWorked } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });
  const actualInterneeId = ["admin", "staff"].includes(role) ? req.body.interneeId : interneeId;
  const [created] = await db.insert(projectReportsTable).values({
    projectId, interneeId: Number(actualInterneeId), reportType: reportType || "progress",
    content, hoursWorked: hoursWorked || null,
  }).returning();
  res.status(201).json(created);
});

// DELETE project report
router.delete("/project-reports/:id", requireStaff, async (req, res) => {
  await db.delete(projectReportsTable).where(eq(projectReportsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
