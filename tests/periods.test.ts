import { describe, expect, it } from "vitest";
import { availableInRange } from "@/lib/capacity";
import { holidayMap } from "@/lib/holidays";
import { resolvePeriod } from "@/lib/periods";

describe("reporting periods", () => {
  const today = "2026-10-12";
  it("this month compares with the same days last month", () => {
    expect(resolvePeriod("month", today)).toMatchObject({ from: "2026-10-01", to: "2026-10-12", prevFrom: "2026-09-01", prevTo: "2026-09-12" });
  });
  it("last month is the whole month", () => {
    expect(resolvePeriod("last_month", today)).toMatchObject({ from: "2026-09-01", to: "2026-09-30", prevFrom: "2026-08-01", prevTo: "2026-08-31" });
  });
  it("quarter and financial year (from 1 March)", () => {
    expect(resolvePeriod("quarter", today)).toMatchObject({ from: "2026-10-01", prevFrom: "2026-07-01" });
    expect(resolvePeriod("fy", today)).toMatchObject({ from: "2026-03-01", prevFrom: "2025-03-01" });
    expect(resolvePeriod("fy", "2027-02-10").from).toBe("2026-03-01");
  });
  it("defaults to this month", () => {
    expect(resolvePeriod("nonsense", today).key).toBe("month");
  });
});

describe("available hours in a range", () => {
  it("counts working days minus holidays and leave", () => {
    const hol = holidayMap("2026-09-01", "2026-09-30");
    // September 2026: 22 weekdays, minus Heritage Day (Thu 24th) = 21 days × 8h
    expect(availableInRange(40, "2026-09-01", "2026-09-30", hol, [])).toBe(168);
    expect(availableInRange(40, "2026-09-01", "2026-09-30", hol, [{ startDate: "2026-09-07", endDate: "2026-09-08", halfDay: false }])).toBe(152);
  });
});
