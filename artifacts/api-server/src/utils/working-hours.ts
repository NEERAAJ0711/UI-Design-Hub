export const APPROVAL_SLA_HOURS = 4;
export const WORK_START_HOUR = 10; // 10 AM
export const WORK_END_HOUR = 18;   // 6 PM

/**
 * Calculate working hours elapsed between two timestamps.
 * Working hours: Mon–Fri, 10:00 AM – 6:00 PM, excluding holidays.
 */
export function workingHoursElapsed(
  from: Date,
  to: Date,
  holidayDates: Set<string> = new Set(),
): number {
  if (from >= to) return 0;

  let totalHours = 0;
  const current = new Date(from);

  while (current < to) {
    const day = current.getDay(); // 0=Sun, 6=Sat
    const dateStr = current.toISOString().split("T")[0];

    if (day === 0 || day === 6 || holidayDates.has(dateStr!)) {
      current.setDate(current.getDate() + 1);
      current.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    const dayStart = new Date(current);
    dayStart.setHours(WORK_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    const windowStart = current < dayStart ? dayStart : current;
    const windowEnd = to < dayEnd ? to : dayEnd;

    if (windowStart < windowEnd) {
      totalHours += (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
    }

    current.setDate(current.getDate() + 1);
    current.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  return Math.round(totalHours * 100) / 100;
}

export function approvalTimerInfo(
  pendingAt: Date | null | undefined,
  now: Date,
  holidayDates: Set<string>,
): { workingHoursElapsed: number; isOverdue: boolean } {
  if (!pendingAt) return { workingHoursElapsed: 0, isOverdue: false };
  const elapsed = workingHoursElapsed(pendingAt, now, holidayDates);
  return { workingHoursElapsed: elapsed, isOverdue: elapsed > APPROVAL_SLA_HOURS };
}
