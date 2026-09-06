import { describe, expect, it, vi } from "vitest";

import { navigateAfterNotificationRead } from "./vendor-notification-navigation";

describe("Vendor notification navigation", () => {
  it("continues to the work record when persisting read state fails", async () => {
    const navigate = vi.fn();
    const onReadError = vi.fn();
    await navigateAfterNotificationRead({
      href: "/vendor/jobs/booking-1",
      markRead: vi.fn().mockRejectedValue(new Error("database unavailable")),
      navigate,
      onReadError,
    });
    expect(onReadError).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/vendor/jobs/booking-1");
  });
});
