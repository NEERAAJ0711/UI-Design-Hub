import { Router } from "express";
import { db, tasksTable, employeesTable, departmentsTable, kpisTable, krasTable, activityLogTable, holidaysTable } from "@workspace/db";
import { eq, count, sql, isNotNull, and } from "drizzle-orm";
import { approvalTimerInfo } from "../utils/working-hours";
import { GetEmployeeDashboardSummaryQueryParams, GetPendingApprovalsQueryParams } from "@workspace/api-zod";

const router = Router();

function calcRating(score: number): string {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Average";
  return "Improvement Required";
}

router.get("/dashboard/summary", async (req, res) => {
  const [empCount] = await db.select({ count: count() }).from(employeesTable);
  const [deptCount] = await db.select({ count: count() }).from(departmentsTable);
  const [totalTasks] = await db.select({ count: count() }).from(tasksTable);
  const [completedTasks] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.status, "completed"));
  const [pendingTasks] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.status, "pending"));
  const [delayedTasks] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.status, "delayed"));

  const [pendingTaskApprovals] = await db.select({ count: count() }).from(tasksTable).where(isNotNull(tasksTable.requestedStatus));
  const [pendingKraApprovals] = await db.select({ count: count() }).from(krasTable).where(eq(krasTable.kraStatus, "submitted"));
  const pendingApprovals = Number(pendingTaskApprovals.count) + Number(pendingKraApprovals.count);

  const kpiScores = await db.select({ score: kpisTable.totalScore }).from(kpisTable);
  const avgKpiScore = kpiScores.length
    ? kpiScores.reduce((sum, k) => sum + k.score, 0) / kpiScores.length
    : 0;

  res.json({
    totalEmployees: Number(empCount.count),
    totalDepartments: Number(deptCount.count),
    totalTasks: Number(totalTasks.count),
    completedTasks: Number(completedTasks.count),
    pendingTasks: Number(pendingTasks.count),
    delayedTasks: Number(delayedTasks.count),
    avgKpiScore: Math.round(avgKpiScore * 10) / 10,
    pendingApprovals,
  });
});

router.get("/dashboard/department-performance", async (req, res) => {
  const depts = await db.select().from(departmentsTable);
  const employees = await db.select().from(employeesTable);
  const tasks = await db.select().from(tasksTable);
  const kpis = await db.select().from(kpisTable);

  const empByDept = new Map<number, number[]>();
  for (const emp of employees) {
    if (!empByDept.has(emp.departmentId)) empByDept.set(emp.departmentId, []);
    empByDept.get(emp.departmentId)!.push(emp.id);
  }

  const result = depts.map((dept) => {
    const empIds = empByDept.get(dept.id) ?? [];
    const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
    const deptKpis = kpis.filter((k) => empIds.includes(k.employeeId));

    const completedCount = deptTasks.filter((t) => t.status === "completed").length;
    const delayedCount = deptTasks.filter((t) => t.status === "delayed").length;
    const completionRate = deptTasks.length ? (completedCount / deptTasks.length) * 100 : 0;
    const avgKpi = deptKpis.length ? deptKpis.reduce((s, k) => s + k.totalScore, 0) / deptKpis.length : 0;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount: empIds.length,
      avgKpiScore: Math.round(avgKpi * 10) / 10,
      taskCompletionRate: Math.round(completionRate * 10) / 10,
      delayedTaskCount: delayedCount,
    };
  });

  res.json(result);
});

router.get("/dashboard/task-status-breakdown", async (req, res) => {
  const rows = await db
    .select({ status: tasksTable.status, count: count() })
    .from(tasksTable)
    .groupBy(tasksTable.status);

  res.json(rows.map((r) => ({ status: r.status, count: Number(r.count) })));
});

