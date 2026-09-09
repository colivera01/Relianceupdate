import { describe, expect, it, vi } from "vitest";

import {
  createVendorManagerAuditNotifications,
  listUnreadVendorManagerNotifications,
  listVendorManagerNotificationHistory,
  markVendorManagerNotificationRead,
} from "./vendor-manager-notifications";

describe("Vendor Manager audit notifications", () => {
  it("creates one durable unread notice for each active manager and no employee", async () => {
    const db: any = {
      vendorMembership: {
        findMany: vi.fn().mockResolvedValue([{ id: "manager-a" }, { id: "manager-b" }]),
      },
      vendorManagerNotification: { upsert: vi.fn().mockResolvedValue({}) },
    };

    await expect(createVendorManagerAuditNotifications(db, {
      vendorId: "vendor-1",
      bookingId: "booking-1",
      packageId: "package-1",
      sourceAdminDecisionId: "decision-1",
      sourceBookingNotificationId: "delivery-1",
      notificationType: "VENDOR_CORE_AUDIT_PASSED_V1",
      title: "Reliance Audit Passed",
      message: "Private Proof was released.",
    })).resolves.toBe(2);

    expect(db.vendorMembership.findMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1", role: "MANAGER", status: "ACTIVE" },
      select: { id: true },
    });
    expect(db.vendorManagerNotification.upsert).toHaveBeenCalledTimes(2);
    expect(db.vendorManagerNotification.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({ recipientMembershipId: "manager-a" }),
    }));
  });

  it("lists only unread notices for the exact manager membership", async () => {
    const db: any = {
      vendorManagerNotification: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await listUnreadVendorManagerNotifications(db, {
      vendorId: "vendor-1",
      membershipId: "manager-1",
    });
    expect(db.vendorManagerNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        vendorId: "vendor-1",
        recipientMembershipId: "manager-1",
        presentationState: "UNREAD",
        readAt: null,
      },
    }));
  });

  it("marks a notice read idempotently without fabricating a detail view", async () => {
    const when = new Date("2026-09-06T12:00:00Z");
    const db: any = {
      vendorManagerNotification: {
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ readAt: when, viewedAt: null }),
      },
    };
    const input = { id: "notice-1", vendorId: "vendor-1", membershipId: "manager-1", now: when };

    await expect(markVendorManagerNotificationRead(db, input)).resolves.toMatchObject({ changed: true });
    await expect(markVendorManagerNotificationRead(db, input)).resolves.toMatchObject({ changed: false });
    expect(db.vendorManagerNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "notice-1",
        vendorId: "vendor-1",
        recipientMembershipId: "manager-1",
        presentationState: "UNREAD",
        readAt: null,
      },
      data: { presentationState: "READ", readAt: when },
    });
  });

  it("records a detail view and read transition together using the authoritative timestamp", async () => {
    const when = new Date("2026-09-06T12:00:00Z");
    const db: any = {
      vendorManagerNotification: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({ readAt: when, viewedAt: when }),
      },
    };

    await expect(markVendorManagerNotificationRead(db, {
      id: "notice-1",
      vendorId: "vendor-1",
      membershipId: "manager-1",
      transition: "VIEW_DETAILS",
      now: when,
    })).resolves.toMatchObject({ changed: true, readAt: when, viewedAt: when });

    expect(db.vendorManagerNotification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { presentationState: "READ", readAt: when, viewedAt: when },
    }));
  });

  it("records the first real detail view after a notice was already marked read", async () => {
    const readAt = new Date("2026-09-06T11:00:00Z");
    const viewedAt = new Date("2026-09-06T12:00:00Z");
    const db: any = {
      vendorManagerNotification: {
        updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({ readAt, viewedAt }),
      },
    };

    await expect(markVendorManagerNotificationRead(db, {
      id: "notice-1",
      vendorId: "vendor-1",
      membershipId: "manager-1",
      transition: "VIEW_DETAILS",
      now: viewedAt,
    })).resolves.toMatchObject({ changed: true, readAt, viewedAt });

    expect(db.vendorManagerNotification.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "notice-1",
        vendorId: "vendor-1",
        recipientMembershipId: "manager-1",
        viewedAt: null,
      },
      data: { viewedAt },
    });
  });

  it("fails closed when the notification does not belong to the exact manager membership", async () => {
    const db: any = {
      vendorManagerNotification: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(markVendorManagerNotificationRead(db, {
      id: "notice-1",
      vendorId: "vendor-1",
      membershipId: "manager-other",
    })).rejects.toThrow("VENDOR_MANAGER_NOTIFICATION_NOT_FOUND");
  });

  it("keeps legacy notices readable without fabricating a read timestamp", async () => {
    const db: any = {
      vendorManagerNotification: { findMany: vi.fn().mockResolvedValue([]) },
      bookingNotification: {
        findMany: vi.fn().mockResolvedValue([{
          id: "legacy-delivery-1",
          bookingId: "booking-1",
          createdAt: new Date("2026-08-24T12:00:00Z"),
          booking: { id: "booking-1", title: "Outlet Installation", service: { name: "Outlet Installation" } },
        }]),
      },
      serviceVideoAdminAuditDecisionEvidence: {
        findMany: vi.fn().mockResolvedValue([{
          bookingId: "booking-1",
          decision: "PASS",
          decidedAt: new Date("2026-08-24T13:00:00Z"),
        }]),
      },
    };

    const history = await listVendorManagerNotificationHistory(db, {
      vendorId: "vendor-1",
      membershipId: "manager-1",
    });

    expect(history).toEqual([expect.objectContaining({
      id: "legacy:legacy-delivery-1",
      historical: true,
      read: true,
      readAt: null,
      viewedAt: null,
    })]);
  });
});
