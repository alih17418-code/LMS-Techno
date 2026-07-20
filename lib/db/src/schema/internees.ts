import { pgTable, serial, text, integer, date, timestamp, numeric } from "drizzle-orm/pg-core";

export const interneesTable = pgTable("internees", {
  id: serial("id").primaryKey(),
  interneeCode: text("internee_code").notNull().unique(),
  name: text("name").notNull(),
  fatherName: text("father_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  department: text("department"),
  position: text("position"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: text("status").notNull().default("active"),
  attendanceMode: text("attendance_mode").notNull().default("hourly"),
  requiredHours: numeric("required_hours").notNull().default("5"),
  fixedStartTime: text("fixed_start_time"),
  fixedEndTime: text("fixed_end_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
