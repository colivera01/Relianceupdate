import crypto from "crypto";

export function resolveEmployeeAccessTokenSecret(): string {
  const configured = String(process.env.EMPLOYEE_CAPTURE_TOKEN_SECRET || process.env.AUTH_SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "reliance-dev-employee-capture-token-secret";
  throw new Error("EMPLOYEE_CAPTURE_TOKEN_SECRET or AUTH_SESSION_SECRET is required");
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

function signature(payload: string): string {
  return toBase64Url(
    crypto.createHmac("sha256", resolveEmployeeAccessTokenSecret()).update(payload).digest(),
  );
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSignedEmployeeAccessToken(claims: Record<string, unknown>): string {
  const payload = toBase64Url(JSON.stringify(claims));
  return `${payload}.${signature(payload)}`;
}

export function verifySignedEmployeeAccessToken<T>(token: string | null | undefined): T | null {
  const normalized = String(token || "").trim();
  if (!normalized) return null;
  const [payload, signed] = normalized.split(".");
  if (!payload || !signed || !safeEqual(signature(payload), signed)) return null;
  try {
    return JSON.parse(fromBase64Url(payload).toString("utf8")) as T;
  } catch {
    return null;
  }
}
