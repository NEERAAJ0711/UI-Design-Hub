import { Router } from "express";
import { db, kpisTable, krasTable, tasksTable, scoreWeightsTable, employeesTable, departmentsTable, activityLogTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import {
  CreateKpiBody,
  UpdateKpiBody,
  GetKpiParams,
  DeleteKpiParams,
  UpdateKpiParams,
  ListKpisQueryParams,
} from "@workspace/api-zod";

const router = Router();

// ─── Rating ───────────────────────────────────────────────────────────────────

function calcRating(score: number): string {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Average";
  return "Improvement Required";
}

// ─── Weights helper ───────────────────────────────────────────────────────────

type Weights = {
  kraWeight: number;
  taskCompletionWeight: number;
  productivityWeight: number;
  punctualityWeight: number;
  disciplineWeight: number;
};

const DEFAULT_WEIGHTS: Weights = {
  kraWeight: 40,
  taskCompletionWeight: 30,
  productivityWeight: 15,
  punctualityWeight: 10,
  disciplineWeight: 5,
};

async function getWeights(): Promise<Weights> {
  const [row] = await db.select().from(scoreWeightsTable);
  return row ?? DEFAULT_WEIGHTS;
}

/**
 * Compute totalScore from component scores and configured weights.
 * Both component scores and weights are in percentage points (0-100).
 * totalScore = Σ(component × weight) / Σ(weights)
 */
function calcTotalScore(
  components: {
    kraAchievement: number;
    taskCompletion: number;
    productivity: number;
    punctuality: number;
    discipline: number;
  },
  w: Weights
): number {
  const totalWeight = w.kraWeight + w.taskCompletionWeight + w.productivityWeight + w.punctualityWeight + w.disciplineWeight;
  const raw =
    components.kraAchievement * w.kraWeight +
    components.taskCompletion * w.taskCompletionWeight +
    components.productivity * w.productivityWeight +
    components.punctuality * w.punctualityWeight +
    components.discipline * w.disciplineWeight;
  return Math.round((raw / (totalWeight || 100)) * 10) / 10;
}

/**
 * Compute KRA achievement as a WEIGHTED average of achievementPct.
 * Only KRAs that have a score set (achievementPct != null) are included.
 * KRAs with null achievementPct are excluded from both numerator and denominator
 * so unscored KRAs do not artificially drag the average down.
 */
function calcKraAchievement(kras: { achievementPct?: number | null; weightage: number }[]): number {
  const scored = kras.filter((k) => k.achievementPct != null);
  if (!scored.length) return 0;

  const totalWeightage = scored.reduce((s, k) => s + k.weightage, 0);
  if (totalWeightage === 0) {
    return Math.round((scored.reduce((s, k) => s + (k.achievementPct ?? 0), 0) / scored.length) * 10) / 10;
  }
  const weighted = scored.reduce((s, k) => s + (k.achievementPct ?? 0) * k.weightage, 0);
  return Math.round((weighted / totalWeightage) * 10) / 10;
}

// ─── Enrich ───────────────────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

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
  const w = await getWeights();
  const totalScore = calcTotalScore(body, w);

  const [kpi] = await db.insert(kpisTable)
    .values({ ...body, totalScore })
    .onConflictDoUpdate({
      target: [kpisTable.employeeId, kpisTable.month, kpisTable.year],
      set: { ...body, totalScore },
    })
    .returning();

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
  const w = await getWeights();
  const merged = { ...existing, ...body };
  const totalScore = calcTotalScore(merged, w);
  const [kpi] = await db.update(kpisTable).set({ ...body, totalScore }).where(eq(kpisTable.id, id)).returning();
  res.json(await enrichKpi(kpi));
});

router.delete("/kpis/:id", async (req, res) => {
  const { id } = DeleteKpiParams.parse({ id: Number(req.params.id) });
  await db.delete(kpisTable).where(eq(kpisTable.id, id));
  res.status(204).send();
});

// ─── Batch auto-calculate ─────────────────────────────────────────────────────

