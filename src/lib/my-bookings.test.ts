import { describe, expect, it } from "vitest";
import {
  bookingMatchesTab,
  formatMyBookingsStatusDisplay,
  isActiveInProgressFlowStatus,
  isArchivedStatus,
  resolveBookingScheduleInstant,
} from "@/lib/my-bookings";

describe("my-bookings helpers", () => {
  it("treats active booking flow states consistently", () => {
    expect(isActiveInProgressFlowStatus("pending")).toBe(true);
    expect(isActiveInProgressFlowStatus("confirmed")).toBe(true);
    expect(isActiveInProgressFlowStatus("awaiting_review")).toBe(true);
    expect(isActiveInProgressFlowStatus("completed")).toBe(false);
    expect(isArchivedStatus("archived")).toBe(true);
  });

  it("shows a truthful past-schedule label for stale active bookings", () => {
    const { instant } = resolveBookingScheduleInstant("2026-05-04", "14:00", null);
    const now = new Date("2026-06-03T12:00:00.000Z");
    expect(
      formatMyBookingsStatusDisplay("pending", {
        scheduleInstant: instant,
        now,
      })
    ).toBe("Scheduled date passed");
  });

  it("keeps future active bookings labeled by their actual workflow status", () => {
    const { instant } = resolveBookingScheduleInstant("2026-07-04", "14:00", null);
    const now = new Date("2026-06-03T12:00:00.000Z");
    expect(
      formatMyBookingsStatusDisplay("pending", {
        scheduleInstant: instant,
        now,
      })
    ).toBe("Pending");
  });

  it("routes stale active bookings into the follow-up bucket instead of completed history", () => {
    const { instant } = resolveBookingScheduleInstant("2026-05-04", "14:00", null);
    const now = new Date("2026-06-03T12:00:00.000Z");

    expect(bookingMatchesTab("needs_follow_up", "pending", instant, now)).toBe(true);
    expect(bookingMatchesTab("past", "pending", instant, now)).toBe(false);
    expect(bookingMatchesTab("upcoming", "pending", instant, now)).toBe(false);
  });

  it("keeps archived bookings out of completed history", () => {
    const { instant } = resolveBookingScheduleInstant("2026-05-04", "14:00", null);
    const now = new Date("2026-06-03T12:00:00.000Z");

    expect(bookingMatchesTab("archived", "archived", instant, now)).toBe(true);
    expect(bookingMatchesTab("past", "archived", instant, now)).toBe(false);
  });
});
