import { pgTable, serial, text, date, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  name: text("name").notNull(),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "restrict" }),
  course: text("course").notNull(),
  classId: integer("class_id"),
  className: text("class_name"),
  fatherName: text("father_name"),
  phone: text("phone"),
  address: text("address"),
  status: text("status").notNull().default("active"), // active | inactive | completed
  enrollmentDate: date("enrollment_date").notNull(),
  batchStartDate: date("batch_start_date"),
  endDate: date("end_date"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  // Opening balance (migration/historical data)
  openingPaidAmount: numeric("opening_paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  openingPendingAmount: numeric("opening_pending_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  openingPresentDays: integer("opening_present_days").notNull().default(0),
  openingAbsentDays: integer("opening_absent_days").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
  studentCode: true,
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
