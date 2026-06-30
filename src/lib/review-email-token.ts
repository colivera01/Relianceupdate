import crypto from "crypto";

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

export type ReviewEmailTokenClaims = {
  reviewWindowId: string;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

function resolveSecret(): string {
  const configured = String(
    process.env.REVIEW_EMAIL_TOKEN_SECRET ||
      process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      ""
  ).trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "reliance-dev-review-email-token-secret";
  throw new Error("REVIEW_EMAIL_TOKEN_SECRET or AUTH_SESSION_SECRET is required");
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function sign(payload: string): string {
  return toBase64Url(crypto.createHmac("sha256", resolveSecret()).update(payload).digest());
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createReviewEmailToken(input: { reviewWindowId: string; ttlSeconds?: number }): string {
  const reviewWindowId = String(input.reviewWindowId || "").trim();
  if (!reviewWindowId) throw new Error("Missing review window id");
  const now = Math.floor(Date.now() / 1000);
  const claims: ReviewEmailTokenClaims = {
    reviewWindowId,
    issuedAt: now,
    expiresAt: now + Math.max(60, input.ttlSeconds || TOKEN_TTL_SECONDS),
    version: TOKEN_VERSION,
  };
  const payload = toBase64Url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function verifyReviewEmailToken(token: string | null | undefined): ReviewEmailTokenClaims | null {
  const normalized = String(token || "").trim();
  if (!normalized) return null;
  const [payload, signature] = normalized.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as ReviewEmailTokenClaims;
    if (claims.version !== TOKEN_VERSION) return null;
    if (!claims.reviewWindowId) return null;
    if (claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
