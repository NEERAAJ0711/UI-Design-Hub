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
  SubmitKraForClosureParams,
  ApproveKraClosureParams,
  ApproveKraClosureBody,
  HrApproveKraParams,
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
    submittedAt: kra.submittedAt?.toISOString() ?? null,
    closedAt: kra.closedAt?.toISOString() ?? null,
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
    submittedAt: k.submittedAt?.toISOString() ?? null,
    closedAt: k.closedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  })));
});

router.post("/kras", async (req, res) => {
  const body = CreateKraBody.parse(req.body);
  // New KRAs always start pending HR approval; employeeId cannot be set yet
  const [kra] = await db.insert(krasTable).values({
    ...body,
    employeeId: undefined,
    hrApprovalStatus: "pending_hr",
    kraStatus: "active",
  }).returning();
  await db.insert(activityLogTable).values({
    type: "kra_submitted",
    description: `KRA "${kra.title}" created and pending HR approval`,
    entityId: kra.id,
    entityType: "kra",
  });
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

  // Block employee assignment unless HR has approved this KRA
  if ((body as Record<string, unknown>).employeeId !== undefined) {
    const [existing] = await db.select().from(krasTable).where(eq(krasTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.hrApprovalStatus !== "hr_approved") {
      res.status(403).json({ error: "KRA must be approved by HR before assigning to an employee." });
      return;
    }
  }

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

router.patch("/kras/:id/hr-approve", async (req, res) => {
  const { id } = HrApproveKraParams.parse({ id: Number(req.params.id) });
  const { approved } = req.body as { approved: boolean };

  const [existing] = await db.select().from(krasTable).where(eq(krasTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const newStatus = approved ? "hr_approved" : "hr_rejected";
  const [kra] = await db.update(krasTable)
    .set({ hrApprovalStatus: newStatus })
    .where(eq(krasTable.id, id))
    .returning();

  await db.insert(activityLogTable).values({
    type: approved ? "kra_approved" : "kra_rejected",
    description: `KRA "${kra.title}" ${approved ? "approved by HR" : "rejected by HR"}`,
    entityId: kra.id,
    entityType: "kra",
  });

  res.json(await enrichKra(kra));
});

router.patch("/kras/:id/submit", async (req, res) => {
  const { id } = SubmitKraForClosureParams.parse({ id: Number(req.params.id) });
  const [kra] = await db.update(krasTable)
    .set({ kraStatus: "submitted", submittedAt: new Date() })
    .where(eq(krasTable.id, id))
    .returning();
  if (!kra) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityLogTable).values({
    type: "kra_submitted",
    description: `KRA "${kra.title}" submitted for closure`,
    actorId: kra.employeeId ?? undefined,
    entityId: kra.id,
    entityType: "kra",
  });
  res.json(await enrichKra(kra));
});

router.patch("/kras/:id/approve-close", async (req, res) => {
  const { id } = ApproveKraClosureParams.parse({ id: Number(req.params.id) });
  const { approved } = ApproveKraClosureBody.parse(req.body);

  const [existing] = await db.select().from(krasTable).where(eq(krasTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  let newStatus: string;
  let extra: Record<string, Date> = {};

  if (!approved) {
    newStatus = "rejected";
  } else if (existing.kraStatus === "submitted") {
    newStatus = "manager_approved";
    extra.managerApprovedAt = new Date();
  } else {
    newStatus = "approved";
    extra.closedAt = new Date();
  }

  const [kra] = await db.update(krasTable)
    .set({ kraStatus: newStatus, ...extra })
    .where(eq(krasTable.id, id))
    .returning();

  await db.insert(activityLogTable).values({
    type: approved ? "kra_approved" : "kra_rejected",
    description: `KRA "${kra.title}" ${approved ? `approved (${newStatus})` : "rejected"}`,
    entityId: kra.id,
    entityType: "kra",
  });

  res.json(await enrichKra(kra));
});

export default router;
