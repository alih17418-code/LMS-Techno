import { pgTable, serial, text, integer, date, timestamp, numeric } from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";
import { classesTable } from "./classes";

export const instructorAttendanceTable = pgTable("instructor_attendance", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull().references(() => instructorsTable.id, { onDelete: "cascade" }),
  instructorName: text("instructor_name").notNull(),
  classId: integer("class_id").references(() => classesTable.id, { onDelete: "set null" }),
  className: text("class_name"),
  shift: text("shift"),
  attendanceDate: date("attendance_date").notNull(),
  checkInTime: text("check_in_time").notNull(),
  checkOutTime: text("check_out_time"),
  lectureCount: integer("lecture_count").notNull().default(1),
  status: text("status").notNull().default("present"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InstructorAttendance = typeof instructorAttendanceTable.$inferSelect;
