import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vouchersTable } from "./vouchers";
import { studentsTable } from "./students";

export const receiptsTable = pgTable("receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  voucherId: integer("voucher_id")
    .notNull()
    .references(() => vouchersTable.id, { onDelete: "restrict" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "restrict" }),
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // cash | bank_transfer | cheque | online
  remarks: text("remarks"),
  paymentDate: date("payment_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReceiptSchema = createInsertSchema(receiptsTable).omit({
  id: true,
  createdAt: true,
  receiptNumber: true,
});
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receiptsTable.$inferSelect;