router.get("/dashboard/top-performers", async (req, res) => {
  const limit = Number(req.query.limit) || 5;
  const kpis = await db.select().from(kpisTable).orderBy(sql`${kpisTable.totalScore} DESC`).limit(limit);

  const emps = await db.select().from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e]));
  const depts = await db.select().from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const allTasks = await db.select().from(tasksTable);

  const result = await Promise.all(kpis.map(async (k) => {
    const emp = empMap.get(k.employeeId);
    const empTasks = allTasks.filter((t) => t.assignedToId === k.employeeId && t.status === "completed");
    return {
      employeeId: k.employeeId,
      employeeName: emp?.name ?? "",
      departmentName: deptMap.get(emp?.departmentId ?? 0) ?? "",
      kpiScore: Math.round(k.totalScore * 10) / 10,
      rating: calcRating(k.totalScore),
      tasksCompleted: empTasks.length,
    };
  }));

  res.json(result);
});

router.get("/dashboard/overdue-tasks", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const tasks = await db.select().from(tasksTable);
  const overdue = tasks.filter((t) =>
    t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "approved"
  );

  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));
  const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  res.json(overdue.map((t) => ({
    ...t,
    assignedToName: empMap.get(t.assignedToId) ?? "",
    createdByName: empMap.get(t.createdById) ?? "",
    departmentName: deptMap.get(t.departmentId) ?? "",
    requestedStatus: t.requestedStatus ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.get("/dashboard/recent-activity", async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const activities = await db.select().from(activityLogTable)
    .orderBy(sql`${activityLogTable.createdAt} DESC`)
    .limit(limit);

  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));

  res.json(activities.map((a) => ({
    ...a,
    actorName: a.actorId ? (empMap.get(a.actorId) ?? "System") : "System",
    createdAt: a.createdAt.toISOString(),
  })));
});

router.get("/dashboard/employee-summary", async (req, res) => {
  const { employeeId } = GetEmployeeDashboardSummaryQueryParams.parse(req.query);
  const today = new Date().toISOString().split("T")[0];

  const myTasks = await db.select().from(tasksTable).where(eq(tasksTable.assignedToId, employeeId));
  const totalTasks = myTasks.length;
  const completedTasks = myTasks.filter((t) => t.status === "completed" || t.status === "approved").length;
  const pendingTasks = myTasks.filter((t) => t.status === "pending").length;
  const overdueTasks = myTasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "approved"
  ).length;

  const statusCounts: Record<string, number> = {};
  for (const task of myTasks) {
    statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
  }
  const taskBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  const kpis = await db.select().from(kpisTable)
    .where(eq(kpisTable.employeeId, employeeId))
    .orderBy(sql`${kpisTable.year} DESC, ${kpisTable.month} DESC`)
    .limit(1);
  const latestKpi = kpis[0] ?? null;

  const myKras = await db.select().from(krasTable).where(eq(krasTable.employeeId, employeeId));
  const kraAvg = myKras.length
    ? myKras.reduce((s, k) => s + (k.achievementPct ?? 0), 0) / myKras.length
    : null;

  const activities = await db.select().from(activityLogTable)
    .where(eq(activityLogTable.actorId, employeeId))
    .orderBy(sql`${activityLogTable.createdAt} DESC`)
    .limit(8);

  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));

  res.json({
    myTasks: totalTasks,
    completedTasks,
    pendingTasks,
    overdueTasks,
    myKpiScore: latestKpi ? Math.round(latestKpi.totalScore * 10) / 10 : null,
    myKpiRating: latestKpi ? calcRating(latestKpi.totalScore) : null,
    myKraAvg: kraAvg !== null ? Math.round((kraAvg as number) * 10) / 10 : null,
    taskBreakdown,
    recentActivity: activities.map((a) => ({
      ...a,
      actorName: a.actorId ? (empMap.get(a.actorId) ?? "System") : "System",
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.get("/dashboard/pending-approvals", async (req, res) => {
  const params = GetPendingApprovalsQueryParams.parse(req.query);
  const { departmentId, role } = params;

  const kraStatusValues = role === "hod" ? ["submitted", "manager_approved"] : ["submitted"];

  const allKras = await db.select().from(krasTable);
  const pendingKras = allKras.filter((k) => {
    if (!kraStatusValues.includes(k.kraStatus)) return false;
    if (departmentId && k.departmentId !== departmentId) return false;
    return true;
  });

  const allTasks = await db.select().from(tasksTable);
  const pendingTasks = allTasks.filter((t) => {
    if (!t.requestedStatus) return false;
    if (departmentId && t.departmentId !== departmentId) return false;
    return true;
  });
  const crossDeptTasks = allTasks.filter((t) => {
    if (t.status !== "awaiting_hod_approval") return false;
    if (departmentId && t.departmentId !== departmentId) return false;
    return true;
  });
  // Same-dept tasks that are "pending" and haven't been approved by HOD yet
  const hodPendingTasks = allTasks.filter((t) => {
    if (t.status !== "pending" || t.approvedById) return false;
    if (departmentId && t.departmentId !== departmentId) return false;
    return true;
  });

  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));
  const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  // KRAs pending HR approval
  const allPendingHrKras = await db.select().from(krasTable).where(eq(krasTable.hrApprovalStatus, "pending_hr"));

  // Load holidays for working-hours calculation
  const holidays = await db.select({ date: holidaysTable.date }).from(holidaysTable);
  const holidaySet = new Set(holidays.map((h) => h.date));
  const now = new Date();

  res.json({
    kras: pendingKras.map((k) => {
      const pendingAt = k.kraStatus === "manager_approved"
        ? k.managerApprovedAt ?? k.submittedAt
        : k.submittedAt;
      const timer = approvalTimerInfo(pendingAt, now, holidaySet);
      return {
        id: k.id,
        title: k.title,
        employeeId: k.employeeId ?? 0,
        employeeName: k.employeeId ? (empMap.get(k.employeeId) ?? "") : "",
        departmentName: deptMap.get(k.departmentId) ?? "",
        achievementPct: k.achievementPct ?? null,
        kraStatus: k.kraStatus,
        submittedAt: k.submittedAt?.toISOString() ?? null,
        pendingAt: pendingAt?.toISOString() ?? null,
        workingHoursElapsed: timer.workingHoursElapsed,
        isOverdue: timer.isOverdue,
      };
    }),
    tasks: pendingTasks.map((t) => {
      const pendingAt = t.statusRequestedAt;
      const timer = approvalTimerInfo(pendingAt, now, holidaySet);
      return {
        id: t.id,
        title: t.title,
        assignedToId: t.assignedToId,
        assignedToName: empMap.get(t.assignedToId) ?? "",
        departmentName: deptMap.get(t.departmentId) ?? "",
        status: t.status,
        requestedStatus: t.requestedStatus!,
        progressPct: t.progressPct,
        pendingAt: pendingAt?.toISOString() ?? null,
        workingHoursElapsed: timer.workingHoursElapsed,
        isOverdue: timer.isOverdue,
      };
    }),
    crossDeptTasks: crossDeptTasks.map((t) => ({
      id: t.id,
      title: t.title,
      assignedToName: empMap.get(t.assignedToId) ?? "",
      createdByName: empMap.get(t.createdById) ?? "",
      departmentName: deptMap.get(t.departmentId) ?? "",
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    hodPendingTasks: hodPendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      assignedToName: empMap.get(t.assignedToId) ?? "",
      createdByName: empMap.get(t.createdById) ?? "",
      departmentName: deptMap.get(t.departmentId) ?? "",
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    krasPendingHrApproval: allPendingHrKras.map((k) => {
      const pendingAt = k.createdAt;
      const timer = approvalTimerInfo(pendingAt, now, holidaySet);
      return {
        id: k.id,
        title: k.title,
        description: k.description ?? null,
        weightage: k.weightage,
        departmentName: deptMap.get(k.departmentId) ?? "",
        reviewPeriod: k.reviewPeriod,
        createdAt: k.createdAt.toISOString(),
        pendingAt: pendingAt.toISOString(),
        workingHoursElapsed: timer.workingHoursElapsed,
        isOverdue: timer.isOverdue,
      };
    }),
  });
});

export default router;
