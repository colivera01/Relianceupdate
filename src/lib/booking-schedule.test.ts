import { describe, expect, it } from "vitest";
import { resolveBookingSchedule, zonedDateTimeToUtc } from "./booking-schedule";

describe("resolveBookingSchedule", () => {
  it("uses the browser's absolute timestamp without a server timezone shift", () => {
    const scheduled = resolveBookingSchedule({
      scheduledFor: "2026-07-22T16:15:00.000Z",
      bookingDate: "2026-07-22",
      bookingTime: "12:15:00",
    });
    expect(scheduled?.toISOString()).toBe("2026-07-22T16:15:00.000Z");
  });

  it("converts New York winter and summer wall clocks to the correct UTC instant", () => {
    expect(
      zonedDateTimeToUtc({
        date: "2026-01-15",
        time: "09:00",
        timeZone: "America/New_York",
      })?.toISOString(),
    ).toBe("2026-01-15T14:00:00.000Z");
    expect(
      zonedDateTimeToUtc({
        date: "2026-07-15",
        time: "09:00",
        timeZone: "America/New_York",
      })?.toISOString(),
    ).toBe("2026-07-15T13:00:00.000Z");
  });

  it("rejects a nonexistent daylight-saving wall-clock time", () => {
    expect(
      zonedDateTimeToUtc({
        date: "2026-03-08",
        time: "02:30",
        timeZone: "America/New_York",
      }),
    ).toBeNull();
  });

  it("does not silently replace a missing or invalid schedule with now", () => {
    expect(resolveBookingSchedule({})).toBeNull();
    expect(
      resolveBookingSchedule({ bookingDate: "2026-02-30", bookingTime: "09:00" }),
    ).toBeNull();
  });
});
