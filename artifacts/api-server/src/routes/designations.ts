import { Router } from "express";
import { db, designationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateDesignationBody,
  UpdateDesignationParams,
  UpdateDesignationBody,
  DeleteDesignationParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/designations", async (_req, res) => {
  const rows = await db.select().from(designationsTable).orderBy(designationsTable.name);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/designations", async (req, res) => {
  const body = CreateDesignationBody.parse(req.body);
  const [row] = await db.insert(designationsTable).values({ name: body.name }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/designations/:id", async (req, res) => {
  const { id } = UpdateDesignationParams.parse({ id: Number(req.params.id) });
  const body = UpdateDesignationBody.parse(req.body);
  const [row] = await db
    .update(designationsTable)
    .set({ name: body.name })
    .where(eq(designationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/designations/:id", async (req, res) => {
  const { id } = DeleteDesignationParams.parse({ id: Number(req.params.id) });
  await db.delete(designationsTable).where(eq(designationsTable.id, id));
  res.status(204).send();
});

export default router;
