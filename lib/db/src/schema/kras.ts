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
  frequency: text("frequency").notNull().default("monthly"), // daily | weekly | bi_weekly | monthly | quarterly | yearly
  dueDate: text("due_date"), // YYYY-MM-DD
  kraStatus: text("kra_status").notNull().default("active"), // active | submitted | manager_approved | approved | rejected
  hrApprovalStatus: text("hr_approval_status").notNull().default("pending_hr"), // pending_hr | hr_approved | hr_rejected
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKraSchema = createInsertSchema(krasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKra = z.infer<typeof insertKraSchema>;
export type Kra = typeof krasTable.$inferSelect;
