import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const hoisted = vi.hoisted(() => ({
  resendLoginMfaChallenge: vi.fn(),
}));

vi.mock("@/lib/auth-mfa", () => ({
  resendLoginMfaChallenge: hoisted.resendLoginMfaChallenge,
}));

import { POST } from "./route";

describe("POST /api/auth/mfa/resend", () => {
  beforeEach(() => {
    hoisted.resendLoginMfaChallenge.mockReset();
  });

  it("does not claim success when the email provider rejects delivery", async () => {
    hoisted.resendLoginMfaChallenge.mockResolvedValue({
      ok: false,
      reason: "delivery_failed",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/auth/mfa/resend", {
        method: "POST",
        body: JSON.stringify({ challengeId: "challenge-1" }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "MFA_EMAIL_DELIVERY_FAILED",
    });
  });
});
