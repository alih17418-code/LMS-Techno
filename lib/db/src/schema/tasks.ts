import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { interneesTable } from "./internees";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  interneeId: integer("internee_id").references(() => interneesTable.id, { onDelete: "set null" }),
  priority: text("priority").notNull().default("medium"),
  assignedDate: date("assigned_date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("todo"),
  assignedBy: text("assigned_by"),
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
