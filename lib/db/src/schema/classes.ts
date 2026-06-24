import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { coursesTable } from "./courses";
import { instructorsTable } from "./instructors";

export const classesTable = pgTable("classes", {
  id: serial("id").primaryKey(),
  className: text("class_name").notNull(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "restrict" }),
  courseName: text("course_name").notNull(),
  instructorId: integer("instructor_id").references(() => instructorsTable.id, { onDelete: "set null" }),
  instructorName: text("instructor_name"),
  batch: text("batch"),
  year: integer("year").notNull(),
  section: text("section"),
  semester: integer("semester"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ClassRecord = typeof classesTable.$inferSelect;
