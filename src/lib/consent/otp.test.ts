import { describe, expect, it } from "vitest";

import { createOtp, evaluateOtpAttempt, hashOtp } from "./otp";

describe("permission contact verification codes", () => {
  it("creates a six-digit code but persists only a contextual hash", () => {
    const code = createOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(hashOtp(code, "challenge-1")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOtp(code, "challenge-1")).not.toContain(code);
  });

  it("rejects expired, consumed, reused, and over-attempted codes", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const base = {
      expectedHash: hashOtp("123456", "challenge-1"),
      suppliedCode: "123456",
      challengeId: "challenge-1",
      expiresAt: new Date("2026-08-01T12:05:00.000Z"),
      now,
      failedAttempts: 0,
      maxAttempts: 5,
      consumedAt: null as Date | null,
    };
    expect(evaluateOtpAttempt(base)).toEqual({ ok: true });
    expect(evaluateOtpAttempt({ ...base, expiresAt: new Date("2026-08-01T11:59:59.000Z") })).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(evaluateOtpAttempt({ ...base, consumedAt: now })).toEqual({
      ok: false,
      reason: "consumed",
    });
    expect(evaluateOtpAttempt({ ...base, failedAttempts: 5 })).toEqual({
      ok: false,
      reason: "attempts_exhausted",
    });
  });
});
