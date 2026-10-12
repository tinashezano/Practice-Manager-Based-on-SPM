import { addDays } from "@/lib/dates";

// South African public holidays (Public Holidays Act 36 of 1994).
// When a holiday falls on a Sunday, the Monday after is a public holiday.

function easterSunday(year: number) {
  // Anonymous Gregorian algorithm.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const FIXED: [string, string][] = [
  ["01-01", "New Year's Day"],
  ["03-21", "Human Rights Day"],
  ["04-27", "Freedom Day"],
  ["05-01", "Workers' Day"],
  ["06-16", "Youth Day"],
  ["08-09", "National Women's Day"],
  ["09-24", "Heritage Day"],
  ["12-16", "Day of Reconciliation"],
  ["12-25", "Christmas Day"],
  ["12-26", "Day of Goodwill"],
];

export function saHolidays(year: number): { date: string; name: string }[] {
  const easter = easterSunday(year);
  const list: { date: string; name: string }[] = [
    { date: addDays(easter, -2), name: "Good Friday" },
    { date: addDays(easter, 1), name: "Family Day" },
  ];
  for (const [md, name] of FIXED) {
    const date = `${year}-${md}`;
    list.push({ date, name });
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) list.push({ date: addDays(date, 1), name: `${name} (observed)` });
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Map of YYYY-MM-DD → holiday name for every year touched by [from, to]. */
export function holidayMap(from: string, to: string) {
  const map = new Map<string, string>();
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) for (const h of saHolidays(y)) map.set(h.date, h.name);
  return map;
}
