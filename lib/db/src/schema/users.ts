import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";
import { interneesTable } from "./internees";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"), // admin | staff | instructor | internee
  displayName: text("display_name").notNull(),
  instructorId: integer("instructor_id").references(() => instructorsTable.id, { onDelete: "set null" }),
  interneeId: integer("internee_id").references(() => interneesTable.id, { onDelete: "set null" }),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
