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
  const greeting = recipientName ? ` ${escapeHtml(recipientName)}` : "";
  const subject = "Verify your email for Reliance";
  const html = `
    <p>Hello${greeting},</p>
    <p>Verify your email address to keep your Reliance account accurate and recoverable.</p>
    <p>
      <a href="${escapeHtml(verificationLink)}" style="display:inline-block;padding:10px 14px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">
        Verify email
      </a>
    </p>
    <p>This link expires in 24 hours.</p>
    <p>If the button does not work, copy and paste this link into your browser: <code>${escapeHtml(verificationLink)}</code></p>
  `.trim();
  const text = [
    `Hello${recipientName ? ` ${recipientName}` : ""},`,
    "",
    "Verify your email address to keep your Reliance account accurate and recoverable.",
    "",
    `Verify email: ${verificationLink}`,
    "",
    "This link expires in 24 hours.",
  ].join("\n");

  const result = await sendEmail({
    to: normalizedEmail,
    subject,
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
