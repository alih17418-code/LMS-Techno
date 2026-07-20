import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { createHash } from "crypto";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { syslog } from "../lib/syslog";

const router = Router();

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain + "tips_salt_2024").digest("hex");
}

async function ensureDefaultAdmin() {
  const count = await db.$count(usersTable);
  if (count === 0) {
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash: hashPassword("admin123"),
      role: "admin",
      displayName: "Administrator",
    });
  }
}
ensureDefaultAdmin().catch(() => {});

function toUserResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    instructorId: user.instructorId ?? undefined,
  };
}

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, String(username).toLowerCase().trim()));

  if (!user || user.passwordHash !== hashPassword(String(password))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  if (user.isActive !== "true") {
    return res.status(403).json({ error: "Account is disabled" });
  }

  (req as any).session.userId = user.id;
  (req as any).session.role = user.role;
  (req as any).session.displayName = user.displayName;
  (req as any).session.instructorId = user.instructorId ?? null;

  syslog({ action: "login", entityType: "auth", entityId: user.id, description: `${user.displayName} (${user.role}) logged in`, req }).catch(() => {});
  return res.json(toUserResponse(user));
});

// POST /auth/logout
router.post("/auth/logout", (req, res) => {
  const session = (req as any).session;
  syslog({ action: "logout", entityType: "auth", entityId: session?.userId, description: `${session?.displayName ?? "Unknown"} logged out`, req }).catch(() => {});
  session.destroy(() => {});
  return res.json({ ok: true });
});

// GET /auth/me
router.get("/auth/me", async (req, res) => {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return res.status(401).json({ error: "User not found" });

  return res.json(toUserResponse(user));
});

// GET /auth/users — admin only
router.get("/auth/users", requireAdmin, async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    role: usersTable.role,
    displayName: usersTable.displayName,
    instructorId: usersTable.instructorId,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  return res.json(users);
});

// POST /auth/users — admin only
router.post("/auth/users", requireAdmin, async (req, res) => {
  const { username, password, role, displayName, instructorId } = req.body;
  if (!username || !password || !role || !displayName) {
    return res.status(400).json({ error: "All fields required" });
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, String(username).toLowerCase().trim()));
  if (existing) return res.status(400).json({ error: "Username already exists" });

  const [user] = await db.insert(usersTable).values({
    username: String(username).toLowerCase().trim(),
    passwordHash: hashPassword(String(password)),
    role: String(role),
    displayName: String(displayName).trim(),
    instructorId: instructorId ? Number(instructorId) : null,
  }).returning();

  return res.status(201).json({
    id: user.id, username: user.username, role: user.role,
    displayName: user.displayName, instructorId: user.instructorId ?? undefined,
    isActive: user.isActive,
  });
});

// PUT /auth/users/:id — admin only
router.put("/auth/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { displayName, role, isActive, password, instructorId } = req.body;
  const update: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) update.displayName = String(displayName).trim();
  if (role !== undefined) update.role = String(role);
  if (isActive !== undefined) update.isActive = String(isActive);
  if (password) update.passwordHash = hashPassword(String(password));
  if (instructorId !== undefined) update.instructorId = instructorId ? Number(instructorId) : null;

  const [updated] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "User not found" });

  return res.json({
    id: updated.id, username: updated.username, role: updated.role,
    displayName: updated.displayName, instructorId: updated.instructorId ?? undefined,
    isActive: updated.isActive,
  });
});

// DELETE /auth/users/:id — admin only
router.delete("/auth/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  return res.status(204).send();
});

export default router;
