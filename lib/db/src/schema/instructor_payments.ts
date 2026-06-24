import { pgTable, serial, text, date, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { instructorsTable } from "./instructors";

export const instructorPaymentsTable = pgTable("instructor_payments", {
  id: serial("id").primaryKey(),
  paymentNumber: text("payment_number").notNull().unique(),
  instructorId: integer("instructor_id").notNull().references(() => instructorsTable.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  paymentDate: date("payment_date").notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInstructorPaymentSchema = createInsertSchema(instructorPaymentsTable).omit({
  id: true,
  createdAt: true,
  paymentNumber: true,
});
export type InsertInstructorPayment = z.infer<typeof insertInstructorPaymentSchema>;
export type InstructorPayment = typeof instructorPaymentsTable.$inferSelect;
