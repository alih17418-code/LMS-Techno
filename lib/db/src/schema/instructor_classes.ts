import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";
import { classesTable } from "./classes";

export const instructorClassesTable = pgTable("instructor_classes", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull().references(() => instructorsTable.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.instructorId, t.classId),
}));

export type InstructorClass = typeof instructorClassesTable.$inferSelect;
