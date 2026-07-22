import { describe, expect, it } from "vitest";
import { resolveBookingSchedule } from "./booking-schedule";

describe("resolveBookingSchedule", () => {
  it("uses the browser's absolute timestamp without a server timezone shift", () => {
    const scheduled = resolveBookingSchedule({
      scheduledFor: "2026-07-22T16:15:00.000Z",
      bookingDate: "2026-07-22",
      bookingTime: "12:15:00",
    });
    expect(scheduled.toISOString()).toBe("2026-07-22T16:15:00.000Z");
  });
});
