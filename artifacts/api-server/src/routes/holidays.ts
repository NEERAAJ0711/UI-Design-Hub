import { Router } from "express";
import { db, holidaysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/holidays", async (_req, res) => {
  const rows = await db.select().from(holidaysTable).orderBy(holidaysTable.date);
  res.json(rows.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })));
});

router.post("/holidays", async (req, res) => {
  const { date, name } = req.body as { date: string; name: string };
  if (!date || !name) { res.status(400).json({ error: "date and name required" }); return; }
  const [row] = await db.insert(holidaysTable).values({ date, name }).returning();
  res.status(201).json({ ...row, createdAt: row!.createdAt.toISOString() });
});

router.delete("/holidays/:id", async (req, res) => {
  await db.delete(holidaysTable).where(eq(holidaysTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
