import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feeStructuresTable = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  course: text("course").notNull().unique(), // DIT | CIT | IICT
  monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeeStructureSchema = createInsertSchema(feeStructuresTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;
export type FeeStructure = typeof feeStructuresTable.$inferSelect;
