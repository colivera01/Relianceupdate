import { describe, expect, it } from "vitest";
import {
  filterAssignableEmployeeMemberships,
  type VendorTeamMember,
} from "@/lib/vendor-team-members";

function member(overrides: Partial<VendorTeamMember>): VendorTeamMember {
  return {
    membershipId: "membership-1",
    userId: "user-1",
    name: "Reliance Test",
    email: null,
    phone: null,
    role: "EMPLOYEE",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("filterAssignableEmployeeMemberships", () => {
  it("keeps only active Employee memberships for Service Order assignment", () => {
    const result = filterAssignableEmployeeMemberships([
      member({ membershipId: "employee", role: "EMPLOYEE" }),
      member({ membershipId: "manager", role: "MANAGER", name: "Manager" }),
      member({ membershipId: "pending", status: "PENDING", name: "Pending Employee" }),
    ]);

    expect(result.map((row) => row.membershipId)).toEqual(["employee"]);
  });
});
