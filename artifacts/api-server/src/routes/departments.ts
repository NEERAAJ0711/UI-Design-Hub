import { Router } from "express";
import { db, departmentsTable, employeesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  CreateDepartmentBody,
  UpdateDepartmentBody,
  GetDepartmentParams,
  DeleteDepartmentParams,
  UpdateDepartmentParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/departments", async (req, res) => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);

  const employees = await db.select({ departmentId: employeesTable.departmentId, count: count() })
    .from(employeesTable)
    .groupBy(employeesTable.departmentId);

  const countMap = new Map(employees.map((e) => [e.departmentId, Number(e.count)]));

  const heads = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const headMap = new Map(heads.map((h) => [h.id, h.name]));

  res.json(depts.map((d) => ({
    ...d,
    headName: d.headId ? (headMap.get(d.headId) ?? null) : null,
    employeeCount: countMap.get(d.id) ?? 0,
    createdAt: d.createdAt.toISOString(),
  })));
});

router.post("/departments", async (req, res) => {
  const body = CreateDepartmentBody.parse(req.body);
  const [dept] = await db.insert(departmentsTable).values(body).returning();
  res.status(201).json({ ...dept, headName: null, employeeCount: 0, createdAt: dept.createdAt.toISOString() });
});

router.get("/departments/:id", async (req, res) => {
  const { id } = GetDepartmentParams.parse({ id: Number(req.params.id) });
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!dept) { res.status(404).json({ error: "Not found" }); return; }
  const [ec] = await db.select({ count: count() }).from(employeesTable).where(eq(employeesTable.departmentId, id));
  const headName = dept.headId
    ? (await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, dept.headId)))[0]?.name ?? null
    : null;
  res.json({ ...dept, headName, employeeCount: Number(ec.count), createdAt: dept.createdAt.toISOString() });
});

router.patch("/departments/:id", async (req, res) => {
  const { id } = UpdateDepartmentParams.parse({ id: Number(req.params.id) });
  const body = UpdateDepartmentBody.parse(req.body);
  const [dept] = await db.update(departmentsTable).set(body).where(eq(departmentsTable.id, id)).returning();
  if (!dept) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...dept, headName: null, employeeCount: 0, createdAt: dept.createdAt.toISOString() });
});

router.delete("/departments/:id", async (req, res) => {
  const { id } = DeleteDepartmentParams.parse({ id: Number(req.params.id) });
  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.status(204).send();
});

export default router;
