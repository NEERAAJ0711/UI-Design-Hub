import { Router } from "express";
import { db, employeesTable, departmentsTable, activityLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  GetEmployeeParams,
  DeleteEmployeeParams,
  UpdateEmployeeParams,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/employees", async (req, res) => {
  const params = ListEmployeesQueryParams.parse(req.query);
  const conditions = [];
  if (params.departmentId) conditions.push(eq(employeesTable.departmentId, params.departmentId));

  const employees = await db.select().from(employeesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(employeesTable.name);

  const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  const empMap = new Map(employees.map((e) => [e.id, e.name]));

  const result = employees
    .filter((e) => !params.role || e.role === params.role)
    .map((e) => ({
      ...e,
      departmentName: deptMap.get(e.departmentId) ?? "",
      managerName: e.managerId ? (empMap.get(e.managerId) ?? null) : null,
      createdAt: e.createdAt.toISOString(),
    }));

  res.json(result);
});

router.post("/employees", async (req, res) => {
  const body = CreateEmployeeBody.parse(req.body);
  const [emp] = await db.insert(employeesTable).values(body).returning();

  const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, emp.departmentId));

  await db.insert(activityLogTable).values({
    type: "employee_added",
    description: `New employee ${emp.name} joined ${dept?.name ?? ""}`,
    actorId: emp.id,
    entityId: emp.id,
    entityType: "employee",
  });

  res.status(201).json({
    ...emp,
    departmentName: dept?.name ?? "",
    managerName: null,
    createdAt: emp.createdAt.toISOString(),
  });
});

router.get("/employees/:id", async (req, res) => {
  const { id } = GetEmployeeParams.parse({ id: Number(req.params.id) });
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }

  const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, emp.departmentId));
  const managerName = emp.managerId
    ? (await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, emp.managerId)))[0]?.name ?? null
    : null;

  res.json({ ...emp, departmentName: dept?.name ?? "", managerName, createdAt: emp.createdAt.toISOString() });
});

router.patch("/employees/:id", async (req, res) => {
  const { id } = UpdateEmployeeParams.parse({ id: Number(req.params.id) });
  const body = UpdateEmployeeBody.parse(req.body);
  const [emp] = await db.update(employeesTable).set(body).where(eq(employeesTable.id, id)).returning();
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, emp.departmentId));
  res.json({ ...emp, departmentName: dept?.name ?? "", managerName: null, createdAt: emp.createdAt.toISOString() });
});

router.delete("/employees/:id", async (req, res) => {
  const { id } = DeleteEmployeeParams.parse({ id: Number(req.params.id) });
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.status(204).send();
});

export default router;
