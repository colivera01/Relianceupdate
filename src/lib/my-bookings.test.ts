import { describe, expect, it } from "vitest";
import { isCompletedStatus, normalizeBookingStatusKey } from "@/lib/my-bookings";

describe("shared booking status normalization", () => {
  it("normalizes status for non-portal consumers without classifying customer lifecycle", () => {
    expect(normalizeBookingStatusKey("  COMPLETED ")).toBe("completed");
    expect(normalizeBookingStatusKey(null)).toBe("unknown");
    expect(isCompletedStatus("completed")).toBe(true);
    expect(isCompletedStatus("awaiting_review")).toBe(false);
  });
});
