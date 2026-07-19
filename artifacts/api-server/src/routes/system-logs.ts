import { Router } from "express";
import { desc, and, gte, lte, like, or } from "drizzle-orm";
import { db, systemLogsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// GET /system-logs — admin only
router.get("/system-logs", requireAdmin, async (req, res) => {
  const { from, to, search, action, entityType } = req.query as Record<string, string>;

  const conditions = [];
  if (from) conditions.push(gte(systemLogsTable.createdAt, new Date(from)));
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(systemLogsTable.createdAt, end));
  }
  if (action && action !== "all") conditions.push(like(systemLogsTable.action, `%${action}%`));
  if (entityType && entityType !== "all") conditions.push(like(systemLogsTable.entityType!, `%${entityType}%`));
  if (search) {
    conditions.push(
      or(
        like(systemLogsTable.description, `%${search}%`),
        like(systemLogsTable.performedByName!, `%${search}%`),
      )!
    );
  }

  const rows = await db
    .select()
    .from(systemLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemLogsTable.createdAt))
    .limit(500);

  return res.json(rows.map(r => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType ?? null,
    entityId: r.entityId ?? null,
    description: r.description,
    performedBy: r.performedBy ?? null,
    performedByName: r.performedByName ?? null,
    role: r.role ?? null,
    ipAddress: r.ipAddress ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
