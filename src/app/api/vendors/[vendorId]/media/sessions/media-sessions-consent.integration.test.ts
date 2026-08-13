import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingFindUnique = vi.fn();
  const vendorUpdate = vi.fn();
  const mediaSessionFindFirst = vi.fn();
  const mediaSessionCreate = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const recordingScopeAssessmentFindFirst = vi.fn();
  const employeeRecordingCertificationFindFirst = vi.fn();
  const recordingLocationAttemptFindFirst = vi.fn();
  const recordingLocationAttemptCreate = vi.fn();
  const recordingLocationExceptionFindFirst = vi.fn();
  const recordingGateMetricCreate = vi.fn();
  const recordingGateDecisionEvidenceCreate = vi.fn();
  const serviceVideoPackageEvidenceFindFirst = vi.fn();
  const serviceVideoManagerDecisionEvidenceFindFirst = vi.fn();
  const transaction = vi.fn();
  const geocodeAddress = vi.fn();

  const prisma = {
    vendor: {
      update: vendorUpdate,
    },
    booking: {
      findFirst: bookingFindFirst,
      findUnique: bookingFindUnique,
    },
    mediaSession: {
      findFirst: mediaSessionFindFirst,
      create: mediaSessionCreate,
    },
    consentRecord: {
      findFirst: consentRecordFindFirst,
    },
    recordingScopeAssessment: { findFirst: recordingScopeAssessmentFindFirst },
    employeeRecordingCertification: { findFirst: employeeRecordingCertificationFindFirst },
    recordingLocationAttempt: {
      findFirst: recordingLocationAttemptFindFirst,
      create: recordingLocationAttemptCreate,
    },
    recordingLocationException: { findFirst: recordingLocationExceptionFindFirst },
    recordingGateMetric: { create: recordingGateMetricCreate },
    recordingGateDecisionEvidence: { create: recordingGateDecisionEvidenceCreate },
    serviceVideoPackageEvidence: { findFirst: serviceVideoPackageEvidenceFindFirst },
    serviceVideoManagerDecisionEvidence: { findFirst: serviceVideoManagerDecisionEvidenceFindFirst },
    $transaction: transaction,
  };

  return {
    prisma,
    bookingFindFirst,
    bookingFindUnique,
    vendorUpdate,
    mediaSessionFindFirst,
    mediaSessionCreate,
    consentRecordFindFirst,
    recordingScopeAssessmentFindFirst,
    employeeRecordingCertificationFindFirst,
    recordingLocationAttemptFindFirst,
    recordingLocationAttemptCreate,
    recordingLocationExceptionFindFirst,
    recordingGateMetricCreate,
    recordingGateDecisionEvidenceCreate,
    serviceVideoPackageEvidenceFindFirst,
    serviceVideoManagerDecisionEvidenceFindFirst,
    transaction,
    geocodeAddress,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/geocoding", async () => {
  const actual = await vi.importActual<typeof import("@/lib/geocoding")>("@/lib/geocoding");
  return {
    ...actual,
    geocodeAddress: hoisted.geocodeAddress,
  };
});

const VENDOR_ID = "vendor-1";
const BOOKING_ID = "booking-1";
let assessmentLocation: "business" | "residence" | "customer-business" = "residence";
let latestLocationAttempt: Record<string, unknown> | null = null;

