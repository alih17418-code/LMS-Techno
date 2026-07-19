import { db, systemLogsTable } from "@workspace/db";
import type { Request } from "express";

interface LogOptions {
  action: string;
  entityType?: string;
  entityId?: number;
  description: string;
  req?: Request;
}

export async function syslog(opts: LogOptions): Promise<void> {
  try {
    const session = (opts.req?.session as any) ?? {};
    await db.insert(systemLogsTable).values({
      action: opts.action,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      description: opts.description,
      performedBy: session.userId ?? null,
      performedByName: session.displayName ?? null,
      role: session.role ?? null,
      ipAddress: opts.req?.ip ?? null,
    });
  } catch {
    // never throw — logging must not break the main flow
  }
}
