import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashOtp } from "@/lib/consent/otp";
import { hashOpaqueSecret } from "@/lib/consent/token";
import { POST as startVerification } from "./start/route";
import { POST as verifyCode } from "./verify/route";

const hoisted = vi.hoisted(() => {
  const linkFindUnique = vi.fn();
  const userFindUnique = vi.fn();
  const challengeCount = vi.fn();
  const challengeCreate = vi.fn();
  const challengeFindFirst = vi.fn();
  const challengeUpdate = vi.fn();
  const challengeUpdateMany = vi.fn();
  const decisionSessionCreate = vi.fn();
  const notificationCreate = vi.fn();
  const notificationUpdate = vi.fn();
  const attemptCreate = vi.fn();
  const eventCreate = vi.fn();
  const sendOtp = vi.fn();
  const getUserId = vi.fn();
  const prisma: any = {
    consentRequestLink: { findUnique: linkFindUnique },
    user: { findUnique: userFindUnique },
    consentVerificationChallenge: {
      count: challengeCount,
      create: challengeCreate,
      findFirst: challengeFindFirst,
      update: challengeUpdate,
      updateMany: challengeUpdateMany,
    },
    consentDecisionSession: { create: decisionSessionCreate },
    bookingNotification: { create: notificationCreate, update: notificationUpdate },
    bookingNotificationAttempt: { create: attemptCreate },
    consentEvent: { create: eventCreate },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  return {
    prisma,
    linkFindUnique,
    userFindUnique,
    challengeCount,
    challengeCreate,
    challengeFindFirst,
    challengeUpdate,
    challengeUpdateMany,
    decisionSessionCreate,
    notificationCreate,
    notificationUpdate,
    attemptCreate,
    eventCreate,
    sendOtp,
    getUserId,
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: hoisted.getUserId }));
vi.mock("@/lib/notifications/send-permission-otp", () => ({ sendPermissionOtp: hoisted.sendOtp }));
vi.mock("@/lib/consent/otp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/consent/otp")>("@/lib/consent/otp");
  return { ...actual, createOtp: () => "123456" };
});

const ACTION_SECRET = "verification-action-secret";

function linkFixture() {
  return {
    id: "link-1",
    consentRecordId: "permission-1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    consentRecord: {
      id: "permission-1",
      bookingId: "booking-1",
      status: "requested",
      lifecycleStatus: "DELIVERED",
      decisionEvidence: null,
      recipientEmailHash: hashOpaqueSecret("permission-contact:customer@example.com"),
      recipientPhoneHash: null,
      vendor: { name: "Vendor", businessName: "Vendor Co" },
      booking: {
        title: "Outlet Installation",
        customerMetadata: JSON.stringify({ client_email: "customer@example.com" }),
        user: { name: "Customer", email: "customer@example.com", phone: null },
        service: { name: "Outlet Installation" },
      },
    },
  };
}

function post(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.20" },
    body: JSON.stringify(body),
  });
}

describe("permission identity verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.linkFindUnique.mockResolvedValue(linkFixture());
    hoisted.getUserId.mockResolvedValue(null);
    hoisted.challengeCount.mockResolvedValue(0);
    hoisted.notificationCreate.mockResolvedValue({ id: "notification-1" });
    hoisted.challengeCreate.mockResolvedValue({ id: "challenge-1" });
    hoisted.sendOtp.mockResolvedValue({ ok: true, providerMessageId: "provider-1" });
    hoisted.attemptCreate.mockResolvedValue({ id: "attempt-1" });
    hoisted.notificationUpdate.mockResolvedValue({ id: "notification-1" });
    hoisted.eventCreate.mockResolvedValue({ id: "event-1" });
    hoisted.challengeUpdate.mockResolvedValue({ id: "challenge-1" });
    hoisted.challengeUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.decisionSessionCreate.mockResolvedValue({ id: "decision-session-1" });
  });

  it("stores only a salted OTP hash and returns a generic response", async () => {
    const response = await startVerification(
      post(`/api/consent/${ACTION_SECRET}/verification/start`, { channel: "email" }) as any,
      { params: Promise.resolve({ token: ACTION_SECRET }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, message: "If that verification option is available, a code has been sent." });
    expect(hoisted.challengeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentRecordId: "permission-1",
        channel: "email",
        codeHash: expect.any(String),
        maxAttempts: 5,
      }),
    });
    expect(JSON.stringify(hoisted.challengeCreate.mock.calls[0][0])).not.toContain("123456");
    expect(hoisted.sendOtp).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }));
  });

  it("rate limits without revealing whether the destination exists", async () => {
    hoisted.challengeCount.mockResolvedValue(5);
    const response = await startVerification(
      post(`/api/consent/${ACTION_SECRET}/verification/start`, { channel: "email" }) as any,
      { params: Promise.resolve({ token: ACTION_SECRET }) }
    );

    expect(response.status).toBe(200);
    expect(hoisted.challengeCreate).not.toHaveBeenCalled();
    expect(hoisted.sendOtp).not.toHaveBeenCalled();
  });

  it("creates a single-use decision session after the correct code", async () => {
    hoisted.challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      destinationHash: "email-hash",
      codeHash: hashOtp("123456", "challenge-1"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      failedAttempts: 0,
      maxAttempts: 5,
      consumedAt: null,
    });
    const response = await verifyCode(
      post(`/api/consent/${ACTION_SECRET}/verification/verify`, { channel: "email", code: "123456" }) as any,
      { params: Promise.resolve({ token: ACTION_SECRET }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("reliance_permission_decision=");
    expect(hoisted.challengeUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "challenge-1", consumedAt: null }),
      data: { consumedAt: expect.any(Date) },
    });
    expect(hoisted.decisionSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentRecordId: "permission-1",
        verificationMethod: "email_otp",
        secretHash: expect.any(String),
      }),
    });
    expect(JSON.stringify(hoisted.decisionSessionCreate.mock.calls[0][0])).not.toContain("123456");
  });

  it("rejects expired, exhausted, and already-consumed challenges without issuing a session", async () => {
    for (const challenge of [
      { expiresAt: new Date(Date.now() - 1000), failedAttempts: 0, maxAttempts: 5, consumedAt: null },
      { expiresAt: new Date(Date.now() + 10000), failedAttempts: 5, maxAttempts: 5, consumedAt: null },
      { expiresAt: new Date(Date.now() + 10000), failedAttempts: 0, maxAttempts: 5, consumedAt: new Date() },
    ]) {
      hoisted.challengeFindFirst.mockResolvedValue({
        id: "challenge-1",
        destinationHash: "email-hash",
        codeHash: hashOtp("123456", "challenge-1"),
        ...challenge,
      });
      const response = await verifyCode(
        post(`/api/consent/${ACTION_SECRET}/verification/verify`, { channel: "email", code: "123456" }) as any,
        { params: Promise.resolve({ token: ACTION_SECRET }) }
      );
      expect(response.status).toBe(422);
    }
    expect(hoisted.decisionSessionCreate).not.toHaveBeenCalled();
  });
});
