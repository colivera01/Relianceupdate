import { describe, expect, it } from "vitest";
import { getBusinessHoursStatus, getPublicBusinessHours, normalizeBusinessHours } from "./business-hours";

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

  it("evaluates open-now status in the saved business timezone", () => {
    const schedule = normalizeBusinessHours({
      timezone: "America/New_York",
      days: [{ day: "mon", enabled: true, open: "09:00", close: "17:00" }],
    });

    const status = getBusinessHoursStatus(schedule, new Date("2026-06-29T14:30:00.000Z"));

    expect(status.openNow).toBe(true);
    expect(status.todayLabel).toBe("Monday: 9:00 AM-5:00 PM");
  });

  it("returns a customer-safe weekly schedule only after hours are saved", () => {
    expect(getPublicBusinessHours(null).schedule).toEqual([]);

    const view = getPublicBusinessHours({
      timezone: "America/New_York",
      days: [
        { day: "mon", enabled: true, open: "09:00", close: "17:00" },
        { day: "sun", enabled: false, open: "09:00", close: "17:00" },
      ],
    });

    expect(view.timezone).toBe("America/New_York");
    expect(view.schedule.find((day) => day.day === "mon")?.hoursLabel).toBe("9:00 AM-5:00 PM");
    expect(view.schedule.find((day) => day.day === "sun")?.hoursLabel).toBe("Closed");
  });
});
