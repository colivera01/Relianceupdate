import { describe, expect, it } from "vitest";

import { membershipActivationData } from "./vendor-membership-generation";

describe("Vendor membership generation", () => {
  it.each(["REVOKED", "DENIED", "REMOVED", "INACTIVE"])(
    "increments when %s membership is legitimately reactivated",
    (status) => {
      expect(membershipActivationData({
        currentStatus: status,
        currentGeneration: 3,
        approvedByUserId: "manager-1",
        now: new Date("2026-09-17T12:00:00.000Z"),
      })).toMatchObject({
        status: "ACTIVE",
        membershipGeneration: { increment: 1 },
        approvedByUserId: "manager-1",
      });
    },
  );

  it.each(["PENDING", "ACTIVE"])(
    "does not increment for ordinary %s activation",
    (status) => {
      expect(membershipActivationData({
        currentStatus: status,
        currentGeneration: 3,
      })).not.toHaveProperty("membershipGeneration");
    },
  );
});
