import { beforeEach, describe, expect, it, vi } from "vitest";

import { rotateVerifiedPermissionLink } from "./request-service";

const hoisted = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    consentRecord: { findUnique: hoisted.findUnique },
    $transaction: hoisted.transaction,
  },
}));
vi.mock("@/lib/admin-audit", () => ({ createAdminAuditLog: hoisted.audit }));

describe("permission resend lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { lifecycleStatus: "WRONG_RECIPIENT", status: "wrong_recipient" },
    { lifecycleStatus: "PENDING", status: "wrong_recipient" },
  ])("fails closed before rotating a wrong-recipient request", async (state) => {
    hoisted.findUnique.mockResolvedValue({
      id: "permission-1",
      bookingId: "booking-1",
      generation: 1,
      decisionEvidence: null,
      booking: {},
      ...state,
    });

    await expect(
      rotateVerifiedPermissionLink({ consentRecordId: "permission-1", actorUserId: "manager-1" }),
    ).rejects.toThrow("Correct the customer recipient");
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.audit).not.toHaveBeenCalled();
  });
});
