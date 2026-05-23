import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed | delayed | approved | rejected | closed | awaiting_hod_approval
  requestedStatus: text("requested_status"), // employee's pending status change request
  statusRequestedAt: timestamp("status_requested_at", { withTimezone: true }),
  priority: text("priority").notNull().default("medium"), // high | medium | low
  dueDate: text("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Approval tracking
  approvedById: integer("approved_by_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvalRemarks: text("approval_remarks"),
  // Creator acceptance tracking
  closedById: integer("closed_by_id"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdById: integer("created_by_id").notNull(),
  assignedToId: integer("assigned_to_id").notNull(),
  departmentId: integer("department_id").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringFreq: text("recurring_freq"), // daily | weekly | monthly | quarterly | yearly
  progressPct: integer("progress_pct").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
