import { describe, expect, it } from "vitest";

import {
  formatRelianceDate,
  formatRelianceDateTime,
  formatRelianceTime,
} from "./reliance-date-time";

describe("Reliance date and time formatting", () => {
  it("uses the Reliance operating timezone consistently", () => {
    const value = "2026-10-24T01:59:42.479Z";

    expect(formatRelianceDate(value)).toBe("10/23/2026");
    expect(formatRelianceDateTime(value)).toMatch(/^10\/23\/2026, 9:59:42 PM (EDT|GMT-4)$/);
    expect(formatRelianceTime(value)).toMatch(/^9:59:42 PM (EDT|GMT-4)$/);
  });

  it("keeps a date-only value on its stated calendar day", () => {
    expect(formatRelianceDate("2026-10-21")).toBe("10/21/2026");
  });

  it("returns a stable placeholder for invalid input", () => {
    expect(formatRelianceDate("not-a-date")).toBe("-");
    expect(formatRelianceDateTime(null)).toBe("-");
    expect(formatRelianceTime(undefined)).toBe("-");
  });
});
