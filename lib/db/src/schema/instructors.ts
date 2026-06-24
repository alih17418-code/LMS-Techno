import { pgTable, serial, text, date, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const instructorsTable = pgTable("instructors", {
  id: serial("id").primaryKey(),
  instructorCode: text("instructor_code").notNull().unique(),
  name: text("name").notNull(),
  fatherName: text("father_name"),
  phone: text("phone"),
  address: text("address"),
  specialization: text("specialization"),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  courseName: text("course_name"),
  paymentModel: text("payment_model").notNull().default("salary"),
  monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  lectureRate: numeric("lecture_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  joinDate: date("join_date").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInstructorSchema = createInsertSchema(instructorsTable).omit({
  id: true,
  createdAt: true,
  instructorCode: true,
});
export type InsertInstructor = z.infer<typeof insertInstructorSchema>;
export type Instructor = typeof instructorsTable.$inferSelect;
