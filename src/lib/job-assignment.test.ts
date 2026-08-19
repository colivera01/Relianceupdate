import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseAssignmentMetadata, validateRecordingLocationSnapshot } from "@/lib/job-assignment";
import { buildRecordingLocationSnapshot } from "@/lib/recording-location-snapshot";
import type { GeocodeEvidence } from "@/lib/geocoding";

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

  it.each(["business", "residence", "customer-business"] as const)(
    "requires complete provider evidence on a new %s snapshot",
    (location) => {
      const evidenceWithoutHash: Omit<GeocodeEvidence, "evidenceHash"> = {
        version: 2,
        provider: "azure_maps",
        providerApiVersion: "2025-01-01",
        providerResultId: "address-result-1",
        inputAddress: "407 Boxwood Circle, Winter Springs, FL, 32708",
        normalizedAddress: "407 Boxwood Cir, Winter Springs, FL 32708",
        resultType: "Address",
        precision: "Rooftop",
        confidence: "High",
        matchCodes: ["Good"],
        fallbackUsed: false,
        verifiedAt: "2026-08-13T12:00:00.000Z",
      };
      const validEvidence = {
        ...evidenceWithoutHash,
        evidenceHash: createHash("sha256").update(JSON.stringify(evidenceWithoutHash)).digest("hex"),
      };
      const validSnapshot = buildRecordingLocationSnapshot(location, sourceByLocation[location], {
        address: "407 Boxwood Circle",
        city: "Winter Springs",
        state: "FL",
        zipCode: "32708",
        latitude: 28.698,
        longitude: -81.308,
        geocodedAt: new Date(evidenceWithoutHash.verifiedAt),
        geocodingEvidence: validEvidence,
      });
      expect(
        validateRecordingLocationSnapshot(metadataFor(location, validSnapshot), location),
      ).toMatchObject({
        ok: true,
        snapshot: {
          evidenceVersion: 2,
          geocodingEvidence: { provider: "azure_maps", fallbackUsed: false },
        },
      });
      expect(
        validateRecordingLocationSnapshot(
          metadataFor(location, {
            evidence_version: 2,
            geocoding_evidence: null,
            snapshot_evidence_hash: "b".repeat(64),
          }),
          location,
        ),
      ).toEqual({ ok: false, code: "RECORDING_LOCATION_SNAPSHOT_PROVIDER_EVIDENCE_MISSING" });
      expect(
        validateRecordingLocationSnapshot(
          metadataFor(location, { ...validSnapshot, latitude: 28.7 }),
          location,
        ),
      ).toEqual({ ok: false, code: "RECORDING_LOCATION_SNAPSHOT_PROVIDER_EVIDENCE_INVALID" });
    },
  );

  it("keeps historical snapshots valid without inventing provider evidence", () => {
    const validation = validateRecordingLocationSnapshot(metadataFor("residence"), "residence");
    expect(validation).toMatchObject({
      ok: true,
      snapshot: { evidenceVersion: 1, snapshotEvidenceHash: null, geocodingEvidence: null },
    });
  });
});
