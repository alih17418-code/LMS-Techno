import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { interneesTable } from "./internees";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  interneeId: integer("internee_id").references(() => interneesTable.id, { onDelete: "set null" }),
  startDate: date("start_date").notNull(),
  deadline: date("deadline"),
  status: text("status").notNull().default("active"),
  assignedBy: text("assigned_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectReportsTable = pgTable("project_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  interneeId: integer("internee_id").notNull().references(() => interneesTable.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull().default("progress"),
  content: text("content").notNull(),
  hoursWorked: text("hours_worked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
