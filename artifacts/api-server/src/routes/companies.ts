import { Router } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateCompanyBody,
  UpdateCompanyParams,
  UpdateCompanyBody,
  DeleteCompanyParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/companies", async (_req, res) => {
  const rows = await db.select().from(companiesTable).orderBy(companiesTable.name);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/companies", async (req, res) => {
  const body = CreateCompanyBody.parse(req.body);
  const [row] = await db.insert(companiesTable).values({ name: body.name }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/companies/:id", async (req, res) => {
  const { id } = UpdateCompanyParams.parse({ id: Number(req.params.id) });
  const body = UpdateCompanyBody.parse(req.body);
  const [row] = await db
    .update(companiesTable)
    .set({ name: body.name })
    .where(eq(companiesTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/companies/:id", async (req, res) => {
  const { id } = DeleteCompanyParams.parse({ id: Number(req.params.id) });
  await db.delete(companiesTable).where(eq(companiesTable.id, id));
  res.status(204).send();
});

export default router;
