import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const budgetEntriesTable = pgTable("budget_entries", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // income | expense
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category"),
  entryDate: timestamp("entry_date").notNull().defaultNow(),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BudgetEntry = typeof budgetEntriesTable.$inferSelect;
