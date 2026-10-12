import { addDays, startOfWeek } from "@/lib/dates";

// Capacity maths (pure; no database). Weeks start on Monday; working days are
// Monday to Friday excluding public holidays.

export type LeaveRange = { startDate: string; endDate: string; halfDay: boolean };

export function isWeekday(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
}

export function workingDays(from: string, to: string, holidays: Map<string, string>) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWeekday(d) && !holidays.has(d)) days.push(d);
  return days;
}

/** Hours available in a week: daily hours × working days, minus leave. */
export function availableHours(weeklyHours: number, weekStart: string, holidays: Map<string, string>, leave: LeaveRange[]) {
  const perDay = weeklyHours / 5;
  let hours = 0;
  for (const day of workingDays(weekStart, addDays(weekStart, 4), holidays)) {
    const off = leave.find((l) => day >= l.startDate && day <= l.endDate);
    hours += off ? (off.halfDay ? perDay / 2 : 0) : perDay;
  }
  return hours;
}

export type PlannedTask = { id: string; estimateMinutes: number | null; startDate: string | null; dueDate: string | null };

/**
 * Spreads a task's remaining estimate over the working days between its start
 * (or today) and its due date. Overdue work lands in the current week; tasks
 * with no due date are "unscheduled".
 */
export function spreadTask(t: PlannedTask, today: string, holidays: Map<string, string>): { weeks: Map<string, number>; unscheduled: number } {
  const hours = (t.estimateMinutes ?? 0) / 60;
  const weeks = new Map<string, number>();
  if (!hours) return { weeks, unscheduled: 0 };
  if (!t.dueDate) return { weeks, unscheduled: hours };
  if (t.dueDate < today) {
    weeks.set(startOfWeek(today), hours);
    return { weeks, unscheduled: 0 };
  }
  const from = t.startDate && t.startDate > today ? t.startDate : today;
  let days = workingDays(from <= t.dueDate ? from : t.dueDate, t.dueDate, holidays);
  if (!days.length) days = [t.dueDate];
  const per = hours / days.length;
  for (const d of days) {
    const w = startOfWeek(d);
    weeks.set(w, (weeks.get(w) ?? 0) + per);
  }
  return { weeks, unscheduled: 0 };
}

export type Load = "none" | "light" | "healthy" | "busy" | "over";

export function loadLevel(planned: number, available: number): Load {
  if (available <= 0) return planned > 0 ? "over" : "none";
  const pct = planned / available;
  if (pct > 1.05) return "over";
  if (pct > 0.85) return "busy";
  if (pct >= 0.5) return "healthy";
  return planned > 0 ? "light" : "none";
}

/** Hours available between two dates (inclusive), after holidays and leave. */
export function availableInRange(weeklyHours: number, from: string, to: string, holidays: Map<string, string>, leave: LeaveRange[]) {
  const perDay = weeklyHours / 5;
  let hours = 0;
  for (const day of workingDays(from, to, holidays)) {
    const off = leave.find((l) => day >= l.startDate && day <= l.endDate);
    hours += off ? (off.halfDay ? perDay / 2 : 0) : perDay;
  }
  return hours;
}
