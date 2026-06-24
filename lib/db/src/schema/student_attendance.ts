import { pgTable, serial, integer, date, text, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { classesTable } from "./classes";
import { instructorsTable } from "./instructors";

export const studentAttendanceTable = pgTable("student_attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: text("status").notNull().default("present"), // present | absent | late
  markedBy: integer("marked_by").references(() => instructorsTable.id, { onDelete: "set null" }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StudentAttendance = typeof studentAttendanceTable.$inferSelect;
