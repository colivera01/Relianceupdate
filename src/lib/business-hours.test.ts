import { describe, expect, it } from "vitest";
import { getBusinessHoursStatus, normalizeBusinessHours } from "./business-hours";

describe("business hours", () => {
  it("reports hours not listed when no schedule is configured", () => {
    expect(getBusinessHoursStatus(null).label).toBe("Hours not listed");
  });

  it("reports open now for the current enabled day", () => {
    const schedule = normalizeBusinessHours({
      days: [{ day: "mon", enabled: true, open: "09:00", close: "17:00" }],
    });

    const status = getBusinessHoursStatus(schedule, new Date("2026-06-29T14:30:00"));

    expect(status.openNow).toBe(true);
    expect(status.label).toBe("Open now until 5:00 PM");
  });

  it("reports closed when outside today's hours", () => {
    const schedule = normalizeBusinessHours({
      days: [{ day: "mon", enabled: true, open: "09:00", close: "17:00" }],
    });

    const status = getBusinessHoursStatus(schedule, new Date("2026-06-29T18:30:00"));

    expect(status.openNow).toBe(false);
    expect(status.label).toBe("Closed - opens 9:00 AM");
  });
});
