// Booking-slot maths. Working hours are in firm time (SAST, UTC+2 all year —
// South Africa has no daylight saving).
export const FIRM_UTC_OFFSET_MIN = 120;

export type Interval = { start: Date; end: Date };

export type SlotRules = {
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  /** ISO weekdays 1=Mon … 7=Sun */
  days: number[];
  startTime: string; // "HH:MM" firm time
  endTime: string;
};

const STEP_MIN = 30;

/** Firm-local date (YYYY-MM-DD) + "HH:MM" → UTC Date. */
export function firmTime(date: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m - FIRM_UTC_OFFSET_MIN);
  return d;
}

/** UTC Date → firm-local YYYY-MM-DD. */
export function firmDate(d: Date) {
  return new Date(d.getTime() + FIRM_UTC_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** UTC Date → firm-local "HH:MM". */
export function firmClock(d: Date) {
  return new Date(d.getTime() + FIRM_UTC_OFFSET_MIN * 60_000).toISOString().slice(11, 16);
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Open slots grouped by firm-local date. A slot is open when it falls inside
 * working hours, respects minimum notice, and doesn't overlap a busy period
 * (each busy period is widened by the buffer on both sides).
 */
export function computeSlots(rules: SlotRules, busy: Interval[], now = new Date()): Record<string, Date[]> {
  const earliest = new Date(now.getTime() + rules.minNoticeHours * 3_600_000);
  const buffered = busy.map((b) => ({
    start: new Date(b.start.getTime() - rules.bufferMinutes * 60_000),
    end: new Date(b.end.getTime() + rules.bufferMinutes * 60_000),
  }));
  const result: Record<string, Date[]> = {};
  const today = firmDate(now);

  for (let i = 0; i <= rules.maxDaysAhead; i++) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    const isoWeekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (!rules.days.includes(isoWeekday)) continue;

    const dayEnd = firmTime(date, rules.endTime);
    const slots: Date[] = [];
    for (let t = firmTime(date, rules.startTime); t.getTime() + rules.durationMinutes * 60_000 <= dayEnd.getTime(); t = new Date(t.getTime() + STEP_MIN * 60_000)) {
      const slot = { start: t, end: new Date(t.getTime() + rules.durationMinutes * 60_000) };
      if (slot.start < earliest) continue;
      if (buffered.some((b) => overlaps(slot, b))) continue;
      slots.push(slot.start);
    }
    if (slots.length) result[date] = slots;
  }
  return result;
}