function buildPostRequest(body: Record<string, unknown>) {
  return {
    req: new Request(`http://localhost/api/vendors/${VENDOR_ID}/media/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: BOOKING_ID,
        serviceId: "service-1",
        title: "Intro video",
        description: "Test upload",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
        ...body,
      }),
    }),
    ctx: { params: Promise.resolve({ vendorId: VENDOR_ID }) },
  };
}

async function toJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

function mockBookingLocation(
  location: "business" | "residence" | "customer-business",
  vendor: Record<string, unknown> = {}
) {
  assessmentLocation = location;
  const snapshotSource =
    location === "business"
      ? "vendor_profile"
      : location === "residence"
        ? "customer_profile"
        : "customer_supplied";
  hoisted.bookingFindFirst.mockResolvedValue({
    id: BOOKING_ID,
    customerMetadata: JSON.stringify({
      vendor_job_assigned_membership_ids: ["membership-1"],
      vendor_job_assignment_generation: 1,
      vendor_job_service_order_released_at: "2026-08-01T12:00:00.000Z",
      vendor_job_service_order_released_membership_ids: ["membership-1"],
      vendor_job_recording_location: location,
      vendor_job_recording_location_snapshot: {
        type: location,
        source: snapshotSource,
        status: "verified_coordinates",
        address: "123 Main St",
        city: "Orlando",
        state: "FL",
        zip_code: "32801",
        latitude: 28.5383,
        longitude: -81.3792,
        captured_at: "2026-06-27T12:00:00.000Z",
        geocoded_at: "2026-06-27T12:00:00.000Z",
      },
    }),
    vendor: {
      address: "123 Main St",
      city: "Orlando",
      state: "FL",
      zipCode: "32801",
      latitude: 28.5383,
      longitude: -81.3792,
      geocodedAt: new Date("2026-06-27T12:00:00.000Z"),
      ...vendor,
    },
  });
}

describe("vendor media sessions consent enforcement integration", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "user-1",
      membershipId: "membership-1",
      role: "EMPLOYEE",
    } as any);

    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.mediaSessionFindFirst.mockReset();
    hoisted.mediaSessionCreate.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.recordingScopeAssessmentFindFirst.mockReset();
    hoisted.employeeRecordingCertificationFindFirst.mockReset();
    hoisted.recordingLocationAttemptFindFirst.mockReset();
    hoisted.recordingLocationAttemptCreate.mockReset();
    hoisted.recordingLocationExceptionFindFirst.mockReset();
    hoisted.recordingGateMetricCreate.mockReset();
    hoisted.recordingGateDecisionEvidenceCreate.mockReset();
    hoisted.recordingGateDecisionEvidenceCreate.mockResolvedValue({ id: "gate-evidence-1" });
    hoisted.serviceVideoPackageEvidenceFindFirst.mockReset();
    hoisted.serviceVideoPackageEvidenceFindFirst.mockResolvedValue(null);
    hoisted.serviceVideoManagerDecisionEvidenceFindFirst.mockReset();
    hoisted.serviceVideoManagerDecisionEvidenceFindFirst.mockResolvedValue(null);
    hoisted.transaction.mockReset();
    hoisted.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => callback(hoisted.prisma));

    mockBookingLocation("residence");
    hoisted.bookingFindUnique.mockResolvedValue({ status: "IN_PROGRESS" });
    hoisted.vendorUpdate.mockReset();
    hoisted.mediaSessionFindFirst.mockResolvedValue(null);
    hoisted.mediaSessionCreate.mockResolvedValue({
      id: "session-1",
      vendorId: VENDOR_ID,
      bookingId: BOOKING_ID,
      sessionType: "JOB_SERVICE_VIDEO",
      vendorJobVideoStage: "INTRO",
      status: "CREATED",
    });
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    latestLocationAttempt = null;
    hoisted.recordingScopeAssessmentFindFirst.mockImplementation(async () => ({
      id: "assessment-1",
      vendorId: VENDOR_ID,
      status: "COMPLETE",
      generation: 1,
      locationType: assessmentLocation,
      riskLevel: assessmentLocation === "business" ? "LEVEL_1" : "LEVEL_2",
      permissionRequired: assessmentLocation !== "business",
      propertyScope: assessmentLocation === "business" ? "vendor_owned" : "customer_owned",
      peopleScope: "none",
      frameControl: "controlled",
      audioRequested: false,
      audioAllowed: false,
      serviceCanContinueWithoutRecording: true,
      scopeHash: `scope-${assessmentLocation}`,
      subjectJson: "{}",
      completedAt: new Date("2026-08-01T11:00:00.000Z"),
      authorities: [],
    }));
    hoisted.employeeRecordingCertificationFindFirst.mockResolvedValue({ id: "cert-1" });
    hoisted.recordingLocationAttemptFindFirst.mockImplementation(async () => latestLocationAttempt);
    hoisted.recordingLocationAttemptCreate.mockImplementation(async ({ data }: any) => {
      latestLocationAttempt = {
        id: "location-attempt-1",
        status: data.status,
        resultCode: data.resultCode,
      };
      return latestLocationAttempt;
    });
    hoisted.recordingLocationExceptionFindFirst.mockResolvedValue(null);
    hoisted.recordingGateMetricCreate.mockResolvedValue({ id: "metric-1" });
    hoisted.geocodeAddress.mockReset();
  });

  it("blocks residence location when consent token/accepted state is missing", async () => {
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("VERIFIED_PERMISSION_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks customer-business location when consent is missing", async () => {
    mockBookingLocation("customer-business");
    const { req, ctx } = buildPostRequest({
      locationContext: "customer-business",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("VERIFIED_PERMISSION_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks residence recording when the backend has no verified permission evidence", async () => {
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: true,
      consentToken: "client-claims-are-ignored",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("VERIFIED_PERMISSION_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks residence recording when an unrelated permission cannot satisfy the scoped query", async () => {
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: true,
      consentToken: "unrelated-client-token",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("VERIFIED_PERMISSION_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("allows staged session creation only when the scoped query finds verified decision evidence", async () => {
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "permission-1",
      status: "accepted",
      lifecycleStatus: "ALLOWED",
      verifiedDecision: true,
      isCurrent: true,
      scopeJson: JSON.stringify({ recordingLocation: "residence" }),
      recipientMismatch: false,
      decisionEvidence: { id: "evidence-1" },
    });
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: false,
      consentToken: "ignored-client-token",
      locationProof: { latitude: 28.53831, longitude: -81.37919, accuracyMeters: 20 },
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect((json.session as any)?.id).toBe("session-1");
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.consentRecordFindFirst).toHaveBeenCalledWith({
      where: {
        bookingId: BOOKING_ID,
        vendorId: VENDOR_ID,
        isCurrent: true,
      },
      orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
      select: expect.objectContaining({
        id: true,
        scopeJson: true,
        decisionEvidence: { select: { id: true } },
      }),
    });
  });

  it("blocks a mismatched residence assessment before mutable metadata or browser input can override it", async () => {
    mockBookingLocation("business");
    assessmentLocation = "residence";
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "permission-1",
      status: "declined",
      lifecycleStatus: "DECLINED",
      verifiedDecision: true,
      isCurrent: true,
      scopeJson: JSON.stringify({ recordingLocation: "residence" }),
      recipientMismatch: false,
      decisionEvidence: { id: "evidence-1" },
    });
    const { req, ctx } = buildPostRequest({
      locationContext: "business",
      locationProof: { latitude: 28.53831, longitude: -81.37919, accuracyMeters: 20 },
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("RECORDING_LOCATION_SNAPSHOT_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("rejects direct media-session creation after submission without creating a duplicate", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({ status: "AWAITING_REVIEW" });
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "permission-1",
      status: "accepted",
      lifecycleStatus: "ALLOWED",
      verifiedDecision: true,
      isCurrent: true,
      scopeJson: JSON.stringify({ recordingLocation: "residence" }),
      recipientMismatch: false,
      decisionEvidence: { id: "evidence-1" },
    });

    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      locationProof: { latitude: 28.53831, longitude: -81.37919, accuracyMeters: 20 },
    });
    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      code: "MANAGER_REVIEW_IN_PROGRESS",
      blocked: {
        responsibleParticipant: "VENDOR_MANAGER",
        resolution: "Wait for manager review.",
      },
    });
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
    expect(hoisted.recordingGateDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it("blocks business location when geolocation proof is missing", async () => {
    mockBookingLocation("business");
    const { req, ctx } = buildPostRequest({
      locationContext: "business",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("BUSINESS_LOCATION_PROOF_REQUIRED");
    expect(hoisted.consentRecordFindFirst).toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks business location when the device is not near the registered address", async () => {
    mockBookingLocation("business");
    const { req, ctx } = buildPostRequest({
      locationContext: "business",
      locationProof: {
        latitude: 29.7604,
        longitude: -95.3698,
        accuracyMeters: 25,
      },
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(403);
    expect(json.code).toBe("BUSINESS_LOCATION_MISMATCH");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("allows business location without customer consent when verified near registered address", async () => {
    mockBookingLocation("business");
    const { req, ctx } = buildPostRequest({
      locationContext: "business",
      locationProof: {
        latitude: 28.53831,
        longitude: -81.37919,
        accuracyMeters: 20,
      },
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect((json.session as any)?.id).toBe("session-1");
    expect(hoisted.consentRecordFindFirst).toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledTimes(1);
  });

  it("does not create a business snapshot at recording time when the immutable snapshot is missing", async () => {
    assessmentLocation = "business";
    hoisted.bookingFindFirst.mockResolvedValue({
      id: BOOKING_ID,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
        vendor_job_assignment_generation: 1,
        vendor_job_service_order_released_at: "2026-08-01T12:00:00.000Z",
        vendor_job_service_order_released_membership_ids: ["membership-1"],
        vendor_job_recording_location: "business",
      }),
      vendor: {
        address: "123 Main St",
        city: "Orlando",
        state: "FL",
        zipCode: "32801",
        latitude: null,
        longitude: null,
        geocodedAt: null,
      },
    });
    const geocodedAt = new Date("2026-07-11T12:00:00.000Z");
    hoisted.geocodeAddress.mockResolvedValue({
      status: "success",
      provider: "census",
      latitude: 28.5383,
      longitude: -81.3792,
      geocodedAt,
    });
    hoisted.vendorUpdate.mockResolvedValue({});

    const { req, ctx } = buildPostRequest({
      locationContext: "business",
      locationProof: {
        latitude: 28.53831,
        longitude: -81.37919,
        accuracyMeters: 20,
      },
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("RECORDING_LOCATION_SNAPSHOT_REQUIRED");
    expect(hoisted.geocodeAddress).not.toHaveBeenCalled();
    expect(hoisted.vendorUpdate).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("does not fall back to the mutable vendor profile when the business snapshot is missing", async () => {
    assessmentLocation = "business";
    hoisted.bookingFindFirst.mockResolvedValue({
      id: BOOKING_ID,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
        vendor_job_assignment_generation: 1,
        vendor_job_service_order_released_at: "2026-08-01T12:00:00.000Z",
        vendor_job_service_order_released_membership_ids: ["membership-1"],
        vendor_job_recording_location: "business",
      }),
      vendor: {
        address: "123 Main St",
        city: "Orlando",
        state: "FL",
        zipCode: "32801",
        latitude: null,
        longitude: null,
        geocodedAt: null,
      },
    });
    hoisted.geocodeAddress.mockResolvedValue({
      status: "not_found",
      provider: "census",
      message: "No geocoding result found for this address.",
    });

    const { req, ctx } = buildPostRequest({
      locationContext: "business",
      locationProof: {
        latitude: 28.53831,
        longitude: -81.37919,
        accuracyMeters: 20,
      },
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("RECORDING_LOCATION_SNAPSHOT_REQUIRED");
    expect(hoisted.geocodeAddress).not.toHaveBeenCalled();
    expect(hoisted.vendorUpdate).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });
});
