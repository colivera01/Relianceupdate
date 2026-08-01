import crypto from "crypto";

import { hashOpaqueSecret, safeSecretEqual } from "./token";

export const PERMISSION_OTP_TTL_MINUTES = 10;
export const PERMISSION_OTP_MAX_ATTEMPTS = 5;

export function createOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string, challengeId: string): string {
  return hashOpaqueSecret(
    `permission-otp:${challengeId}:${String(code || "").trim()}`,
  );
}

export function evaluateOtpAttempt(input: {
  expectedHash: string;
  suppliedCode: string;
  challengeId: string;
  expiresAt: Date;
  now?: Date;
  failedAttempts: number;
  maxAttempts?: number;
  consumedAt: Date | null;
}):
  | { ok: true }
  | {
      ok: false;
      reason: "consumed" | "expired" | "attempts_exhausted" | "incorrect";
    } {
  const now = input.now ?? new Date();
  if (input.consumedAt) return { ok: false, reason: "consumed" };
  if (input.expiresAt.getTime() <= now.getTime())
    return { ok: false, reason: "expired" };
  if (
    input.failedAttempts >= (input.maxAttempts ?? PERMISSION_OTP_MAX_ATTEMPTS)
  ) {
    return { ok: false, reason: "attempts_exhausted" };
  }
  const suppliedHash = hashOtp(input.suppliedCode, input.challengeId);
  if (!safeSecretEqual(input.expectedHash, suppliedHash))
    return { ok: false, reason: "incorrect" };
  return { ok: true };
}
