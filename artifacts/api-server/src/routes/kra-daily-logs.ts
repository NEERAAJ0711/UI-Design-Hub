import { Router } from "express";
import { db, kraDailyLogsTable, krasTable, holidaysTable } from "@workspace/db";
import { eq, and, gte, lte, between } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// ── Working-days helper ────────────────────────────────────────────────────────
async function getWorkingDaysBetween(startDate: string, endDate: string): Promise<string[]> {
  const holidays = await db.select({ date: holidaysTable.date }).from(holidaysTable);
  const holidaySet = new Set(holidays.map((h) => h.date));

  const days: string[] = [];
  const cur = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  while (cur <= end) {
    const dow = cur.getUTCDay(); // 0=Sun, 6=Sat
    const iso = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) {
      days.push(iso);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// ── Recalculate achievementPct for a daily KRA ─────────────────────────────────
async function recalcDailyAchievement(kraId: number, employeeId: number): Promise<number> {
  const [kra] = await db.select({ createdAt: krasTable.createdAt }).from(krasTable).where(eq(krasTable.id, kraId));
  if (!kra) return 0;

  const startDate = kra.createdAt.toISOString().slice(0, 10);
  const todayStr  = new Date().toISOString().slice(0, 10);

  const workingDays = await getWorkingDaysBetween(startDate, todayStr);
  if (workingDays.length === 0) return 0;

  const logs = await db.select({ logDate: kraDailyLogsTable.logDate, isDone: kraDailyLogsTable.isDone })
    .from(kraDailyLogsTable)
    .where(
      and(
        eq(kraDailyLogsTable.kraId, kraId),
        eq(kraDailyLogsTable.employeeId, employeeId),
        gte(kraDailyLogsTable.logDate, startDate),
        lte(kraDailyLogsTable.logDate, todayStr),
      )
    );

  const doneSet = new Set(logs.filter((l) => l.isDone).map((l) => l.logDate));
  const doneDays = workingDays.filter((d) => doneSet.has(d)).length;

  return Math.round((doneDays / workingDays.length) * 100 * 10) / 10;
}

// ── GET /kra-daily-logs ─────────────────────────────────────────────────────────
const ListLogsQuery = z.object({
  kraId:      z.coerce.number().int().optional(),
  employeeId: z.coerce.number().int().optional(),
  startDate:  z.string().optional(),
  endDate:    z.string().optional(),
});

router.get("/kra-daily-logs", async (req, res) => {
  const q = ListLogsQuery.parse(req.query);
  const conditions = [];
  if (q.kraId)      conditions.push(eq(kraDailyLogsTable.kraId, q.kraId));
  if (q.employeeId) conditions.push(eq(kraDailyLogsTable.employeeId, q.employeeId));
  if (q.startDate && q.endDate)
    conditions.push(between(kraDailyLogsTable.logDate, q.startDate, q.endDate));
  else if (q.startDate) conditions.push(gte(kraDailyLogsTable.logDate, q.startDate));
  else if (q.endDate)   conditions.push(lte(kraDailyLogsTable.logDate, q.endDate));

  const rows = await db.select().from(kraDailyLogsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(kraDailyLogsTable.logDate);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
});

// ── POST /kra-daily-logs/check-in ──────────────────────────────────────────────
const CheckInBody = z.object({
  kraId:      z.number().int(),
  employeeId: z.number().int(),
  logDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isDone:     z.boolean(),
  notes:      z.string().optional(),
});

router.post("/kra-daily-logs/check-in", async (req, res) => {
  const body = CheckInBody.parse(req.body);

  // Verify KRA is daily
  const [kra] = await db.select({ frequency: krasTable.frequency, kraStatus: krasTable.kraStatus })
    .from(krasTable).where(eq(krasTable.id, body.kraId));
  if (!kra) { res.status(404).json({ error: "KRA not found" }); return; }
  if (kra.frequency !== "daily") { res.status(400).json({ error: "Check-in only available for daily KRAs" }); return; }
  if (kra.kraStatus === "approved") { res.status(400).json({ error: "KRA already closed" }); return; }

  // Upsert the log entry (check if one exists for this kra+employee+date)
  const [existing] = await db.select({ id: kraDailyLogsTable.id })
    .from(kraDailyLogsTable)
    .where(
      and(
        eq(kraDailyLogsTable.kraId, body.kraId),
        eq(kraDailyLogsTable.employeeId, body.employeeId),
        eq(kraDailyLogsTable.logDate, body.logDate),
      )
    );

  let log;
  if (existing) {
    [log] = await db.update(kraDailyLogsTable)
      .set({ isDone: body.isDone, notes: body.notes ?? null })
      .where(eq(kraDailyLogsTable.id, existing.id))
      .returning();
  } else {
    [log] = await db.insert(kraDailyLogsTable)
      .values({ kraId: body.kraId, employeeId: body.employeeId, logDate: body.logDate, isDone: body.isDone, notes: body.notes })
      .returning();
  }

  // Recalculate and store achievementPct on the KRA
  const achievementPct = await recalcDailyAchievement(body.kraId, body.employeeId);
  await db.update(krasTable).set({ achievementPct }).where(eq(krasTable.id, body.kraId));

  res.json({
    ...log,
    achievementPct,
    createdAt: log!.createdAt.toISOString(),
    updatedAt: log!.updatedAt.toISOString(),
  });
});

// ── GET /kra-daily-logs/working-days ───────────────────────────────────────────
const WorkingDaysQuery = z.object({
  startDate: z.string(),
  endDate:   z.string(),
});

router.get("/kra-daily-logs/working-days", async (req, res) => {
  const { startDate, endDate } = WorkingDaysQuery.parse(req.query);
  const days = await getWorkingDaysBetween(startDate, endDate);
  res.json({ days, count: days.length });
});

export default router;
