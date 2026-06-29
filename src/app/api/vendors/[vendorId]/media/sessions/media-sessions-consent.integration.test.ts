import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const mediaSessionFindFirst = vi.fn();
  const mediaSessionCreate = vi.fn();
  const consentRecordFindUnique = vi.fn();

  const prisma = {
    booking: {
      findFirst: bookingFindFirst,
    },
    mediaSession: {
      findFirst: mediaSessionFindFirst,
      create: mediaSessionCreate,
    },
    consentRecord: {
      findUnique: consentRecordFindUnique,
    },
  };

  return {
    prisma,
    bookingFindFirst,
    mediaSessionFindFirst,
    mediaSessionCreate,
    consentRecordFindUnique,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

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
    hoisted.consentRecordFindUnique.mockReset();

    hoisted.bookingFindFirst.mockResolvedValue({
      id: BOOKING_ID,
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
      }),
      vendor: {
        latitude: 28.5383,
        longitude: -81.3792,
        geocodedAt: new Date("2026-06-27T12:00:00.000Z"),
      },
    });
    hoisted.mediaSessionFindFirst.mockResolvedValue(null);
    hoisted.mediaSessionCreate.mockResolvedValue({
      id: "session-1",
      vendorId: VENDOR_ID,
      bookingId: BOOKING_ID,
      sessionType: "JOB_SERVICE_VIDEO",
      vendorJobVideoStage: "INTRO",
      status: "CREATED",
    });
    hoisted.consentRecordFindUnique.mockResolvedValue(null);
  });

  it("blocks residence location when consent token/accepted state is missing", async () => {
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("CONSENT_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks customer-business location when consent is missing", async () => {
    const { req, ctx } = buildPostRequest({
      locationContext: "customer-business",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("CONSENT_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks residence location when consent token exists but backend record is requested", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue({
      status: "requested",
      bookingId: BOOKING_ID,
      vendorId: VENDOR_ID,
    });
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: true,
      consentToken: "token-requested",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("CONSENT_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("blocks residence location when token is accepted but booking/vendor does not match", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue({
      status: "ACCEPTED",
      bookingId: "booking-other",
      vendorId: "vendor-other",
    });
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: true,
      consentToken: "token-mismatch",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("CONSENT_REQUIRED");
    expect(hoisted.mediaSessionCreate).not.toHaveBeenCalled();
  });

  it("allows staged session creation when accepted consent matches booking and vendor", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue({
      status: "ACCEPTED",
      bookingId: BOOKING_ID,
      vendorId: VENDOR_ID,
    });
    const { req, ctx } = buildPostRequest({
      locationContext: "residence",
      consentAccepted: true,
      consentToken: "token-accepted",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect((json.session as any)?.id).toBe("session-1");
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledTimes(1);
  });

  it("blocks business location when geolocation proof is missing", async () => {
    const { req, ctx } = buildPostRequest({
      locationContext: "business",
    });

    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("BUSINESS_LOCATION_PROOF_REQUIRED");
    expect(hoisted.consentRecordFindUnique).not.toHaveBeenCalled();
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
    expect(hoisted.consentRecordFindUnique).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionCreate).toHaveBeenCalledTimes(1);
  });
});
