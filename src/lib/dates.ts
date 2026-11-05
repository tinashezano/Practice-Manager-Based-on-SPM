// Task/project dates are calendar dates (Postgres DATE), stored as UTC midnight.
// "Today" is evaluated in the firm's timezone.
export const FIRM_TZ = "Africa/Johannesburg";

// Creating an Intl.DateTimeFormat is ~100× slower than using one, and dates are
// formatted on nearly every row, so formatters are created once and reused.
const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateFormatter(locale: string, opts: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
}

/** Today's date in the firm's timezone as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  return dateFormatter("en-CA", { timeZone: FIRM_TZ }).format(now);
}

export function toISODate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function parseISODate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso)!;
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseISODate(b)!.getTime() - parseISODate(a)!.getTime()) / 86_400_000);
}

/** Monday of the week containing iso. */
export function startOfWeek(iso: string) {
  const dow = (parseISODate(iso)!.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!d) return "";
  const date = typeof d === "string" ? parseISODate(d) : d;
  return date ? dateFormatter("en-ZA", { timeZone: "UTC", ...opts }).format(date) : "";
}

export function formatDateTime(d: Date) {
  return dateFormatter("en-ZA", { timeZone: FIRM_TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** The 6-week (Mon–Sun) grid shown for a calendar month "YYYY-MM". */
export function monthGridRange(month: string) {
  const start = startOfWeek(`${month}-01`);
  return { start, end: addDays(start, 41) };
}

export const TIMELINE_DAYS = 42;