router.post("/kpis/calculate-batch", async (req, res) => {
  const { month, year } = req.body as { month: number; year: number };
  if (!month || !year) {
    res.status(400).json({ error: "month and year are required" }); return;
  }

  const [allEmployees, w, allKras, allTasks, allExisting] = await Promise.all([
    db.select({ id: employeesTable.id }).from(employeesTable),
    getWeights(),
    db.select().from(krasTable).where(ne(krasTable.hrApprovalStatus, "hr_rejected")),
    db.select().from(tasksTable),
    db.select().from(kpisTable).where(and(eq(kpisTable.month, month), eq(kpisTable.year, year))),
  ]);

  const existingMap = new Map(allExisting.map((k) => [k.employeeId, k]));

  let saved = 0;
  for (const emp of allEmployees) {
    const empKras = allKras.filter((k) => k.employeeId === emp.id);
    // Weighted KRA achievement: uses each KRA's own weightage field
    const kraAchievement = calcKraAchievement(empKras);

    const tasks = allTasks.filter((t) => t.assignedToId === emp.id);
    const doneTasks = tasks.filter((t) => t.status === "approved" || t.status === "completed").length;
    const taskCompletion = tasks.length ? Math.round((doneTasks / tasks.length) * 1000) / 10 : 0;

    const existing = existingMap.get(emp.id);
    const productivity = existing?.productivity ?? 0;
    const punctuality  = existing?.punctuality ?? 0;
    const discipline   = existing?.discipline ?? 0;

    const totalScore = calcTotalScore({ kraAchievement, taskCompletion, productivity, punctuality, discipline }, w);

    await db.insert(kpisTable)
      .values({ employeeId: emp.id, month, year, kraAchievement, taskCompletion, productivity, punctuality, discipline, totalScore })
      .onConflictDoUpdate({
        target: [kpisTable.employeeId, kpisTable.month, kpisTable.year],
        set: { kraAchievement, taskCompletion, totalScore },
      });
    saved++;
  }

  res.status(201).json({ saved });
});

// ─── Single employee auto-calculate ──────────────────────────────────────────

router.post("/kpis/calculate", async (req, res) => {
  const { employeeId, month, year } = req.body as { employeeId: number; month: number; year: number };
  if (!employeeId || !month || !year) {
    res.status(400).json({ error: "employeeId, month, and year are required" }); return;
  }

  const [w, kras, tasks, [existing]] = await Promise.all([
    getWeights(),
    db.select().from(krasTable).where(and(eq(krasTable.employeeId, employeeId), ne(krasTable.hrApprovalStatus, "hr_rejected"))),
    db.select().from(tasksTable).where(eq(tasksTable.assignedToId, employeeId)),
    db.select().from(kpisTable).where(and(eq(kpisTable.employeeId, employeeId), eq(kpisTable.month, month), eq(kpisTable.year, year))),
  ]);

  // Weighted KRA achievement: uses each KRA's own weightage field
  const kraAchievement = calcKraAchievement(kras);

  const doneTasks = tasks.filter((t) => t.status === "approved" || t.status === "completed").length;
  const taskCompletion = tasks.length ? Math.round((doneTasks / tasks.length) * 1000) / 10 : 0;

  const productivity = existing?.productivity ?? 0;
  const punctuality  = existing?.punctuality ?? 0;
  const discipline   = existing?.discipline ?? 0;

  const totalScore = calcTotalScore({ kraAchievement, taskCompletion, productivity, punctuality, discipline }, w);

  const [kpi] = await db.insert(kpisTable)
    .values({ employeeId, month, year, kraAchievement, taskCompletion, productivity, punctuality, discipline, totalScore })
    .onConflictDoUpdate({
      target: [kpisTable.employeeId, kpisTable.month, kpisTable.year],
      set: { kraAchievement, taskCompletion, totalScore },
    })
    .returning();

  await db.insert(activityLogTable).values({
    type: "kpi_updated",
    description: `KPI auto-calculated for employee ${employeeId}: KRA=${kraAchievement}% (weighted), Tasks=${taskCompletion}%, Total=${totalScore}%`,
    entityId: kpi!.id,
    entityType: "kpi",
  });

  res.status(201).json(await enrichKpi(kpi!));
});

export default router;
