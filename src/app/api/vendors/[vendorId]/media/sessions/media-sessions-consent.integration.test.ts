import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const vendorUpdate = vi.fn();
  const mediaSessionFindFirst = vi.fn();
  const mediaSessionCreate = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const geocodeAddress = vi.fn();

  const prisma = {
    vendor: {
      update: vendorUpdate,
    },
    booking: {
      findFirst: bookingFindFirst,
    },
    mediaSession: {
      findFirst: mediaSessionFindFirst,
      create: mediaSessionCreate,
    },
    consentRecord: {
      findFirst: consentRecordFindFirst,
    },
  };

  return {
    prisma,
    bookingFindFirst,
    vendorUpdate,
    mediaSessionFindFirst,
    mediaSessionCreate,
    consentRecordFindFirst,
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

describe("vendor media sessions consent enforcement integration", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({ userId: "user-1" } as any);

    hoisted.bookingFindFirst.mockReset();
    hoisted.mediaSessionFindFirst.mockReset();
    hoisted.mediaSessionCreate.mockReset();
    hoisted.consentRecordFindFirst.mockReset();

    hoisted.bookingFindFirst.mockResolvedValue({
      id: BOOKING_ID,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
      }),
      vendor: {
        address: "123 Main St",
        city: "Orlando",
        state: "FL",
        zipCode: "32801",
        latitude: 28.5383,
        longitude: -81.3792,
        geocodedAt: new Date("2026-06-27T12:00:00.000Z"),
      },
    });
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
    hoisted.consentRecordFindFirst.mockResolvedValue({ id: "permission-1" });
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: false,
      consentToken: "ignored-client-token",
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
        status: "accepted",
        lifecycleStatus: "ALLOWED",
        verifiedDecision: true,
        decisionEvidence: { isNot: null },
      },
      select: { id: true },
      orderBy: { acceptedAt: "desc" },
    });
  });

  it("blocks business location when geolocation proof is missing", async () => {
    const { req, ctx } = buildPostRequest({
      locationContext: "business",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("BUSINESS_LOCATION_PROOF_REQUIRED");
    expect(hoisted.consentRecordFindFirst).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks business location when the device is not near the registered address", async () => {
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
    expect(hoisted.consentRecordFindFirst).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledTimes(1);
  });

  it("geocodes a complete vendor address before business location verification when saved coordinates are missing", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: BOOKING_ID,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
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

    expect(res.status).toBe(200);
    expect((json.session as any)?.id).toBe("session-1");
    expect(hoisted.geocodeAddress).toHaveBeenCalledWith({
      address: "123 Main St",
      city: "Orlando",
      state: "FL",
      zipCode: "32801",
      latitude: null,
      longitude: null,
      geocodedAt: null,
    });
    expect(hoisted.vendorUpdate).toHaveBeenCalledWith({
      where: { id: VENDOR_ID },
      data: {
        latitude: 28.5383,
        longitude: -81.3792,
        geocodedAt,
      },
    });
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps blocking business recording when a complete vendor address cannot be geocoded", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: BOOKING_ID,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
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
    expect(json.code).toBe("BUSINESS_LOCATION_NOT_CONFIGURED");
    expect(hoisted.vendorUpdate).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });
});
