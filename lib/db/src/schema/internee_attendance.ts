import { pgTable, serial, integer, date, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { interneesTable } from "./internees";

export const interneeAttendanceTable = pgTable("internee_attendance", {
  id: serial("id").primaryKey(),
  interneeId: integer("internee_id").notNull().references(() => interneesTable.id, { onDelete: "cascade" }),
  interneeName: text("internee_name").notNull(),
  attendanceDate: date("attendance_date").notNull(),
  checkInTime: text("check_in_time"),
  checkOutTime: text("check_out_time"),
  totalHours: numeric("total_hours"),
  dailyReportSubmitted: boolean("daily_report_submitted").notNull().default(false),
  status: text("status").notNull().default("present"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
