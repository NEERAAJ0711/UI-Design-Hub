import { Router } from "express";
import { db, tasksTable, taskCommentsTable, employeesTable, departmentsTable, activityLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateTaskBody,
  UpdateTaskBody,
  GetTaskParams,
  DeleteTaskParams,
  UpdateTaskParams,
  ListTasksQueryParams,
  UpdateTaskStatusParams,
  UpdateTaskStatusBody,
  ListTaskCommentsParams,
  AddTaskCommentParams,
  AddTaskCommentBody,
  RequestTaskStatusParams,
  RequestTaskStatusBody,
  ApproveTaskStatusParams,
  ApproveTaskStatusBody,
} from "@workspace/api-zod";

const router = Router();

async function enrichTask(task: typeof tasksTable.$inferSelect) {
  const [assignee] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, task.assignedToId));
  const [creator] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, task.createdById));
  const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, task.departmentId));
  return {
    ...task,
    assignedToName: assignee?.name ?? "",
    createdByName: creator?.name ?? "",
    departmentName: dept?.name ?? "",
    requestedStatus: task.requestedStatus ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  };
}

router.get("/tasks", async (req, res) => {
  const params = ListTasksQueryParams.parse(req.query);
  const conditions = [];
  if (params.assignedToId) conditions.push(eq(tasksTable.assignedToId, params.assignedToId));
  if (params.createdById) conditions.push(eq(tasksTable.createdById, params.createdById));
  if (params.departmentId) conditions.push(eq(tasksTable.departmentId, params.departmentId));
  if (params.status) conditions.push(eq(tasksTable.status, params.status));
  if (params.priority) conditions.push(eq(tasksTable.priority, params.priority));

  const tasks = await db.select().from(tasksTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(tasksTable.createdAt);

  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));
  const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  res.json(tasks.map((t) => ({
    ...t,
    assignedToName: empMap.get(t.assignedToId) ?? "",
    createdByName: empMap.get(t.createdById) ?? "",
    departmentName: deptMap.get(t.departmentId) ?? "",
    requestedStatus: t.requestedStatus ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/tasks", async (req, res) => {
  const body = CreateTaskBody.parse(req.body);
  const [task] = await db.insert(tasksTable).values(body).returning();

  await db.insert(activityLogTable).values({
    type: "task_created",
    description: `Task "${task.title}" created`,
    actorId: task.createdById,
    entityId: task.id,
    entityType: "task",
  });

  res.status(201).json(await enrichTask(task));
});

router.get("/tasks/:id", async (req, res) => {
  const { id } = GetTaskParams.parse({ id: Number(req.params.id) });
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichTask(task));
});

router.patch("/tasks/:id", async (req, res) => {
  const { id } = UpdateTaskParams.parse({ id: Number(req.params.id) });
  const body = UpdateTaskBody.parse(req.body);
  const [task] = await db.update(tasksTable).set(body).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichTask(task));
});

router.delete("/tasks/:id", async (req, res) => {
  const { id } = DeleteTaskParams.parse({ id: Number(req.params.id) });
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

router.patch("/tasks/:id/status", async (req, res) => {
  const { id } = UpdateTaskStatusParams.parse({ id: Number(req.params.id) });
  const { status } = UpdateTaskStatusBody.parse(req.body);
  const completedAt = status === "completed" ? new Date() : null;
  const [task] = await db.update(tasksTable)
    .set({ status, requestedStatus: null, ...(completedAt !== undefined ? { completedAt } : {}) })
    .where(eq(tasksTable.id, id))
    .returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }

  if (status === "completed") {
    await db.insert(activityLogTable).values({
      type: "task_completed",
      description: `Task "${task.title}" completed`,
      actorId: task.assignedToId,
      entityId: task.id,
      entityType: "task",
    });
  } else if (status === "delayed") {
    await db.insert(activityLogTable).values({
      type: "task_delayed",
      description: `Task "${task.title}" marked as delayed`,
      entityId: task.id,
      entityType: "task",
    });
  }

  res.json(await enrichTask(task));
});

router.patch("/tasks/:id/request-status", async (req, res) => {
  const { id } = RequestTaskStatusParams.parse({ id: Number(req.params.id) });
  const { status, progressPct } = RequestTaskStatusBody.parse(req.body);

  const updateData: Record<string, unknown> = { requestedStatus: status, statusRequestedAt: new Date() };
  if (progressPct !== undefined) updateData.progressPct = progressPct;

  const [task] = await db.update(tasksTable).set(updateData).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(activityLogTable).values({
    type: "task_status_requested",
    description: `"${status}" status requested for task "${task.title}"`,
    actorId: task.assignedToId,
    entityId: task.id,
    entityType: "task",
  });

  res.json(await enrichTask(task));
});

router.patch("/tasks/:id/approve-status", async (req, res) => {
  const { id } = ApproveTaskStatusParams.parse({ id: Number(req.params.id) });
  const { approved } = ApproveTaskStatusBody.parse(req.body);

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const updateData: Record<string, unknown> = { requestedStatus: null };
  if (approved && existing.requestedStatus) {
    updateData.status = existing.requestedStatus;
    if (existing.requestedStatus === "completed") {
      updateData.completedAt = new Date();
    }
  }

  const [task] = await db.update(tasksTable).set(updateData).where(eq(tasksTable.id, id)).returning();

  await db.insert(activityLogTable).values({
    type: approved ? "task_status_approved" : "task_status_rejected",
    description: `Task "${task.title}" status request ${approved ? "approved" : "rejected"}`,
    entityId: task.id,
    entityType: "task",
  });

  res.json(await enrichTask(task));
});

router.get("/tasks/:id/comments", async (req, res) => {
  const { id } = ListTaskCommentsParams.parse({ id: Number(req.params.id) });
  const comments = await db.select().from(taskCommentsTable)
    .where(eq(taskCommentsTable.taskId, id))
    .orderBy(taskCommentsTable.createdAt);

  const emps = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(emps.map((e) => [e.id, e.name]));

  res.json(comments.map((c) => ({
    ...c,
    authorName: empMap.get(c.authorId) ?? "",
    createdAt: c.createdAt.toISOString(),
  })));
});

router.post("/tasks/:id/comments", async (req, res) => {
  const { id } = AddTaskCommentParams.parse({ id: Number(req.params.id) });
  const body = AddTaskCommentBody.parse(req.body);
  const [comment] = await db.insert(taskCommentsTable).values({ ...body, taskId: id }).returning();
  const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, comment.authorId));
  res.status(201).json({ ...comment, authorName: emp?.name ?? "", createdAt: comment.createdAt.toISOString() });
});

export default router;
