import { describe, expect, it } from "vitest";
import { nextOccurrence } from "@/lib/recurrence";

describe("nextOccurrence", () => {
  it("handles each rule", () => {
    expect(nextOccurrence("2026-10-12", "NONE")).toBeNull();
    expect(nextOccurrence("2026-10-12", "WEEKLY")).toBe("2026-10-19");
    expect(nextOccurrence("2026-10-25", "MONTHLY")).toBe("2026-11-25");
    expect(nextOccurrence("2026-10-25", "BIMONTHLY")).toBe("2026-12-25");
    expect(nextOccurrence("2026-11-30", "QUARTERLY")).toBe("2027-02-28");
    expect(nextOccurrence("2028-02-29", "ANNUALLY")).toBe("2029-02-28");
  });
  it("clamps to the end of shorter months and rolls over the year", () => {
    expect(nextOccurrence("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(nextOccurrence("2026-12-15", "MONTHLY")).toBe("2027-01-15");
  });
});

import { formatZAR } from "@/lib/deal-meta";

describe("formatZAR", () => {
  it("formats rands with South African spacing", () => {
    expect(formatZAR(4_800_000)).toBe("R 48 000");
    expect(formatZAR(0)).toBe("R 0");
    expect(formatZAR(123_456_789)).toBe("R 1 234 568");
  });
});
