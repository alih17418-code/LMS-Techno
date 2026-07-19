import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  description: text("description").notNull(),
  performedBy: integer("performed_by"),
  performedByName: text("performed_by_name"),
  role: text("role"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
