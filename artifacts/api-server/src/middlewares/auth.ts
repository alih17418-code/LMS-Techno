import type { Request, Response, NextFunction } from "express";

export interface AuthSession {
  userId?: number;
  role?: string;
  displayName?: string;
  instructorId?: number | null;
}

function getSession(req: Request): AuthSession {
  return (req as any).session ?? {};
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session.userId) return res.status(401).json({ error: "Not authenticated" });
  if (session.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

export function requireAdminOrStaff(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session.userId) return res.status(401).json({ error: "Not authenticated" });
  if (session.role !== "admin" && session.role !== "staff") {
    return res.status(403).json({ error: "Admin or Staff access required" });
  }
  next();
}

export function requireNotInstructor(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session.userId) return res.status(401).json({ error: "Not authenticated" });
  if (session.role === "instructor") {
    return res.status(403).json({ error: "Instructors cannot perform this action" });
  }
  next();
}

export function getSessionUser(req: Request): AuthSession {
  return getSession(req);
}
