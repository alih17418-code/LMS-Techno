import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export const vouchersTable = pgTable(
  "vouchers",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    month: integer("month").notNull(), // 1-12
    year: integer("year").notNull(),
    voucherType: text("voucher_type").notNull().default("monthly"), // monthly
    totalFee: numeric("total_fee", { precision: 12, scale: 2 }).notNull(),
    totalReceived: numeric("total_received", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    pendingAmount: numeric("pending_amount", { precision: 12, scale: 2 }).notNull(),
    status: text("status").notNull().default("unpaid"), // unpaid | partial | paid
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Prevent duplicate vouchers for same student+month+year+type
    uniqueVoucher: uniqueIndex("unique_voucher_per_student_month").on(
      table.studentId,
      table.month,
      table.year,
      table.voucherType
    ),
  })
);

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({
  id: true,
  createdAt: true,
  totalReceived: true,
  pendingAmount: true,
  status: true,
});
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;
