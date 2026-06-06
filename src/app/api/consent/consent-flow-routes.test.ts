import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getConsent } from "./[token]/route";
import { POST as acceptConsent } from "./accept/route";
import { POST as declineConsent } from "./decline/route";

const hoisted = vi.hoisted(() => {
  const consentRecordFindUnique = vi.fn();
  const consentRecordUpdate = vi.fn();
  const consentEventCreate = vi.fn();
  const prisma = {
    consentRecord: {
      findUnique: consentRecordFindUnique,
      update: consentRecordUpdate,
    },
    consentEvent: {
      create: consentEventCreate,
    },
  };

  return {
    prisma,
    consentRecordFindUnique,
    consentRecordUpdate,
    consentEventCreate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

const CONSENT_TOKEN = "e2e-consent-pending-token";
const REQUESTED_AT = new Date("2026-05-01T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-12-01T12:00:00.000Z");

function buildConsentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "consent-1",
    token: CONSENT_TOKEN,
    status: "requested",
    consentType: "video_access",
    requestedAt: REQUESTED_AT,
    acceptedAt: null,
    declinedAt: null,
    expiresAt: EXPIRES_AT,
    termsVersion: null,
    privacyVersion: null,
    mediaSessionId: "media-session-1",
    booking: {
      id: "booking-1",
      title: "E2E Consent Smoke Booking",
      clientName: "E2E Consent Customer",
      scheduledFor: new Date("2026-06-02T14:00:00.000Z"),
      service: { id: "service-1", name: "E2E Consent Smoke Service", price: 125 },
    },
    vendor: {
      id: "vendor-1",
      name: "E2E Consent Vendor",
      businessName: "E2E Consent Vendor LLC",
    },
    ...overrides,
  };
}

function jsonRequest(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("consent token and response routes", () => {
  beforeEach(() => {
    hoisted.consentRecordFindUnique.mockReset();
    hoisted.consentRecordUpdate.mockReset();
    hoisted.consentEventCreate.mockReset();
  });

  it("loads a valid pending consent token with booking and vendor context", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue(buildConsentFixture());

    const res = await getConsent(new Request(`http://localhost/api/consent/${CONSENT_TOKEN}`), {
      params: Promise.resolve({ token: CONSENT_TOKEN }),
    });
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.consent).toMatchObject({
      token: CONSENT_TOKEN,
      status: "requested",
      canRespond: true,
      respondBlockedReason: null,
      mediaSessionId: "media-session-1",
      vendor: { businessName: "E2E Consent Vendor LLC" },
      booking: {
        title: "E2E Consent Smoke Booking",
        service: { name: "E2E Consent Smoke Service" },
      },
    });
  });

  it("accepts a pending consent and records the audit event", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue(buildConsentFixture());
    hoisted.consentRecordUpdate.mockResolvedValue({
      id: "consent-1",
      status: "accepted",
      expiresAt: EXPIRES_AT,
      acceptedAt: new Date("2026-05-01T12:05:00.000Z"),
    });
    hoisted.consentEventCreate.mockResolvedValue({ id: "event-accepted" });

    const res = await acceptConsent(
      jsonRequest(
        "/api/consent/accept",
        { token: CONSENT_TOKEN, termsVersion: "terms-2026-05", privacyVersion: "privacy-2026-05" },
        { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest-consent-smoke" }
      ) as any
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(hoisted.consentRecordUpdate).toHaveBeenCalledWith({
      where: { token: CONSENT_TOKEN },
      data: expect.objectContaining({
        status: "accepted",
        termsVersion: "terms-2026-05",
        privacyVersion: "privacy-2026-05",
        ipAddress: "203.0.113.10",
        userAgent: "vitest-consent-smoke",
        documentHash: expect.any(String),
      }),
    });
    expect(hoisted.consentEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentRecordId: "consent-1",
        eventType: "accepted",
      }),
    });
  });

  it("declines a pending consent and records the decline reason", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue(buildConsentFixture());
    hoisted.consentRecordUpdate.mockResolvedValue({
      id: "consent-1",
      status: "declined",
      expiresAt: EXPIRES_AT,
    });
    hoisted.consentEventCreate.mockResolvedValue({ id: "event-declined" });

    const res = await declineConsent(
      jsonRequest(
        "/api/consent/decline",
        { token: CONSENT_TOKEN, reason: "Not ready for video access" },
        { "x-real-ip": "203.0.113.11", "user-agent": "vitest-consent-smoke" }
      ) as any
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(hoisted.consentRecordUpdate).toHaveBeenCalledWith({
      where: { token: CONSENT_TOKEN },
      data: expect.objectContaining({
        status: "declined",
        declinedAt: expect.any(Date),
      }),
    });
    expect(hoisted.consentEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentRecordId: "consent-1",
        eventType: "declined",
        metadata: expect.stringContaining("Not ready for video access"),
      }),
    });
  });

  it("rejects an expired consent response", async () => {
    hoisted.consentRecordFindUnique.mockResolvedValue(
      buildConsentFixture({
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      })
    );

    const res = await acceptConsent(jsonRequest("/api/consent/accept", { token: CONSENT_TOKEN }) as any);
    const json = await readJson(res);

    expect(res.status).toBe(410);
    expect(json).toMatchObject({
      success: false,
      code: "CONSENT_EXPIRED",
    });
    expect(hoisted.consentRecordUpdate).not.toHaveBeenCalled();
    expect(hoisted.consentEventCreate).not.toHaveBeenCalled();
  });
});
