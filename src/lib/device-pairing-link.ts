import crypto from "crypto";

const DEV_PAIRING_SECRET = "reliance-dev-device-pairing-secret-change-me";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface DevicePairingInviteClaims {
  code: string;
  vendorId: string;
  vendorName: string;
  expiresAt: number;
  issuedAt: number;
  version: 1;
}

function resolvePairingSecret(): string {
  const configured = String(process.env.DEVICE_PAIRING_SECRET || process.env.AUTH_SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (!IS_PRODUCTION) return DEV_PAIRING_SECRET;
  throw new Error("DEVICE_PAIRING_SECRET is required in production");
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

function sign(payloadBase64Url: string): string {
  return toBase64Url(
    crypto.createHmac("sha256", resolvePairingSecret()).update(payloadBase64Url).digest()
  );
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createDevicePairingInviteToken(input: {
  code: string;
  vendorId: string;
  vendorName: string;
  expiresAt: Date;
}): string {
  const claims: DevicePairingInviteClaims = {
    code: String(input.code || "").trim(),
    vendorId: String(input.vendorId || "").trim(),
    vendorName: String(input.vendorName || "Reliance vendor").trim() || "Reliance vendor",
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(new Date(input.expiresAt).getTime() / 1000),
    version: 1,
  };
  const payload = toBase64Url(JSON.stringify(claims));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyDevicePairingInviteToken(
  token: string | null | undefined,
): DevicePairingInviteClaims | null {
  const normalized = String(token || "").trim();
  if (!normalized) return null;
  const [payload, signature] = normalized.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as DevicePairingInviteClaims;
    if (!claims?.code || !claims?.vendorId || !claims?.expiresAt || claims.version !== 1) return null;
    if (!/^\d{6}$/.test(String(claims.code))) return null;
    if (claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
