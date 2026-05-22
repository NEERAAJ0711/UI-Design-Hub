import { Router } from "express";
import { db, kpisTable, employeesTable, departmentsTable, activityLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateKpiBody,
  UpdateKpiBody,
  GetKpiParams,
  DeleteKpiParams,
  UpdateKpiParams,
  ListKpisQueryParams,
} from "@workspace/api-zod";

const router = Router();

function calcRating(score: number): string {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Average";
  return "Improvement Required";
}

function calcTotalScore(kpi: {
  kraAchievement: number;
  taskCompletion: number;
  productivity: number;
  punctuality: number;
  discipline: number;
}): number {
  return (
    kpi.kraAchievement * 0.4 +
    kpi.taskCompletion * 0.3 +
    kpi.productivity * 0.15 +
    kpi.punctuality * 0.1 +
    kpi.discipline * 0.05
  );
}

async function enrichKpi(kpi: typeof kpisTable.$inferSelect) {
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, kpi.employeeId));
  const [dept] = emp
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, emp.departmentId))
    : [{ name: "" }];
  return {
    ...kpi,
    employeeName: emp?.name ?? "",
    departmentId: emp?.departmentId ?? 0,
    departmentName: dept?.name ?? "",
    rating: calcRating(kpi.totalScore),
    createdAt: kpi.createdAt.toISOString(),
  };
}

router.get("/kpis", async (req, res) => {
  const params = ListKpisQueryParams.parse(req.query);
  const conditions = [];
  if (params.employeeId) conditions.push(eq(kpisTable.employeeId, params.employeeId));
  if (params.month) conditions.push(eq(kpisTable.month, params.month));
  if (params.year) conditions.push(eq(kpisTable.year, params.year));

  const kpis = await db.select().from(kpisTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(kpisTable.year, kpisTable.month);

  const emps = await db.select().from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e]));
  const depts = await db.select().from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  let result = kpis.map((k) => {
    const emp = empMap.get(k.employeeId);
    return {
      ...k,
      employeeName: emp?.name ?? "",
      departmentId: emp?.departmentId ?? 0,
      departmentName: deptMap.get(emp?.departmentId ?? 0) ?? "",
      rating: calcRating(k.totalScore),
      createdAt: k.createdAt.toISOString(),
    };
  });

  if (params.departmentId) {
    result = result.filter((k) => k.departmentId === params.departmentId);
  }

  res.json(result);
});

router.post("/kpis", async (req, res) => {
  const body = CreateKpiBody.parse(req.body);
  const totalScore = calcTotalScore(body);
  const [kpi] = await db.insert(kpisTable).values({ ...body, totalScore }).returning();

  await db.insert(activityLogTable).values({
    type: "kpi_updated",
    description: `KPI recorded for employee (score: ${totalScore.toFixed(1)}%)`,
    entityId: kpi.id,
    entityType: "kpi",
  });

  res.status(201).json(await enrichKpi(kpi));
});

router.get("/kpis/:id", async (req, res) => {
  const { id } = GetKpiParams.parse({ id: Number(req.params.id) });
  const [kpi] = await db.select().from(kpisTable).where(eq(kpisTable.id, id));
  if (!kpi) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichKpi(kpi));
});

router.patch("/kpis/:id", async (req, res) => {
  const { id } = UpdateKpiParams.parse({ id: Number(req.params.id) });
  const body = UpdateKpiBody.parse(req.body);
  const [existing] = await db.select().from(kpisTable).where(eq(kpisTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const merged = { ...existing, ...body };
  const totalScore = calcTotalScore(merged);
  const [kpi] = await db.update(kpisTable).set({ ...body, totalScore }).where(eq(kpisTable.id, id)).returning();
  res.json(await enrichKpi(kpi));
});

router.delete("/kpis/:id", async (req, res) => {
  const { id } = DeleteKpiParams.parse({ id: Number(req.params.id) });
  await db.delete(kpisTable).where(eq(kpisTable.id, id));
  res.status(204).send();
});

export default router;
