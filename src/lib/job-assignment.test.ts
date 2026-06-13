import { describe, expect, it } from "vitest";
import { parseAssignmentMetadata } from "@/lib/job-assignment";

describe("parseAssignmentMetadata", () => {
  it("returns explicit primary assignment when present", () => {
    const metadata = parseAssignmentMetadata(
      JSON.stringify({
        vendor_job_assigned_membership_ids: ["member-1", "member-2"],
        vendor_job_assigned_employees: ["Tech One", "Tech Two"],
        vendor_job_primary_membership_id: "member-2",
        vendor_job_primary_employee: "Tech Two",
      })
    );

    expect(metadata.assignedMembershipIds).toEqual(["member-1", "member-2"]);
    expect(metadata.assignedEmployees).toEqual(["Tech One", "Tech Two"]);
    expect(metadata.primaryMembershipId).toBe("member-2");
    expect(metadata.primaryEmployeeName).toBe("Tech Two");
  });

  it("falls back to the first assigned employee for older job metadata", () => {
    const metadata = parseAssignmentMetadata(
      JSON.stringify({
        vendor_job_assigned_membership_ids: ["member-1"],
        vendor_job_assigned_employees: ["Tech One"],
      })
    );

    expect(metadata.primaryMembershipId).toBe("member-1");
    expect(metadata.primaryEmployeeName).toBe("Tech One");
  });

  it("returns empty assignment state for invalid metadata", () => {
    const metadata = parseAssignmentMetadata("{broken");

    expect(metadata).toEqual({
      assignedMembershipIds: [],
      assignedEmployees: [],
      primaryMembershipId: null,
      primaryEmployeeName: null,
    });
  });
});
