import crypto from "crypto";

export function createOpaqueSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashOpaqueSecret(secret: string): string {
  return crypto
    .createHash("sha256")
    .update(String(secret || ""), "utf8")
    .digest("hex");
}

export function safeSecretEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}
