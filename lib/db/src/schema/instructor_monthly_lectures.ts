import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";

export const instructorMonthlyLecturesTable = pgTable("instructor_monthly_lectures", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull().references(() => instructorsTable.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  lecturesCount: integer("lectures_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.instructorId, t.month, t.year),
}));

export type InstructorMonthlyLecture = typeof instructorMonthlyLecturesTable.$inferSelect;
