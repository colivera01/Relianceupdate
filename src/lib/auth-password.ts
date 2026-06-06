import crypto from "crypto";

const HASH_PREFIX = "scrypt$";
const KEY_LENGTH = 64;

export function isPasswordHash(value: unknown): boolean {
  return String(value || "").startsWith(HASH_PREFIX);
}

export function hashPassword(password: string): string {
  const normalized = String(password || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(normalized, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  const normalizedStored = String(storedValue || "");
  if (!normalizedStored) return false;

  if (!isPasswordHash(normalizedStored)) {
    return normalizedStored === String(password || "");
  }

  const [, salt, expectedKey] = normalizedStored.split("$");
  if (!salt || !expectedKey) return false;

  const actualKey = crypto.scryptSync(String(password || ""), salt, KEY_LENGTH).toString("hex");
  const expectedBuffer = Buffer.from(expectedKey, "hex");
  const actualBuffer = Buffer.from(actualKey, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
