import { pgTable, serial, integer, timestamp, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kpisTable = pgTable("kpis", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  kraAchievement: real("kra_achievement").notNull().default(0),
  taskCompletion: real("task_completion").notNull().default(0),
  productivity: real("productivity").notNull().default(0),
  punctuality: real("punctuality").notNull().default(0),
  discipline: real("discipline").notNull().default(0),
  totalScore: real("total_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  employeeMonthYearUniq: unique("kpis_employee_month_year_unique").on(table.employeeId, table.month, table.year),
}));

export const insertKpiSchema = createInsertSchema(kpisTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpisTable.$inferSelect;
