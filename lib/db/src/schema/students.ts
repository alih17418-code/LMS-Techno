import { pgTable, serial, text, date, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(), // auto-generated 6-digit e.g. "100001"
  name: text("name").notNull(),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "restrict" }),
  course: text("course").notNull(), // denormalized course name for display
  fatherName: text("father_name"),
  phone: text("phone"),
  address: text("address"),
  status: text("status").notNull().default("active"), // active | inactive
  enrollmentDate: date("enrollment_date").notNull(),
  endDate: date("end_date"), // auto-calculated
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
  studentCode: true, // auto-generated
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
