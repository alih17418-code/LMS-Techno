import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
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

// GET all tasks
router.get("/tasks", requireAuth, async (req, res) => {
  const role = (req.session as any).role;
  const interneeId = (req.session as any).interneeId;
  let list;
  if (["admin", "staff"].includes(role)) {
    list = await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
  } else {
    list = await db.select().from(tasksTable).where(eq(tasksTable.interneeId, interneeId)).orderBy(desc(tasksTable.createdAt));
  }
  res.json(list);
});

// GET tasks for internee
router.get("/internees/:id/tasks", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.select().from(tasksTable).where(eq(tasksTable.interneeId, id)).orderBy(desc(tasksTable.createdAt));
  res.json(list);
});

// POST create task
router.post("/tasks", requireStaff, async (req, res) => {
  const { title, description, interneeId, priority, assignedDate, dueDate, assignedBy } = req.body;
  if (!title || !assignedDate) return res.status(400).json({ error: "Title and assigned date are required" });
  const [created] = await db.insert(tasksTable).values({
    title, description: description || null,
    interneeId: interneeId ? Number(interneeId) : null,
    priority: priority || "medium", assignedDate, dueDate: dueDate || null,
    status: "todo", assignedBy: assignedBy || (req.session as any).displayName || null,
  }).returning();
  res.status(201).json(created);
});

// PATCH update task (intern can update status/comments; staff can update all)
router.patch("/tasks/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = (req.session as any).role;
  const { title, description, interneeId, priority, dueDate, status, comments } = req.body;

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (comments !== undefined) updates.comments = comments;
  if (["admin", "staff"].includes(role)) {
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (interneeId !== undefined) updates.interneeId = interneeId ? Number(interneeId) : null;
    if (priority !== undefined) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = dueDate;
  }

  const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// DELETE task
router.delete("/tasks/:id", requireStaff, async (req, res) => {
  await db.delete(tasksTable).where(eq(tasksTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
