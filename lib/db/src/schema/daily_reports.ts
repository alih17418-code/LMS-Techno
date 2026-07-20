import { pgTable, serial, integer, date, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { interneesTable } from "./internees";

export const dailyReportsTable = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  interneeId: integer("internee_id").notNull().references(() => interneesTable.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  tasksCompleted: text("tasks_completed").notNull(),
  workSummary: text("work_summary").notNull(),
  problemsFaced: text("problems_faced"),
  learnings: text("learnings"),
  hoursWorked: numeric("hours_worked"),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
