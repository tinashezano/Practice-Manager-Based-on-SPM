import { addDays, todayISO } from "@/lib/dates";

export type PeriodKey = "month" | "last_month" | "quarter" | "fy" | "last_30";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "fy", label: "Financial year to date" },
  { key: "last_30", label: "Last 30 days" },
];

export type Period = { key: PeriodKey; label: string; from: string; to: string; prevFrom: string; prevTo: string };

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const shiftMonths = (iso: string, n: number) => {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Reporting periods in firm time. "To date" periods end today and compare
 * with the same number of days in the previous period. The financial year
 * starts on 1 March (the common South African year end is end-February).
 */
export function resolvePeriod(key: string | undefined, today = todayISO()): Period {
  const k = (PERIODS.find((p) => p.key === key)?.key ?? "month") as PeriodKey;
  const label = PERIODS.find((p) => p.key === k)!.label;
  let from: string;
  let to = today;
  let prevFrom: string;
  if (k === "month") {
    from = monthStart(today);
    prevFrom = shiftMonths(from, -1);
  } else if (k === "last_month") {
    from = shiftMonths(monthStart(today), -1);
    to = monthEnd(from);
    prevFrom = shiftMonths(from, -1);
    return { key: k, label, from, to, prevFrom, prevTo: monthEnd(prevFrom) };
  } else if (k === "quarter") {
    const m = Number(today.slice(5, 7));
    from = `${today.slice(0, 4)}-${String(m - ((m - 1) % 3)).padStart(2, "0")}-01`;
    prevFrom = shiftMonths(from, -3);
  } else if (k === "fy") {
    const y = Number(today.slice(0, 4));
    from = Number(today.slice(5, 7)) >= 3 ? `${y}-03-01` : `${y - 1}-03-01`;
    prevFrom = shiftMonths(from, -12);
  } else {
    from = addDays(today, -29);
    prevFrom = addDays(from, -30);
  }
  return { key: k, label, from, to, prevFrom, prevTo: addDays(prevFrom, days(from, to)) };
}
