import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { findAnyAuthUserByEmail, storePasswordResetToken } from "@/lib/password-reset-tokens";
import { sendEmail } from "@/lib/email/resend";

vi.mock("@/lib/password-reset-tokens", () => ({
  findAnyAuthUserByEmail: vi.fn(),
  storePasswordResetToken: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: vi.fn(),
}));

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("https://beta.relianceonline.org/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.mocked(findAnyAuthUserByEmail).mockReset();
    vi.mocked(storePasswordResetToken).mockReset();
    vi.mocked(sendEmail).mockReset();
  });

  it("emails a branded reset link for an existing account", async () => {
    vi.mocked(findAnyAuthUserByEmail).mockResolvedValue({
      exists: true,
      user: {
        id: "user-1",
        email: "vendor@example.com",
        name: "Vendor Example",
        password: "hash",
        userType: "vendor",
      },
    } as any);
    vi.mocked(storePasswordResetToken).mockResolvedValue("reset-token-123");
    vi.mocked(sendEmail).mockResolvedValue({ ok: true, providerMessageId: "email-1" });

    const response = await POST(buildRequest({ email: "vendor@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      emailDeliveryQueued: true,
    });
    expect(storePasswordResetToken).toHaveBeenCalledWith("vendor@example.com");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vendor@example.com",
        subject: "Reset your Reliance password",
        html: expect.stringContaining("/auth/reset-password?token=reset-token-123"),
        text: expect.stringContaining("/auth/reset-password?token=reset-token-123"),
      })
    );
  });

  it("does not reveal whether a missing account exists", async () => {
    vi.mocked(findAnyAuthUserByEmail).mockResolvedValue({ exists: false } as any);

    const response = await POST(buildRequest({ email: "missing@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(storePasswordResetToken).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns a delivery error when the reset email cannot be sent", async () => {
    vi.mocked(findAnyAuthUserByEmail).mockResolvedValue({
      exists: true,
      user: { id: "user-1", email: "vendor@example.com" },
    } as any);
    vi.mocked(storePasswordResetToken).mockResolvedValue("reset-token-123");
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, errorMessage: "provider_down" });

    const response = await POST(buildRequest({ email: "vendor@example.com" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "PASSWORD_RESET_EMAIL_FAILED",
    });
  });
});
