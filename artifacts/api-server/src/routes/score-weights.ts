import { Router } from "express";
import { db, scoreWeightsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function getOrCreateWeights() {
  const [row] = await db.select().from(scoreWeightsTable);
  if (row) return row;
  const [created] = await db.insert(scoreWeightsTable).values({}).returning();
  return created!;
}

router.get("/score-weights", async (_req, res) => {
  const weights = await getOrCreateWeights();
  res.json(weights);
});

router.put("/score-weights", async (req, res) => {
  const { kraWeight, taskCompletionWeight, productivityWeight, punctualityWeight, disciplineWeight } =
    req.body as Record<string, number>;

  const total =
    (kraWeight ?? 0) + (taskCompletionWeight ?? 0) + (productivityWeight ?? 0) +
    (punctualityWeight ?? 0) + (disciplineWeight ?? 0);
  if (Math.abs(total - 100) > 0.5) {
    res.status(400).json({ error: `Weights must sum to 100% (currently ${Math.round(total)}%)` });
    return;
  }

  const existing = await getOrCreateWeights();
  const [updated] = await db.update(scoreWeightsTable)
    .set({ kraWeight, taskCompletionWeight, productivityWeight, punctualityWeight, disciplineWeight })
    .where(eq(scoreWeightsTable.id, existing.id))
    .returning();
  res.json(updated);
});

export default router;
