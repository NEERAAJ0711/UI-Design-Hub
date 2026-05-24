import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kraDailyLogsTable = pgTable("kra_daily_logs", {
  id:         serial("id").primaryKey(),
  kraId:      integer("kra_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  logDate:    text("log_date").notNull(),       // YYYY-MM-DD
  isDone:     boolean("is_done").notNull().default(false),
  notes:      text("notes"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKraDailyLogSchema = createInsertSchema(kraDailyLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKraDailyLog = z.infer<typeof insertKraDailyLogSchema>;
export type KraDailyLog = typeof kraDailyLogsTable.$inferSelect;
