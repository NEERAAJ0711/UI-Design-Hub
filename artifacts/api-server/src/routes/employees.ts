import { Router } from "express";
import { db, employeesTable, departmentsTable, activityLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  GetEmployeeParams,
  DeleteEmployeeParams,
  UpdateEmployeeParams,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";
import { z } from "zod";

const BulkEmployeeRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["management", "hod", "manager", "employee"]).default("employee"),
  department: z.string().min(1),
  designation: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  joiningDate: z.string().optional(),
});

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

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

router.post("/employees/bulk-upload", async (req, res) => {
  const { rows } = req.body as { rows: unknown[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows must be a non-empty array" });
    return;
  }

  const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptByName = new Map(depts.map((d) => [d.name.toLowerCase().trim(), d.id]));

  const DEFAULT_PASSWORD_HASH = hashPassword("Password@123");

  let created = 0;
  const errors: Array<{ row: number; name?: string; email?: string; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = BulkEmployeeRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e: { message: string }) => e.message).join("; ");
      const raw = rows[i] as Record<string, unknown>;
      errors.push({ row: rowNum, name: String(raw.name ?? ""), email: String(raw.email ?? ""), error: msg });
      continue;
    }
    const data = parsed.data;
    const deptId = deptByName.get(data.department.toLowerCase().trim());
    if (!deptId) {
      errors.push({ row: rowNum, name: data.name, email: data.email, error: `Department "${data.department}" not found` });
      continue;
    }
    try {
      const [emp] = await db.insert(employeesTable).values({
        name: data.name,
        email: data.email,
        role: data.role,
        designation: data.designation || undefined,
        company: data.company || undefined,
        phone: data.phone || undefined,
        joiningDate: data.joiningDate || undefined,
        departmentId: deptId,
        passwordHash: DEFAULT_PASSWORD_HASH,
      }).returning();
      await db.insert(activityLogTable).values({
        type: "employee_added",
        description: `Bulk upload: ${emp.name} added to ${data.department}`,
        actorId: emp.id,
        entityId: emp.id,
        entityType: "employee",
      });
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Insert failed";
      const isDuplicate = msg.includes("unique") || msg.includes("duplicate");
      errors.push({ row: rowNum, name: data.name, email: data.email, error: isDuplicate ? "Email already exists" : msg });
    }
  }

  res.json({ total: rows.length, created, failed: errors.length, errors });
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

router.post("/employees/:id/reset-password", async (req, res) => {
  const callerId = (req.session as { userId?: number }).userId;
  const id = Number(req.params.id);

  if (!callerId) { res.status(401).json({ error: "Not authenticated" }); return; }

  // Only admin can reset passwords
  const [caller] = await db.select({ role: employeesTable.role })
    .from(employeesTable).where(eq(employeesTable.id, callerId)).limit(1);
  if (!caller || caller.role !== "admin") {
    res.status(403).json({ error: "Only admins can reset passwords" });
    return;
  }

  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const [target] = await db.select({ id: employeesTable.id, name: employeesTable.name })
    .from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Employee not found" }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(employeesTable)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(employeesTable.id, id));

  await db.insert(activityLogTable).values({
    type: "password_reset",
    description: `Password reset for ${target.name} by admin`,
    actorId: callerId,
    entityId: id,
    entityType: "employee",
  });

  res.json({ ok: true });
});

export default router;
