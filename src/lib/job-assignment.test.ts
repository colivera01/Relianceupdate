import { describe, expect, it } from "vitest";
import { parseAssignmentMetadata, validateRecordingLocationSnapshot } from "@/lib/job-assignment";

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

describe("validateRecordingLocationSnapshot", () => {
  const sourceByLocation = {
    business: "vendor_profile",
    residence: "customer_profile",
    "customer-business": "customer_supplied",
  } as const;

  function metadataFor(location: keyof typeof sourceByLocation, overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      vendor_job_recording_location: location,
      vendor_job_recording_location_snapshot: {
        type: location,
        source: sourceByLocation[location],
        status: "verified_coordinates",
        address: "407 Boxwood Circle",
        city: "Winter Springs",
        state: "FL",
        zip_code: "32708",
        latitude: 28.698,
        longitude: -81.308,
        geocoded_at: "2026-08-13T12:00:00.000Z",
        captured_at: "2026-08-13T12:01:00.000Z",
        ...overrides,
      },
    });
  }

  it.each(["business", "residence", "customer-business"] as const)(
    "accepts a complete immutable %s snapshot from its matching source",
    (location) => {
      expect(validateRecordingLocationSnapshot(metadataFor(location), location)).toMatchObject({ ok: true });
    },
  );

  it.each(["business", "residence", "customer-business"] as const)(
    "rejects zero coordinates for %s",
    (location) => {
      expect(
        validateRecordingLocationSnapshot(metadataFor(location, { latitude: 0, longitude: 0 }), location),
      ).toEqual({ ok: false, code: "RECORDING_LOCATION_SNAPSHOT_ZERO_COORDINATES" });
    },
  );

  it.each(["business", "residence", "customer-business"] as const)(
    "rejects missing geocoding evidence for %s",
    (location) => {
      expect(
        validateRecordingLocationSnapshot(metadataFor(location, { geocoded_at: null }), location),
      ).toEqual({ ok: false, code: "RECORDING_LOCATION_SNAPSHOT_GEOCODING_EVIDENCE_MISSING" });
    },
  );

  it("rejects the wrong approved source instead of substituting another location type", () => {
    expect(
      validateRecordingLocationSnapshot(metadataFor("residence", { source: "vendor_profile" }), "residence"),
    ).toEqual({ ok: false, code: "RECORDING_LOCATION_SNAPSHOT_SOURCE_MISMATCH" });
  });
});
