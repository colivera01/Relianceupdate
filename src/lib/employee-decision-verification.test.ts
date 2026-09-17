import { describe, expect, it, vi } from "vitest";

import { hashOtp } from "@/lib/consent/otp";
import { hashOpaqueSecret } from "@/lib/consent/token";
import {
  EMPLOYEE_DECISION_MAX_STARTS_PER_HOUR,
  EMPLOYEE_DECISION_PURPOSES,
  consumeEmployeeDecisionSession,
  startEmployeeDecisionVerification,
  verifyEmployeeDecisionOtp,
  type EmployeeDecisionContext,
} from "./employee-decision-verification";

function context(
  overrides: Partial<EmployeeDecisionContext> = {},
): EmployeeDecisionContext {
  return {
    purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
    userId: "employee-1",
    vendorId: "vendor-1",
    membershipId: "membership-1",
    membershipGeneration: 2,
    bookingId: "booking-1",
    assignmentGeneration: 3,
    assessmentId: "assessment-1",
    assessmentGeneration: 4,
    scopeHash: "a".repeat(64),
    audioAllowed: true,
    recordingBoundary: "service_area_equipment_item_and_work",
    participantPlan: "assigned_service_professional",
    contextHash: "b".repeat(64),
    employeeName: "Employee One",
    vendorName: "Vendor One",
    serviceName: "Outlet Installation",
    recipient: {
      name: "Employee One",
      email: "employee@example.com",
      phone: "+14075550123",
      emailHash: "email-hash",
      phoneHash: "phone-hash",
      emailMasked: "e***@example.com",
      phoneMasked: "***0123",
    },
    ...overrides,
  };
}

