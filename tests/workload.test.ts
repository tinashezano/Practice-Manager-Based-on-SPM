import { describe, expect, it } from "vitest";
import { availableHours, loadLevel, spreadTask, workingDays } from "@/lib/capacity";
import { holidayMap, saHolidays } from "@/lib/holidays";
import { formatMinutes, parseDuration } from "@/lib/time-format";

describe("SA public holidays", () => {
  it("calculates Easter holidays", () => {
    const h = Object.fromEntries(saHolidays(2026).map((x) => [x.name, x.date]));
    expect(h["Good Friday"]).toBe("2026-04-03");
    expect(h["Family Day"]).toBe("2026-04-06");
    expect(Object.fromEntries(saHolidays(2027).map((x) => [x.name, x.date]))["Good Friday"]).toBe("2027-03-26");
  });
  it("moves Sunday holidays to Monday", () => {
    // 9 August 2026 is a Sunday
    expect(saHolidays(2026).find((x) => x.date === "2026-08-10")?.name).toBe("National Women's Day (observed)");
  });
});

describe("capacity", () => {
  const hol = holidayMap("2026-01-01", "2026-12-31");
  it("removes holidays and leave from a 40h week", () => {
    expect(availableHours(40, "2026-10-12", hol, [])).toBe(40);
    // Week of Heritage Day (Thu 24 Sep 2026)
    expect(availableHours(40, "2026-09-21", hol, [])).toBe(32);
    expect(availableHours(40, "2026-10-12", hol, [{ startDate: "2026-10-14", endDate: "2026-10-15", halfDay: false }])).toBe(24);
    expect(availableHours(40, "2026-10-12", hol, [{ startDate: "2026-10-16", endDate: "2026-10-16", halfDay: true }])).toBe(36);
  });
  it("lists working days", () => {
    expect(workingDays("2026-12-21", "2026-12-27", hol)).toEqual(["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24"]);
  });
  it("spreads estimates across the task window", () => {
    // 10h from Mon 12 Oct to Fri 23 Oct = 10 working days → 5h per week
    const r = spreadTask({ id: "t", estimateMinutes: 600, startDate: "2026-10-12", dueDate: "2026-10-23" }, "2026-10-12", hol);
    expect(Object.fromEntries(r.weeks)).toEqual({ "2026-10-12": 5, "2026-10-19": 5 });
  });
  it("puts overdue work in this week and undated work in unscheduled", () => {
    expect(Object.fromEntries(spreadTask({ id: "t", estimateMinutes: 120, startDate: null, dueDate: "2026-10-01" }, "2026-10-14", hol).weeks)).toEqual({ "2026-10-12": 2 });
    expect(spreadTask({ id: "t", estimateMinutes: 120, startDate: null, dueDate: null }, "2026-10-14", hol).unscheduled).toBe(2);
  });
  it("rates load", () => {
    expect(loadLevel(0, 40)).toBe("none");
    expect(loadLevel(10, 40)).toBe("light");
    expect(loadLevel(30, 40)).toBe("healthy");
    expect(loadLevel(38, 40)).toBe("busy");
    expect(loadLevel(45, 40)).toBe("over");
    expect(loadLevel(2, 0)).toBe("over");
  });
});

describe("durations", () => {
  it("parses what people type", () => {
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("1,5")).toBe(90);
    expect(parseDuration("90m")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("2")).toBe(120);
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
  it("formats", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
  });
});
