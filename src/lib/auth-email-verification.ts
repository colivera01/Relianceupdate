import crypto from "crypto";
import { prisma } from "@/server/db";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function createVerificationTokenId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function createVerificationTokenValue(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export type EmailVerificationIssueResult = {
  rawToken: string;
  expiresAt: Date;
};

export async function issueEmailVerificationToken(params: {
  credentialId: string;
  email: string;
  ttlMs?: number;
}): Promise<EmailVerificationIssueResult> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!params.credentialId || !normalizedEmail) {
    throw new Error("Missing required email verification token fields");
  }

  const rawToken = createVerificationTokenValue();
  const expiresAt = new Date(Date.now() + (params.ttlMs ?? EMAIL_VERIFICATION_TTL_MS));

  await (prisma as any).$transaction(async (tx: any) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        credentialId: params.credentialId,
        email: normalizedEmail,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        id: createVerificationTokenId(),
        credentialId: params.credentialId,
        email: normalizedEmail,
        tokenHash: hashVerificationToken(rawToken),
        expiresAt,
      },
    });
  });

  return { rawToken, expiresAt };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashVerificationToken(rawToken);
  const now = new Date();

  return (prisma as any).$transaction(async (tx: any) => {
    const record = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        credentialId: true,
        email: true,
        expiresAt: true,
        consumedAt: true,
      },
    });

    if (!record) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (record.consumedAt) {
      return { ok: false as const, reason: "already_used" as const };
    }
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      return { ok: false as const, reason: "expired" as const };
    }

    await tx.emailVerificationToken.update({
      where: { tokenHash },
      data: { consumedAt: now },
    });

    const credential = await tx.authCredential.update({
      where: { id: record.credentialId },
      data: { emailVerifiedAt: now },
      select: {
        id: true,
        userId: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    return {
      ok: true as const,
      credential,
    };
  });
}

export async function sendOrPreviewEmailVerification(params: {
  email: string;
  credentialId: string;
  recipientName?: string | null;
  baseUrl: string;
  audience?: "customer" | "vendor" | "account";
}) {
  const { sendEmail } = await import("@/lib/email/resend");
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) {
    throw new Error("Email is required for verification");
  }

  const issued = await issueEmailVerificationToken({
    credentialId: params.credentialId,
    email: normalizedEmail,
  });

  const verificationLink = `${String(params.baseUrl || "").replace(/\/+$/, "")}/auth/verify-email?token=${issued.rawToken}`;
  const recipientName = String(params.recipientName || "").trim();
  const logoUrl = `${String(params.baseUrl || "").replace(/\/+$/, "")}/reliance-logo-tight.png`;
  const copy = getVerificationEmailCopy(params.audience);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi there,";
  const html = `
    <div style="margin:0;background:#eef4ff;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0b1327 0%,#142852 58%,#1f3f7a 100%);">
          <img src="${escapeHtml(logoUrl)}" alt="Reliance" width="160" style="display:block;width:160px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
          <p style="margin:24px 0 0;color:#9fbaf5;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">Welcome to Reliance</p>
          <h1 style="margin:10px 0 0;color:#ffffff;font-size:30px;line-height:1.18;font-weight:800;">${escapeHtml(copy.headline)}</h1>
          <p style="margin:16px 0 0;color:#d8e4ff;font-size:16px;line-height:1.7;">${escapeHtml(copy.intro)}</p>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;color:#0f172a;font-size:16px;line-height:1.7;">${greeting}</p>
          <p style="margin:0 0 18px;color:#334155;font-size:16px;line-height:1.7;">${escapeHtml(copy.body)}</p>
          <div style="margin:26px 0 28px;">
            <a href="${escapeHtml(verificationLink)}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:linear-gradient(90deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
              Verify email address
            </a>
          </div>
          <div style="margin:0 0 24px;padding:18px 20px;border-radius:16px;background:#f8fbff;border:1px solid #dbe7ff;">
            <p style="margin:0 0 8px;color:#0f172a;font-size:14px;font-weight:700;">What happens after you verify</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">${escapeHtml(copy.afterVerification)}</p>
          </div>
          <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.7;"><strong>This link expires in 24 hours.</strong></p>
          <p style="margin:0 0 10px;color:#475569;font-size:14px;line-height:1.7;">If the button does not work, copy and paste this link into your browser:</p>
          <p style="margin:0;padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;font-size:13px;line-height:1.7;word-break:break-all;">${escapeHtml(verificationLink)}</p>
        </div>
      </div>
    </div>
  `.trim();
  const text = [
    "Welcome to Reliance",
    "",
    greeting.replace(/<[^>]*>/g, ""),
    "",
    copy.intro,
    "",
    copy.body,
    "",
    "Verify your email address:",
    verificationLink,
    "",
    copy.afterVerification,
    "",
    "This link expires in 24 hours.",
  ].join("\n");

  const result = await sendEmail({
    to: normalizedEmail,
    subject: copy.subject,
    html,
    text,
  });

  return {
    sendResult: result,
    verificationLink,
    verificationTokenPreview:
      process.env.NODE_ENV !== "production" ? issued.rawToken : undefined,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getVerificationEmailCopy(audience: "customer" | "vendor" | "account" = "account") {
  switch (audience) {
    case "customer":
      return {
        subject: "Welcome to Reliance. Verify your email to start using your account",
        headline: "Finish setting up your customer account",
        intro:
          "Your Reliance account is almost ready. Verify your email so you can sign in confidently, manage bookings, and access service videos and reviews when they are available.",
        body:
          "We use email verification to protect your account and make sure future booking updates, service-video access, and sign-in recovery stay connected to the right person.",
        afterVerification:
          "After verification, you can sign in and continue using Reliance with your new customer account.",
      };
    case "vendor":
      return {
        subject: "Welcome to Reliance. Verify your email to continue vendor setup",
        headline: "Finish setting up your vendor account",
        intro:
          "Welcome to Reliance. Verify your email so you can sign in, continue vendor setup, and move your business profile toward approval, publishing, and customer visibility.",
        body:
          "We verify your email before vendor access opens so your business account stays secure and Reliance can reliably send approval, profile, and service-status updates to the right inbox.",
        afterVerification:
          "After verification, sign in again to continue building your vendor profile and services.",
      };
    default:
      return {
        subject: "Verify your email for Reliance",
        headline: "Verify your email address",
        intro:
          "Confirm this email address so your Reliance account stays secure, recoverable, and ready for sign-in.",
        body:
          "Email verification helps Reliance protect your account and make sure important account activity reaches the right inbox.",
        afterVerification:
          "After verification, you can return to Reliance and continue using your account normally.",
      };
  }
}
