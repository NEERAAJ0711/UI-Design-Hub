import { Router } from "express";
import { db, krasTable, departmentsTable, employeesTable, activityLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateKraBody,
  UpdateKraBody,
  GetKraParams,
  DeleteKraParams,
  UpdateKraParams,
  ListKrasQueryParams,
  ScoreKraParams,
  ScoreKraBody,
} from "@workspace/api-zod";

const router = Router();

async function enrichKra(kra: typeof krasTable.$inferSelect) {
  const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, kra.departmentId));
  const empName = kra.employeeId
    ? (await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, kra.employeeId)))[0]?.name ?? null
    : null;
  return {
    ...kra,
    departmentName: dept?.name ?? "",
    employeeName: empName,
    createdAt: kra.createdAt.toISOString(),
  };
}

router.get("/kras", async (req, res) => {
  const params = ListKrasQueryParams.parse(req.query);
  const conditions = [];
  if (params.departmentId) conditions.push(eq(krasTable.departmentId, params.departmentId));
  if (params.employeeId) conditions.push(eq(krasTable.employeeId, params.employeeId));

  const kras = await db.select().from(krasTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(krasTable.title);

  const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));

  res.json(kras.map((k) => ({
    ...k,
    departmentName: deptMap.get(k.departmentId) ?? "",
    employeeName: k.employeeId ? (empMap.get(k.employeeId) ?? null) : null,
    createdAt: k.createdAt.toISOString(),
  })));
});

router.post("/kras", async (req, res) => {
  const body = CreateKraBody.parse(req.body);
  const [kra] = await db.insert(krasTable).values(body).returning();
  res.status(201).json(await enrichKra(kra));
});

router.get("/kras/:id", async (req, res) => {
  const { id } = GetKraParams.parse({ id: Number(req.params.id) });
  const [kra] = await db.select().from(krasTable).where(eq(krasTable.id, id));
  if (!kra) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichKra(kra));
});

router.patch("/kras/:id", async (req, res) => {
  const { id } = UpdateKraParams.parse({ id: Number(req.params.id) });
  const body = UpdateKraBody.parse(req.body);
  const [kra] = await db.update(krasTable).set(body).where(eq(krasTable.id, id)).returning();
  if (!kra) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichKra(kra));
});

router.delete("/kras/:id", async (req, res) => {
  const { id } = DeleteKraParams.parse({ id: Number(req.params.id) });
  await db.delete(krasTable).where(eq(krasTable.id, id));
  res.status(204).send();
});

router.patch("/kras/:id/score", async (req, res) => {
  const { id } = ScoreKraParams.parse({ id: Number(req.params.id) });
  const { achievementPct } = ScoreKraBody.parse(req.body);
  const [kra] = await db.update(krasTable).set({ achievementPct }).where(eq(krasTable.id, id)).returning();
  if (!kra) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityLogTable).values({
    type: "kra_scored",
    description: `KRA "${kra.title}" scored at ${achievementPct}%`,
    entityId: kra.id,
    entityType: "kra",
  });
  res.json(await enrichKra(kra));
});

export default router;
