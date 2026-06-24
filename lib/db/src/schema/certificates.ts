import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  certificateNumber: text("certificate_number").notNull().unique(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
  studentName: text("student_name").notNull(),
  studentCode: text("student_code").notNull(),
  courseName: text("course_name").notNull(),
  issuedDate: date("issued_date").notNull(),
  isValid: text("is_valid").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Certificate = typeof certificatesTable.$inferSelect;
