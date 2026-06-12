import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import { departmentsTable, employeesTable, designationsTable, companiesTable } from "./src/schema/index.js";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("Password@123", 10);

  // Company
  await db.insert(companiesTable).values({ name: "RPS Infrastructure Limited" }).onConflictDoNothing();

  // Departments
  const deptNames = [
    "Management",
    "Engineering",
    "Human Resources",
    "Finance",
    "Operations",
    "Sales",
    "Marketing",
    "IT",
    "Legal",
    "Procurement",
    "Quality Assurance",
  ];

  for (const name of deptNames) {
    await db.insert(departmentsTable).values({ name }).onConflictDoNothing();
  }

  // Fetch inserted departments
  const departments = await db.select().from(departmentsTable);
  const deptMap = Object.fromEntries(departments.map((d) => [d.name, d.id]));

  // Designations
  const designationNames = [
    "Managing Director",
    "General Manager",
    "Senior Engineer",
    "Engineer",
    "HR Manager",
    "HR Executive",
    "Finance Manager",
    "Accountant",
    "Operations Manager",
    "Sales Manager",
    "IT Manager",
  ];
  for (const name of designationNames) {
    await db.insert(designationsTable).values({ name }).onConflictDoNothing();
  }

  // Admin / Management account
  const [admin] = await db
    .insert(employeesTable)
    .values({
      name: "Admin User",
      email: "admin@rpsgroup.com",
      passwordHash: password,
      role: "management",
      designation: "Managing Director",
      company: "RPS Infrastructure Limited",
      departmentId: deptMap["Management"]!,
      mustChangePassword: false,
    })
    .onConflictDoNothing()
    .returning();

  // HOD for Engineering
  const [hodEng] = await db
    .insert(employeesTable)
    .values({
      name: "Priya Sharma",
      email: "hod.engineering@rpsgroup.com",
      passwordHash: password,
      role: "hod",
      designation: "General Manager",
      company: "RPS Infrastructure Limited",
      departmentId: deptMap["Engineering"]!,
      mustChangePassword: false,
    })
    .onConflictDoNothing()
    .returning();

  // Manager under Engineering HOD
  const [mgr] = await db
    .insert(employeesTable)
    .values({
      name: "Rahul Verma",
      email: "manager.eng@rpsgroup.com",
      passwordHash: password,
      role: "manager",
      designation: "Senior Engineer",
      company: "RPS Infrastructure Limited",
      departmentId: deptMap["Engineering"]!,
      managerId: hodEng?.id ?? null,
      mustChangePassword: false,
    })
    .onConflictDoNothing()
    .returning();

  // Employee
  await db
    .insert(employeesTable)
    .values({
      name: "Amit Kumar",
      email: "employee@rpsgroup.com",
      passwordHash: password,
      role: "employee",
      designation: "Engineer",
      company: "RPS Infrastructure Limited",
      departmentId: deptMap["Engineering"]!,
      managerId: mgr?.id ?? null,
      mustChangePassword: false,
    })
    .onConflictDoNothing();

  // HR HOD
  await db
    .insert(employeesTable)
    .values({
      name: "Sunita Patel",
      email: "hod.hr@rpsgroup.com",
      passwordHash: password,
      role: "hod",
      designation: "HR Manager",
      company: "RPS Infrastructure Limited",
      departmentId: deptMap["Human Resources"]!,
      mustChangePassword: false,
    })
    .onConflictDoNothing();

  // System Admin
  await db
    .insert(employeesTable)
    .values({
      name: "System Administrator",
      email: "sysadmin@rpsgroup.com",
      passwordHash: password,
      role: "admin",
      designation: "System Administrator",
      company: "RPS Infrastructure Limited",
      departmentId: deptMap["IT"]!,
      mustChangePassword: false,
    })
    .onConflictDoNothing();

  console.log("Seed complete!");
  console.log("");
  console.log("Demo accounts (all use password: Password@123)");
  console.log("  sysadmin@rpsgroup.com      — System Admin");
  console.log("  admin@rpsgroup.com         — Management (Admin)");
  console.log("  hod.engineering@rpsgroup.com — HOD Engineering");
  console.log("  manager.eng@rpsgroup.com   — Manager Engineering");
  console.log("  employee@rpsgroup.com      — Employee Engineering");
  console.log("  hod.hr@rpsgroup.com        — HOD HR");

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
