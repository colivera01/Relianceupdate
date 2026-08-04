import crypto from "crypto";
import { prisma } from "@/server/db";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { sanitizeAuthNextPath } from "@/lib/auth-next";
import { markCustomerRegistrationEvidenceVerified } from "@/lib/legal/customer-registration-policy-evidence";

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

    await markCustomerRegistrationEvidenceVerified(tx, credential.userId, now);

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
  nextPath?: string | null;
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

  const verificationParams = new URLSearchParams({ token: issued.rawToken });
  const safeNextPath = sanitizeAuthNextPath(params.nextPath);
  if (safeNextPath) {
    verificationParams.set("next", safeNextPath);
  }
  const verificationLink = `${String(params.baseUrl || "").replace(/\/+$/, "")}/auth/verify-email?${verificationParams.toString()}`;
  const recipientName = String(params.recipientName || "").trim();
  const copy = getVerificationEmailCopy(params.audience);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi there,";
  const html = buildRelianceEmailHtml({
    eyebrow: "Welcome to Reliance",
    headline: copy.headline,
    greeting,
    bodyHtml: `
      <p style="margin:0 0 14px;">${escapeRelianceEmailHtml(copy.intro)}</p>
      <p style="margin:0;">${escapeRelianceEmailHtml(copy.body)}</p>
    `,
    cta: { label: "Verify Email Address", href: verificationLink },
    secondaryHtml: `
      <p style="margin:0 0 8px;color:#ffffff;font-weight:800;">What happens after you verify</p>
      <p style="margin:0 0 16px;">${escapeRelianceEmailHtml(copy.afterVerification)}</p>
      <p style="margin:0;"><strong style="color:#ffffff;">This link expires in 24 hours.</strong></p>
    `,
    fallbackHref: verificationLink,
    baseUrl: params.baseUrl,
  });
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
          "Your Reliance account is almost ready. Verify your email so you can sign in confidently, manage service records, and access service videos and reviews when they are available.",
        body:
          "We use email verification to protect your account and make sure future service-record updates, service-video access, and sign-in recovery stay connected to the right person.",
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
          "After verification, sign in again to continue building your vendor profile and services offered.",
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
