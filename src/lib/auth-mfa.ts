import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db";
import { sendEmail } from "@/lib/email/resend";
import { getAuthSessionCookieOptions } from "@/lib/auth-session";

const MFA_CODE_TTL_MS = 1000 * 60 * 10;
const MFA_PURPOSE_LOGIN = "login";
const TRUSTED_DEVICE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const TRUSTED_DEVICE_COOKIE = "reliance_trusted_device";
const IS_DEV = process.env.NODE_ENV !== "production";
const DEV_MFA_CHALLENGE_FILE = path.join(process.cwd(), "tmp", "auth-mfa-dev.json");

type DevMfaChallengeRecord = {
  id: string;
  credentialId: string;
  userId: string;
  email: string;
  codeHash: string;
  purpose: string;
  expiresAt: string;
  consumedAt: string | null;
  userSnapshot?: {
    name: string;
    email: string;
    userType: "customer" | "vendor" | "admin" | "both";
    availableProfiles: string[];
    avatar?: string;
    emailVerified: boolean;
    emailVerifiedAt: string | null;
  };
};

declare global {
  var __relianceDevMfaChallenges: DevMfaChallengeRecord[] | undefined;
}

function createChallengeId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(String(code || "")).digest("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function readPersistedDevChallenges(): DevMfaChallengeRecord[] {
  try {
    if (!fs.existsSync(DEV_MFA_CHALLENGE_FILE)) return [];
    const raw = fs.readFileSync(DEV_MFA_CHALLENGE_FILE, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("[auth-mfa] Failed to read dev MFA store:", error);
    return [];
  }
}

function persistDevChallenges(records: DevMfaChallengeRecord[]) {
  try {
    fs.mkdirSync(path.dirname(DEV_MFA_CHALLENGE_FILE), { recursive: true });
    fs.writeFileSync(DEV_MFA_CHALLENGE_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (error) {
    console.warn("[auth-mfa] Failed to persist dev MFA store:", error);
  }
}

function getDevChallengeStore() {
  if (!globalThis.__relianceDevMfaChallenges) {
    globalThis.__relianceDevMfaChallenges = readPersistedDevChallenges();
  }
  return globalThis.__relianceDevMfaChallenges;
}

function upsertDevChallenge(record: DevMfaChallengeRecord) {
  const store = getDevChallengeStore();
  const index = store.findIndex((entry) => entry.id === record.id);
  if (index >= 0) {
    store[index] = record;
  } else {
    store.push(record);
  }
  persistDevChallenges(store);
  return record;
}

function findDevChallenge(challengeId: string) {
  return getDevChallengeStore().find((entry) => entry.id === challengeId) || null;
}

function markDevChallengeConsumed(challengeId: string, consumedAt: Date) {
  const store = getDevChallengeStore();
  const index = store.findIndex((entry) => entry.id === challengeId);
  if (index < 0) return null;
  store[index] = {
    ...store[index],
    consumedAt: consumedAt.toISOString(),
  };
  persistDevChallenges(store);
  return store[index];
}

function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const parsed: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) continue;
    parsed[name] = decodeURIComponent(rest.join("=") || "");
  }
  return parsed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function requiresLoginMfa(availableProfiles: string[]): boolean {
  const set = new Set((availableProfiles || []).map((value) => String(value || "").trim().toLowerCase()));
  return set.has("admin") || set.has("vendor");
}

export async function issueLoginMfaChallenge(params: {
  credentialId: string;
  userId: string;
  email: string;
  recipientName?: string | null;
  baseUrl: string;
  userSnapshot?: {
    name: string;
    email: string;
    userType: "customer" | "vendor" | "admin" | "both";
    availableProfiles: string[];
    avatar?: string;
    emailVerified: boolean;
    emailVerifiedAt: string | null;
  };
}) {
  const email = normalizeEmail(params.email);
  if (!params.credentialId || !params.userId || !email) {
    throw new Error("Missing MFA challenge fields");
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + MFA_CODE_TTL_MS);
  const now = new Date();

  let challenge: {
    id: string;
    userId: string;
    email: string;
    expiresAt: Date;
  };
  const challengeId = createChallengeId();

  try {
    challenge = await (prisma as any).$transaction(async (tx: any) => {
      await tx.authMfaChallenge.updateMany({
        where: {
          userId: params.userId,
          purpose: MFA_PURPOSE_LOGIN,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      });

      return tx.authMfaChallenge.create({
        data: {
          id: challengeId,
          credentialId: params.credentialId,
          userId: params.userId,
          email,
          codeHash: hashCode(code),
          purpose: MFA_PURPOSE_LOGIN,
          expiresAt,
        },
        select: {
          id: true,
          userId: true,
          email: true,
          expiresAt: true,
        },
      });
    });
  } catch (error) {
    if (!IS_DEV) throw error;
    console.warn("[auth-mfa] Falling back to local dev MFA challenge store:", error);
    challenge = {
      id: challengeId,
      userId: params.userId,
      email,
      expiresAt,
    };
    upsertDevChallenge({
      id: challengeId,
      credentialId: params.credentialId,
      userId: params.userId,
      email,
      codeHash: hashCode(code),
      purpose: MFA_PURPOSE_LOGIN,
      expiresAt: expiresAt.toISOString(),
      consumedAt: null,
      userSnapshot: params.userSnapshot,
    });
  }

  const recipientName = String(params.recipientName || "").trim();
  const subject = "Your Reliance sign-in code";
  const html = `
    <p>Hello${recipientName ? ` ${escapeHtml(recipientName)}` : ""},</p>
    <p>Use this code to finish signing in to your Reliance account:</p>
    <p style="font-size:24px;font-weight:700;letter-spacing:0.2em;">${escapeHtml(code)}</p>
    <p>This code expires in 10 minutes.</p>
    <p>If you did not try to sign in, you can ignore this message.</p>
  `.trim();
  const text = [
    `Hello${recipientName ? ` ${recipientName}` : ""},`,
    "",
    "Use this code to finish signing in to your Reliance account:",
    code,
    "",
    "This code expires in 10 minutes.",
    "If you did not try to sign in, you can ignore this message.",
  ].join("\n");

  const sendResult = await sendEmail({ to: email, subject, html, text });

  return {
    challengeId: String(challenge.id),
    expiresAt: challenge.expiresAt,
    sendResult,
    codePreview: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function resendLoginMfaChallenge(params: {
  challengeId: string;
  baseUrl: string;
}) {
  const challengeId = String(params.challengeId || "").trim();
  if (!challengeId) {
    throw new Error("challengeId is required");
  }

  let existing:
    | {
        id: string;
        userId: string;
        credentialId: string;
        email: string;
        purpose: string;
        consumedAt: Date | string | null;
        expiresAt: Date | string;
        credential?: {
          user?: {
            name?: string | null;
          } | null;
        } | null;
        userSnapshot?: DevMfaChallengeRecord["userSnapshot"];
      }
    | null = null;

  try {
    existing = await (prisma as any).authMfaChallenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        userId: true,
        credentialId: true,
        email: true,
        purpose: true,
        consumedAt: true,
        expiresAt: true,
        credential: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (!IS_DEV) throw error;
    console.warn("[auth-mfa] Using local dev MFA challenge lookup for resend:", error);
  }

  if (!existing && IS_DEV) {
    const local = findDevChallenge(challengeId);
    if (local) {
      existing = {
        id: local.id,
        userId: local.userId,
        credentialId: local.credentialId,
        email: local.email,
        purpose: local.purpose,
        consumedAt: local.consumedAt,
        expiresAt: local.expiresAt,
        userSnapshot: local.userSnapshot,
      };
    }
  }

  if (!existing || existing.purpose !== MFA_PURPOSE_LOGIN) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (existing.consumedAt) {
    return { ok: false as const, reason: "already_used" as const };
  }
  if (new Date(existing.expiresAt).getTime() <= Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }

  const resent = await issueLoginMfaChallenge({
    credentialId: String(existing.credentialId),
    userId: String(existing.userId),
    email: String(existing.email),
    recipientName:
      String(existing.credential?.user?.name || existing.userSnapshot?.name || "").trim() || null,
    baseUrl: params.baseUrl,
    userSnapshot: existing.userSnapshot,
  });

  return {
    ok: true as const,
    ...resent,
  };
}

export async function verifyLoginMfaChallenge(params: {
  challengeId: string;
  code: string;
}) {
  const challengeId = String(params.challengeId || "").trim();
  const code = String(params.code || "").trim();
  if (!challengeId || !code) {
    return { ok: false as const, reason: "missing_fields" as const };
  }

  const now = new Date();
  try {
    return await (prisma as any).$transaction(async (tx: any) => {
      const challenge = await tx.authMfaChallenge.findUnique({
        where: { id: challengeId },
        select: {
          id: true,
          userId: true,
          email: true,
          codeHash: true,
          purpose: true,
          expiresAt: true,
          consumedAt: true,
        },
      });

      if (!challenge || challenge.purpose !== MFA_PURPOSE_LOGIN) {
        return { ok: false as const, reason: "not_found" as const };
      }
      if (challenge.consumedAt) {
        return { ok: false as const, reason: "already_used" as const };
      }
      if (new Date(challenge.expiresAt).getTime() <= now.getTime()) {
        return { ok: false as const, reason: "expired" as const };
      }
      if (challenge.codeHash !== hashCode(code)) {
        return { ok: false as const, reason: "invalid_code" as const };
      }

      await tx.authMfaChallenge.update({
        where: { id: challengeId },
        data: { consumedAt: now },
      });

      return {
        ok: true as const,
        userId: String(challenge.userId),
        email: String(challenge.email),
      };
    });
  } catch (error) {
    if (!IS_DEV) throw error;
    console.warn("[auth-mfa] Using local dev MFA challenge verification:", error);
  }

  const local = findDevChallenge(challengeId);
  if (!local || local.purpose !== MFA_PURPOSE_LOGIN) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (local.consumedAt) {
    return { ok: false as const, reason: "already_used" as const };
  }
  if (new Date(local.expiresAt).getTime() <= now.getTime()) {
    return { ok: false as const, reason: "expired" as const };
  }
  if (local.codeHash !== hashCode(code)) {
    return { ok: false as const, reason: "invalid_code" as const };
  }

  markDevChallengeConsumed(challengeId, now);

  return {
    ok: true as const,
    userId: String(local.userId),
    email: String(local.email),
    userSnapshot: local.userSnapshot || null,
  };
}

export function getTrustedDeviceCookieName() {
  return TRUSTED_DEVICE_COOKIE;
}

export function getTrustedDeviceCookieOptions() {
  const base = getAuthSessionCookieOptions();
  return {
    ...base,
    maxAge: Math.floor(TRUSTED_DEVICE_TTL_MS / 1000),
  };
}

export async function issueTrustedDevice(params: {
  credentialId: string;
  userId: string;
  label?: string | null;
}) {
  const rawToken = generateToken();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);

  const record = await (prisma as any).authTrustedDevice.create({
    data: {
      id: createChallengeId(),
      credentialId: params.credentialId,
      userId: params.userId,
      tokenHash: hashToken(rawToken),
      label: String(params.label || "").trim() || null,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return {
    deviceId: String(record.id),
    rawToken,
    expiresAt: record.expiresAt,
  };
}

export async function resolveTrustedDeviceUserIdFromRequest(request: Request) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const rawToken = String(cookies[TRUSTED_DEVICE_COOKIE] || "").trim();
  if (!rawToken) return null;

  const now = new Date();
  const record = await (prisma as any).authTrustedDevice.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!record) return null;
  if (record.revokedAt) return null;
  if (new Date(record.expiresAt).getTime() <= now.getTime()) return null;

  await (prisma as any).authTrustedDevice.update({
    where: { tokenHash: hashToken(rawToken) },
    data: { lastUsedAt: now },
  }).catch(() => null);

  return String(record.userId);
}
