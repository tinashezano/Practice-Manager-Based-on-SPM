import { availableInRange } from "@/lib/capacity";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { holidayMap } from "@/lib/holidays";

// Firm metrics. Definitions (also shown in the UI):
// - Revenue: payments received (Paystack, EFT), excluding VAT, by payment date.
//   Recurring = retainer months; once-off = once-off fees.
// - Work value: billable time × each person's billing rate (rate at the time).
// - Staff cost: all time × cost rate.
// - Margin: (revenue − staff cost) ÷ revenue.
// - Utilisation: billable hours ÷ available hours (after holidays and leave).
// - Realisation: revenue ÷ work value: how much of the work done is earned.
// - WIP: billable work value on tasks that aren't done yet, aged by when it was logged.

const startOf = (iso: string) => new Date(`${iso}T00:00:00+02:00`);
const endOf = (iso: string) => new Date(`${addDays(iso, 1)}T00:00:00+02:00`);
const sastDate = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
const exVat = (incl: number, rate: number) => Math.round((incl * 100) / (100 + rate));

export type RevenueRow = { date: string; client: string; clientId: string | null; recurring: number; onceOff: number; byService: Map<string, number> };

/** Payments received in the range, excl. VAT, split recurring vs once-off and allocated to services. */
export async function revenue(from: string, to: string) {
  const payments = await db.payment.findMany({
    where: { status: "SUCCESS", paidAt: { gte: startOf(from), lt: endOf(to) } },
    include: { proposal: { include: { lineItems: true, deal: { select: { name: true } }, client: { select: { id: true, name: true } } } } },
  });
  const rows: RevenueRow[] = payments.map((pay) => {
    const p = pay.proposal;
    const total = exVat(pay.amountCents, p.vatRatePercent);
    const lineEx = (b: "ONCE_OFF" | "MONTHLY") => p.lineItems.filter((l) => l.billingType === b).map((l) => ({ name: l.name, ex: l.quantity * l.unitPriceCents }));
    let recurring: number;
    let onceOff: number;
    if (pay.isRenewal) {
      recurring = total;
      onceOff = 0;
    } else {
      // First payment = once-off fees + first month; scale to what was actually received.
      const expected = p.onceOffExVat + p.monthlyExVat || 1;
      recurring = Math.round((total * p.monthlyExVat) / expected);
      onceOff = total - recurring;
    }
    const byService = new Map<string, number>();
    for (const [part, lines] of [[recurring, lineEx("MONTHLY")], [onceOff, lineEx("ONCE_OFF")]] as const) {
      const sum = lines.reduce((n, l) => n + l.ex, 0);
      for (const l of lines) if (sum) byService.set(l.name, (byService.get(l.name) ?? 0) + Math.round((part * l.ex) / sum));
    }
    return { date: sastDate(pay.paidAt!), client: p.client?.name ?? p.deal.name, clientId: p.client?.id ?? null, recurring, onceOff, byService };
  });
  return rows;
}

export type TimeRow = { date: string; userId: string; minutes: number; billable: boolean; value: number; cost: number; project: string | null; clientId: string | null };

export async function timeEntries(from: string, to: string) {
  const entries = await db.timeEntry.findMany({
    where: { running: false, date: { gte: parseISODate(from)!, lte: parseISODate(to)! } },
    select: { date: true, userId: true, minutes: true, billable: true, billRateCents: true, costRateCents: true, clientId: true, task: { select: { project: { select: { name: true } } } } },
  });
  return entries.map<TimeRow>((e) => ({
    date: e.date.toISOString().slice(0, 10),
    userId: e.userId,
    minutes: e.minutes,
    billable: e.billable,
    value: e.billable ? Math.round((e.minutes * e.billRateCents) / 60) : 0,
    cost: Math.round((e.minutes * e.costRateCents) / 60),
    project: e.task?.project?.name ?? null,
    clientId: e.clientId,
  }));
}

/** Team hours available in a range (only up to today for current periods). */
export async function availableTeamHours(from: string, to: string) {
  const end = to > todayISO() ? todayISO() : to;
  if (end < from) return 0;
  const [users, leave] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, weeklyCapacityHours: true } }),
    db.leave.findMany({ where: { startDate: { lte: parseISODate(end)! }, endDate: { gte: parseISODate(from)! } } }),
  ]);
  const holidays = holidayMap(from, end);
  return users.reduce(
    (n, u) =>
      n +
      availableInRange(
        u.weeklyCapacityHours,
        from,
        end,
        holidays,
        leave.filter((l) => l.userId === u.id).map((l) => ({ startDate: l.startDate.toISOString().slice(0, 10), endDate: l.endDate.toISOString().slice(0, 10), halfDay: l.halfDay })),
      ),
    0,
  );
}

export const WIP_BUCKETS = [
  { key: "0-30", label: "0–30 days", max: 30, tone: "neutral" as const },
  { key: "31-60", label: "31–60 days", max: 60, tone: "neutral" as const },
  { key: "61-90", label: "61–90 days", max: 90, tone: "warning" as const },
  { key: "90+", label: "90+ days", max: Infinity, tone: "danger" as const },
];

/** Billable work value on unfinished tasks, aged by the date the time was logged. */
export async function wip() {
  const today = todayISO();
  const entries = await db.timeEntry.findMany({
    where: { running: false, billable: true, task: { status: { not: "DONE" } } },
    select: { date: true, minutes: true, billRateCents: true, taskId: true, clientId: true },
  });
  const buckets = WIP_BUCKETS.map((b) => ({ ...b, value: 0, tasks: new Set<string>() }));
  for (const e of entries) {
    const age = Math.round((Date.parse(`${today}T00:00:00Z`) - e.date.getTime()) / 86_400_000);
    const b = buckets.find((x) => age <= x.max)!;
    b.value += Math.round((e.minutes * e.billRateCents) / 60);
    if (e.taskId) b.tasks.add(e.taskId);
  }
  return buckets.map((b) => ({ key: b.key, label: b.label, tone: b.tone, value: b.value, jobs: b.tasks.size }));
}

export function sum<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((n, r) => n + f(r), 0);
}

export function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}
