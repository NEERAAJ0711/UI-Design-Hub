import { pgTable, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoreWeightsTable = pgTable("score_weights", {
  id: serial("id").primaryKey(),
  kraWeight: real("kra_weight").notNull().default(40),
  taskCompletionWeight: real("task_completion_weight").notNull().default(30),
  productivityWeight: real("productivity_weight").notNull().default(15),
  punctualityWeight: real("punctuality_weight").notNull().default(10),
  disciplineWeight: real("discipline_weight").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertScoreWeightsSchema = createInsertSchema(scoreWeightsTable).omit({ id: true, updatedAt: true });
export type InsertScoreWeights = z.infer<typeof insertScoreWeightsSchema>;
export type ScoreWeights = typeof scoreWeightsTable.$inferSelect;