describe("Employee verified decision security", () => {
  it("creates a hashed six-digit OTP with a ten-minute expiry", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    let deliveredCode = "";
    const create = vi.fn().mockResolvedValue({});
    const db = {
      employeeDecisionVerificationChallenge: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create,
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const result = await startEmployeeDecisionVerification({
      db,
      context: context(),
      channel: "email",
      requestIpHash: "ip-hash",
      now,
      deliver: async ({ code }) => {
        deliveredCode = code;
        return { ok: true, providerMessageId: "delivery-1" };
      },
    });

    expect(deliveredCode).toMatch(/^\d{6}$/);
    expect(result.expiresAt).toEqual(new Date("2026-09-17T12:10:00.000Z"));
    const data = create.mock.calls[0][0].data;
    expect(data.codeHash).toBe(hashOtp(deliveredCode, data.id));
    expect(data.codeHash).not.toBe(deliveredCode);
    expect(data).toMatchObject({
      membershipGeneration: 2,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: "b".repeat(64),
      maxAttempts: 5,
    });
  });

  it("fails when the selected Employee contact channel is unavailable", async () => {
    const db = {
      employeeDecisionVerificationChallenge: {
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    await expect(startEmployeeDecisionVerification({
      db,
      context: context({ recipient: { ...context().recipient, phone: null, phoneHash: null } }),
      channel: "sms",
      requestIpHash: "ip-hash",
      deliver: vi.fn(),
    })).rejects.toThrow("EMPLOYEE_DECISION_CHANNEL_UNAVAILABLE");
  });

  it("enforces the resend cooldown", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const db = {
      employeeDecisionVerificationChallenge: {
        findFirst: vi.fn().mockResolvedValue({
          createdAt: new Date(now.getTime() - 30_000),
        }),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    await expect(startEmployeeDecisionVerification({
      db,
      context: context(),
      channel: "email",
      requestIpHash: "ip-hash",
      now,
      deliver: vi.fn(),
    })).rejects.toThrow("EMPLOYEE_DECISION_RESEND_COOLDOWN");
  });

  it("fails the start request when OTP delivery fails", async () => {
    const db = {
      employeeDecisionVerificationChallenge: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    await expect(startEmployeeDecisionVerification({
      db,
      context: context(),
      channel: "email",
      requestIpHash: "ip-hash",
      deliver: vi.fn().mockResolvedValue({ ok: false, errorCode: "PROVIDER_DOWN" }),
    })).rejects.toThrow("EMPLOYEE_DECISION_OTP_DELIVERY_FAILED");
    expect(db.employeeDecisionVerificationChallenge.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({ deliveryStatus: "FAILED" }),
    });
  });

  it("rate-limits starts by membership/purpose/channel or IP", async () => {
    const db = {
      employeeDecisionVerificationChallenge: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(EMPLOYEE_DECISION_MAX_STARTS_PER_HOUR),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    await expect(startEmployeeDecisionVerification({
      db,
      context: context(),
      channel: "email",
      requestIpHash: "ip-hash",
      deliver: vi.fn(),
    })).rejects.toThrow("EMPLOYEE_DECISION_RATE_LIMITED");
  });

  it("verifies the OTP once and creates a twenty-minute one-time session", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const challenge = {
      id: "challenge-1",
      userId: "employee-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipGeneration: 2,
      bookingId: "booking-1",
      assessmentId: "assessment-1",
      assignmentGeneration: 3,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: "b".repeat(64),
      channel: "email",
      destinationHash: "contact-hash",
      deliveryStatus: "SENT",
      codeHash: hashOtp("123456", "challenge-1"),
      expiresAt: new Date(now.getTime() + 600_000),
      failedAttempts: 0,
      maxAttempts: 5,
      consumedAt: null,
    };
    const create = vi.fn().mockImplementation(({ data }) => ({ id: "session-1", ...data }));
    const tx = {
      employeeDecisionVerificationChallenge: {
        findUnique: vi.fn().mockResolvedValue(challenge),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      employeeVerifiedDecisionSession: { create },
    };
    const db = { ...tx, $transaction: (callback: any) => callback(tx) };
    const result = await verifyEmployeeDecisionOtp({
      db,
      challengeId: challenge.id,
      code: "123456",
      expectedContext: context(),
      now,
    });

    expect(result.expiresAt).toEqual(new Date("2026-09-17T12:20:00.000Z"));
    expect(create.mock.calls[0][0].data).toMatchObject({
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: "b".repeat(64),
      verifiedContactHash: "contact-hash",
    });
    expect(create.mock.calls[0][0].data.secretHash).toHaveLength(64);
  });

  it.each([
    ["wrong OTP", { code: "000000" }, "EMPLOYEE_DECISION_OTP_INCORRECT"],
    ["expired OTP", { now: new Date("2026-09-17T12:11:00.000Z") }, "EMPLOYEE_DECISION_OTP_EXPIRED"],
    ["attempt exhaustion", { failedAttempts: 5 }, "EMPLOYEE_DECISION_OTP_ATTEMPTS_EXHAUSTED"],
    ["OTP replay", { consumedAt: new Date("2026-09-17T12:00:00.000Z") }, "EMPLOYEE_DECISION_OTP_CONSUMED"],
  ])("rejects %s", async (_label, override, expected) => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const challenge = {
      id: "challenge-1",
      userId: "employee-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipGeneration: 2,
      bookingId: "booking-1",
      assessmentId: "assessment-1",
      assignmentGeneration: 3,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: "b".repeat(64),
      channel: "email",
      destinationHash: "contact-hash",
      deliveryStatus: "SENT",
      codeHash: hashOtp("123456", "challenge-1"),
      expiresAt: new Date(now.getTime() + 600_000),
      failedAttempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      ...override,
    };
    const tx = {
      employeeDecisionVerificationChallenge: {
        findUnique: vi.fn().mockResolvedValue(challenge),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      employeeVerifiedDecisionSession: { create: vi.fn() },
    };
    const db = { ...tx, $transaction: (callback: any) => callback(tx) };
    await expect(verifyEmployeeDecisionOtp({
      db,
      challengeId: challenge.id,
      code: (override as any).code || "123456",
      expectedContext: context(),
      now: (override as any).now || now,
    })).rejects.toThrow(expected);
  });

  it.each([
    ["wrong User", { userId: "employee-2" }],
    ["wrong Vendor", { vendorId: "vendor-2" }],
    ["wrong membership", { membershipId: "membership-2" }],
    ["stale membership generation", { membershipGeneration: 1 }],
    ["wrong purpose", { purpose: EMPLOYEE_DECISION_PURPOSES.STANDING_PUBLIC }],
    ["wrong Work Record context", { contextHash: "c".repeat(64) }],
  ])("rejects a challenge bound to the %s", async (_label, override) => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const challenge = {
      id: "challenge-1",
      userId: "employee-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipGeneration: 2,
      bookingId: "booking-1",
      assessmentId: "assessment-1",
      assignmentGeneration: 3,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: "b".repeat(64),
      channel: "email",
      destinationHash: "contact-hash",
      deliveryStatus: "SENT",
      codeHash: hashOtp("123456", "challenge-1"),
      expiresAt: new Date(now.getTime() + 600_000),
      failedAttempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      ...override,
    };
    const tx = {
      employeeDecisionVerificationChallenge: {
        findUnique: vi.fn().mockResolvedValue(challenge),
        updateMany: vi.fn(),
      },
      employeeVerifiedDecisionSession: { create: vi.fn() },
    };
    const db = { ...tx, $transaction: (callback: any) => callback(tx) };

    await expect(verifyEmployeeDecisionOtp({
      db,
      challengeId: challenge.id,
      code: "123456",
      expectedContext: context(),
      now,
    })).rejects.toThrow("EMPLOYEE_DECISION_VERIFICATION_FAILED");
    expect(tx.employeeVerifiedDecisionSession.create).not.toHaveBeenCalled();
  });

  it("consumes a matching session exactly once and rejects purpose/context replay", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const session = {
      id: "session-1",
      secretHash: hashOpaqueSecret("session-secret"),
      userId: "employee-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipGeneration: 2,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      contextHash: "b".repeat(64),
      expiresAt: new Date(now.getTime() + 600_000),
      consumedAt: null,
    };
    const tx = {
      employeeVerifiedDecisionSession: {
        findUnique: vi.fn().mockResolvedValue(session),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
      },
    };
    await expect(consumeEmployeeDecisionSession({
      tx,
      secret: "session-secret",
      context: context(),
      consumedByType: "TEST",
      consumedById: "decision-1",
      now,
    })).resolves.toEqual(session);
    await expect(consumeEmployeeDecisionSession({
      tx,
      secret: "session-secret",
      context: context(),
      consumedByType: "TEST",
      consumedById: "decision-2",
      now,
    })).rejects.toThrow("EMPLOYEE_DECISION_SESSION_REPLAYED");
    await expect(consumeEmployeeDecisionSession({
      tx: {
        employeeVerifiedDecisionSession: {
          findUnique: vi.fn().mockResolvedValue(session),
          updateMany: vi.fn(),
        },
      },
      secret: "session-secret",
      context: context({ purpose: EMPLOYEE_DECISION_PURPOSES.STANDING_PUBLIC }),
      consumedByType: "TEST",
      consumedById: "decision-3",
      now,
    })).rejects.toThrow("EMPLOYEE_DECISION_SESSION_INVALID");
  });
});
