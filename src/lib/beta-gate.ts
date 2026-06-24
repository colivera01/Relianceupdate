export type BetaGateConfig = {
  enabled: boolean;
  password: string;
  cookieName: string;
  cookieMaxAgeDays: number;
};

export const DEFAULT_BETA_GATE_COOKIE_NAME = "reliance_beta_access";
export const DEFAULT_BETA_GATE_COOKIE_MAX_AGE_DAYS = 14;
const TOKEN_VERSION = 1;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseBoolean(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 365);
}

export function getBetaGateConfig(
  env: Partial<Record<string, string | undefined>> = process.env
): BetaGateConfig {
  return {
    enabled: parseBoolean(env.BETA_GATE_ENABLED),
    password: String(env.BETA_GATE_PASSWORD || "").trim(),
    cookieName:
      String(env.BETA_GATE_COOKIE_NAME || "").trim() || DEFAULT_BETA_GATE_COOKIE_NAME,
    cookieMaxAgeDays: parsePositiveInteger(
      env.BETA_GATE_COOKIE_MAX_AGE_DAYS,
      DEFAULT_BETA_GATE_COOKIE_MAX_AGE_DAYS
    ),
  };
}

export function getBetaGateCookieMaxAgeSeconds(config: BetaGateConfig): number {
  return config.cookieMaxAgeDays * 24 * 60 * 60;
}

export function isBetaGateConfigured(config: BetaGateConfig): boolean {
  return Boolean(config.enabled && config.password);
}

export function isBetaGateBypassPath(pathname: string): boolean {
  const path = pathname || "/";

  if (path === "/beta-access" || path.startsWith("/beta-access/")) return true;
  if (path === "/api/beta-gate" || path.startsWith("/api/beta-gate/")) return true;
  if (path === "/api/health" || path.startsWith("/api/health/")) return true;

  // Public compliance pages must remain reviewable by messaging carriers even
  // when the wider beta site is password protected.
  const publicCompliancePaths = ["/privacy", "/terms", "/sms-policy", "/auth/register", "/help"];
  if (
    publicCompliancePaths.some(
      (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`)
    )
  ) {
    return true;
  }

  if (path.startsWith("/_next/")) return true;
  if (path.startsWith("/__nextjs")) return true;

  if (
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/manifest.json"
  ) {
    return true;
  }

  // Public assets such as images, scripts, fonts, and homepage video clips should not
  // be redirected to the beta access form.
  return /\/[^/]+\.[a-zA-Z0-9]{2,8}$/.test(path);
}

export function sanitizeBetaReturnTo(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) return "/";
  if (normalized.startsWith("/api/beta-gate")) return "/";
  return normalized;
}

function getCryptoSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is required for beta gate token signing.");
  }
  return subtle;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodePayload(payload: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload<T>(value: string): T | null {
  try {
    const bytes = base64UrlToBytes(value);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await getCryptoSubtle().importKey(
    "raw",
    new TextEncoder().encode(`reliance-beta-gate:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await getCryptoSubtle().sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function createBetaGateToken(
  config: BetaGateConfig,
  issuedAtMs: number = Date.now()
): Promise<string> {
  if (!config.password) {
    throw new Error("BETA_GATE_PASSWORD is required when beta gate is enabled.");
  }

  const payload = encodePayload({
    v: TOKEN_VERSION,
    iat: issuedAtMs,
  });
  const signature = await signPayload(payload, config.password);
  return `${payload}.${signature}`;
}

export async function verifyBetaGateToken(
  token: string | null | undefined,
  config: BetaGateConfig,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (!config.enabled) return true;
  if (!config.password) return false;

  const normalized = String(token || "").trim();
  const [payload, signature] = normalized.split(".");
  if (!payload || !signature) return false;

  const decoded = decodePayload<{ v?: number; iat?: number }>(payload);
  if (!decoded || decoded.v !== TOKEN_VERSION || !Number.isFinite(decoded.iat)) return false;

  const expiresAtMs = Number(decoded.iat) + config.cookieMaxAgeDays * ONE_DAY_MS;
  if (expiresAtMs <= nowMs) return false;

  const expectedSignature = await signPayload(payload, config.password);
  return safeEqual(signature, expectedSignature);
}

export function betaNoIndexHeaders(headers = new Headers()): Headers {
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return headers;
}
