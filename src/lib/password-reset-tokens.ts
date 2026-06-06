import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { addRegisteredUser, findRegisteredUserByEmail } from "@/lib/dev-registered-users";
import { hashPassword } from "@/lib/auth-password";
import { findDbCredentialByEmail, upsertDbCredential } from "@/lib/auth-credentials";

type PasswordResetTokenRecord = {
  email: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
};

const RESET_TOKEN_FILE = path.join(process.cwd(), "tmp", "password-reset-tokens.json");

function readTokenStore(): PasswordResetTokenRecord[] {
  try {
    if (!fs.existsSync(RESET_TOKEN_FILE)) return [];
    const raw = fs.readFileSync(RESET_TOKEN_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => ({
      email: String(row?.email || ""),
      tokenHash: String(row?.tokenHash || ""),
      expiresAt: new Date(String(row?.expiresAt || "")),
      used: Boolean(row?.used),
    }));
  } catch (error) {
    console.warn("Failed to read password reset tokens:", error);
    return [];
  }
}

function writeTokenStore(records: PasswordResetTokenRecord[]) {
  try {
    fs.mkdirSync(path.dirname(RESET_TOKEN_FILE), { recursive: true });
    fs.writeFileSync(
      RESET_TOKEN_FILE,
      JSON.stringify(
        records.map((record) => ({
          ...record,
          expiresAt: record.expiresAt.toISOString(),
        })),
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.warn("Failed to persist password reset tokens:", error);
  }
}

function cleanExpiredTokens(records: PasswordResetTokenRecord[]) {
  const now = Date.now();
  return records.filter((record) => record.expiresAt.getTime() > now);
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function findUserByEmail(email: string) {
  return findRegisteredUserByEmail(String(email || "").trim().toLowerCase());
}

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function storePasswordResetToken(email: string): string {
  const resetToken = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const records = cleanExpiredTokens(readTokenStore());

  records.push({
    email,
    tokenHash: hashResetToken(resetToken),
    expiresAt,
    used: false,
  });
  writeTokenStore(records);

  return resetToken;
}

export function validateResetToken(token: string) {
  return cleanExpiredTokens(readTokenStore()).find(
    (rt) =>
      rt.tokenHash === hashResetToken(token) && rt.expiresAt > new Date() && !rt.used
  );
}

export function markTokenAsUsed(token: string) {
  const records = cleanExpiredTokens(readTokenStore());
  const resetToken = records.find((rt) => rt.tokenHash === hashResetToken(token));
  if (!resetToken) return;
  resetToken.used = true;
  writeTokenStore(records);
}

export function updateRegisteredUserPassword(email: string, newPassword: string) {
  const user = findRegisteredUserByEmail(email);
  if (!user) return false;

  addRegisteredUser({
    ...user,
    passwordHash: hashPassword(newPassword),
  });
  return true;
}

export { findUserByEmail };

export async function findAnyAuthUserByEmail(email: string) {
  const registryUser = findRegisteredUserByEmail(email);
  const dbCredential = await findDbCredentialByEmail(email).catch(() => null);
  return {
    registryUser,
    dbCredential,
    exists: Boolean(registryUser || dbCredential),
  };
}

export async function updateAnyAuthUserPassword(email: string, newPassword: string) {
  const registryUpdated = updateRegisteredUserPassword(email, newPassword);
  const dbCredential = await findDbCredentialByEmail(email).catch(() => null);
  if (dbCredential) {
    await upsertDbCredential({
      userId: dbCredential.userId,
      email,
      passwordHash: hashPassword(newPassword),
      emailVerifiedAt: dbCredential.emailVerifiedAt ?? undefined,
    });
  }
  return registryUpdated || Boolean(dbCredential);
}
