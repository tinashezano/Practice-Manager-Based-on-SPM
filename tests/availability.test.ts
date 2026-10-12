import { describe, expect, it } from "vitest";
import { computeSlots, firmClock, firmDate, firmTime, type SlotRules } from "@/lib/availability";

const rules: SlotRules = {
  durationMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  maxDaysAhead: 7,
  days: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "11:00",
};

// Monday 12 Oct 2026, 06:00 SAST
const now = new Date("2026-10-12T04:00:00Z");

describe("firm time helpers", () => {
  it("converts SAST wall time to UTC and back", () => {
    const d = firmTime("2026-10-13", "09:00");
    expect(d.toISOString()).toBe("2026-10-13T07:00:00.000Z");
    expect(firmDate(d)).toBe("2026-10-13");
    expect(firmClock(d)).toBe("09:00");
  });
  it("uses the firm's date near midnight UTC", () => {
    expect(firmDate(new Date("2026-10-12T23:30:00Z"))).toBe("2026-10-13");
  });
});

describe("computeSlots", () => {
  it("offers half-hourly slots inside working hours on working days only", () => {
    const slots = computeSlots(rules, [], now);
    expect(Object.keys(slots)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19"]);
    expect(slots["2026-10-13"]!.map(firmClock)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("respects minimum notice", () => {
    // 12h notice from Mon 06:00 → nothing on Monday itself
    expect(computeSlots(rules, [], now)["2026-10-12"]).toBeUndefined();
  });

  it("blocks busy periods plus the buffer either side", () => {
    const busy = [{ start: firmTime("2026-10-13", "09:45"), end: firmTime("2026-10-13", "10:00") }];
    // Busy 09:30–10:15 after buffering → 09:00 ok (ends 09:30), 09:30 and 10:00 blocked, 10:30 ok
    expect(computeSlots(rules, busy, now)["2026-10-13"]!.map(firmClock)).toEqual(["09:00", "10:30"]);
  });
});
