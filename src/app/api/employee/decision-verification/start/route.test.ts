import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  start: vi.fn(),
  assertDisplay: vi.fn(),
  loadContext: vi.fn(),
  resolveActor: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: {} }));

vi.mock("@/lib/employee-decision-entry", () => ({
  resolveEmployeeDecisionActor: hoisted.resolveActor,
}));

vi.mock("@/lib/employee-decision-verification", () => ({
  EMPLOYEE_DECISION_PURPOSES: {
    RECORDING: "EMPLOYEE_RECORDING_PARTICIPATION",
    STANDING_PUBLIC: "EMPLOYEE_STANDING_PUBLIC_MEDIA",
  },
  assertEmployeeDecisionDisplayContext: hoisted.assertDisplay,
  loadEmployeeDecisionContext: hoisted.loadContext,
  requestIpHash: vi.fn(() => "ip-hash"),
  startEmployeeDecisionVerification: hoisted.start,
}));

vi.mock("@/lib/notifications/send-employee-decision-otp", () => ({
  sendEmployeeDecisionOtp: vi.fn(),
}));

describe("Employee decision verification start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EMPLOYEE_DECISION_SMS_ENABLED;
    process.env.EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.EMAIL_FROM = "Reliance <noreply@example.com>";
    process.env.SMS_ENABLED = "true";
    process.env.SMS_PROVIDER = "telnyx";
    process.env.TELNYX_API_KEY = "telnyx-key";
    process.env.TELNYX_FROM_NUMBER = "+13215550100";
    hoisted.resolveActor.mockResolvedValue({
      userId: "employee-1",
      membershipId: "membership-1",
      bookingId: "booking-1",
      entryMethod: "SERVICE_ORDER_ENTRY",
    });
    hoisted.loadContext.mockResolvedValue({
      employeeName: "Employee One",
      vendorName: "Vendor One",
      serviceName: "Outlet Installation",
      membershipId: "membership-1",
      bookingId: "booking-1",
      contextHash: "a".repeat(64),
      recipient: {
        emailMasked: "e***@example.com",
        phoneMasked: "***0123",
      },
    });
    hoisted.start.mockResolvedValue({ challengeId: "challenge-1" });
  });

  afterEach(() => {
    delete process.env.EMPLOYEE_DECISION_SMS_ENABLED;
    delete process.env.EMAIL_ENABLED;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.SMS_ENABLED;
    delete process.env.SMS_PROVIDER;
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_FROM_NUMBER;
  });

  it("offers only operational verification channels", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/employee/decision-verification/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: "EMPLOYEE_RECORDING_PARTICIPATION",
        membershipId: "membership-1",
        bookingId: "booking-1",
        contextHash: "a".repeat(64),
      }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.channels).toEqual({ email: "e***@example.com", sms: null });
  });

  it("rejects a hidden SMS channel even when a phone number exists", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/employee/decision-verification/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: "EMPLOYEE_RECORDING_PARTICIPATION",
        membershipId: "membership-1",
        bookingId: "booking-1",
        contextHash: "a".repeat(64),
        channel: "sms",
      }),
    }));
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      success: false,
      code: "EMPLOYEE_DECISION_CHANNEL_UNAVAILABLE",
    });
    expect(hoisted.start).not.toHaveBeenCalled();
  });
});
