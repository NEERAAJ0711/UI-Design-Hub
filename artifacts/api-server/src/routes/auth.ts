import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { departmentsTable } from "@workspace/db/schema";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!employee) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // If no password set yet, use the default "password123"
  const hash = employee.passwordHash ?? (await bcrypt.hash("password123", 10));
  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.userId = employee.id;

  // Fetch department name
  const [dept] = employee.departmentId
    ? await db
        .select({ name: departmentsTable.name })
        .from(departmentsTable)
        .where(eq(departmentsTable.id, employee.departmentId))
        .limit(1)
    : [];

  res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    designation: employee.designation,
    departmentId: employee.departmentId,
    departmentName: dept?.name ?? null,
    managerId: employee.managerId,
    mustChangePassword: employee.mustChangePassword,
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, userId))
    .limit(1);

  if (!employee) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  const [dept] = employee.departmentId
    ? await db
        .select({ name: departmentsTable.name })
        .from(departmentsTable)
        .where(eq(departmentsTable.id, employee.departmentId))
        .limit(1)
    : [];

  res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    designation: employee.designation,
    departmentId: employee.departmentId,
    departmentName: dept?.name ?? null,
    managerId: employee.managerId,
    mustChangePassword: employee.mustChangePassword,
  });
});

// POST /api/auth/change-password
router.post("/auth/change-password", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, userId))
    .limit(1);

  if (!employee) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  const hash = employee.passwordHash ?? (await bcrypt.hash("Password@123", 10));
  const valid = await bcrypt.compare(currentPassword, hash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(employeesTable)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(employeesTable.id, userId));

  res.json({ ok: true });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

export default router;
