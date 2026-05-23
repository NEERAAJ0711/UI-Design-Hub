import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHolidaySchema = createInsertSchema(holidaysTable).omit({ id: true, createdAt: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidaysTable.$inferSelect;
