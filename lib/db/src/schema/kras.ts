import { pgTable, text, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const krasTable = pgTable("kras", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  weightage: real("weightage").notNull(),
  achievementPct: real("achievement_pct"),
  departmentId: integer("department_id").notNull(),
  employeeId: integer("employee_id"),
  reviewPeriod: text("review_period").notNull().default("monthly"), // monthly | quarterly | yearly
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKraSchema = createInsertSchema(krasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKra = z.infer<typeof insertKraSchema>;
export type Kra = typeof krasTable.$inferSelect;
