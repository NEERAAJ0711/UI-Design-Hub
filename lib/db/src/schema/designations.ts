import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const designationsTable = pgTable("designations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Designation = typeof designationsTable.$inferSelect;
