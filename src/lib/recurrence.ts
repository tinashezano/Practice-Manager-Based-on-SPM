import type { Recurrence } from "@prisma/client";
import { addDays } from "@/lib/dates";

const MONTHS: Partial<Record<Recurrence, number>> = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, ANNUALLY: 12 };

/** Next occurrence of a YYYY-MM-DD date. Month steps keep the day, clamped to month end (31 Jan → 28/29 Feb). */
export function nextOccurrence(iso: string, rule: Recurrence): string | null {
  if (rule === "NONE") return null;
  if (rule === "WEEKLY") return addDays(iso, 7);
  const months = MONTHS[rule]!;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}
