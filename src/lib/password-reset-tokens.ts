import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { addRegisteredUser, findRegisteredUserByEmail } from "@/lib/dev-registered-users";
import { hashPassword } from "@/lib/auth-password";
import { findDbCredentialByEmail, upsertDbCredential } from "@/lib/auth-credentials";
import { prisma } from "@/server/db";

type PasswordResetTokenRecord = {
  email: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
};

const RESET_TOKEN_FILE = path.join(process.cwd(), "tmp", "password-reset-tokens.json");
const PASSWORD_RESET_PURPOSE = "password_reset";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function createResetChallengeId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

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

async function findDbUserByEmail(email: string): Promise<{ id: string; email: string | null } | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const user = await (prisma as any).user
    ?.findFirst?.({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    })
    .catch(() => null);

  return user ? { id: String(user.id), email: user.email ? String(user.email) : null } : null;
}

export async function storePasswordResetToken(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  const resetToken = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  let dbCredential = await findDbCredentialByEmail(normalizedEmail);
  if (!dbCredential) {
    const dbUser = await findDbUserByEmail(normalizedEmail);
    if (dbUser?.id) {
      dbCredential = await upsertDbCredential({
        userId: dbUser.id,
        email: normalizedEmail,
        passwordHash: hashPassword(`reset-only:${crypto.randomBytes(32).toString("hex")}`),
        emailVerifiedAt: new Date(),
      });
    }
  }

  if (dbCredential?.id) {
    const now = new Date();
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.authMfaChallenge.updateMany({
        where: {
          credentialId: dbCredential.id,
          email: normalizedEmail,
          purpose: PASSWORD_RESET_PURPOSE,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });

      await tx.authMfaChallenge.create({
        data: {
          id: createResetChallengeId(),
          credentialId: dbCredential.id,
          userId: dbCredential.userId,
          email: normalizedEmail,
          codeHash: hashResetToken(resetToken),
          purpose: PASSWORD_RESET_PURPOSE,
          expiresAt,
        },
      });
    });

    return resetToken;
  }

  const records = cleanExpiredTokens(readTokenStore());

  records.push({
    email: normalizedEmail,
    tokenHash: hashResetToken(resetToken),
    expiresAt,
    used: false,
  });
  writeTokenStore(records);

  return resetToken;
}

export async function validateResetToken(token: string): Promise<PasswordResetTokenRecord | undefined> {
  const tokenHash = hashResetToken(token);
  const now = new Date();

  const dbRecord = await (prisma as any).authMfaChallenge
    .findFirst({
      where: {
        codeHash: tokenHash,
        purpose: PASSWORD_RESET_PURPOSE,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        email: true,
        codeHash: true,
        expiresAt: true,
        consumedAt: true,
      },
    })
    .catch((error: unknown) => {
      console.warn("Failed to validate DB password reset token:", error);
      return null;
    });

  if (dbRecord?.email) {
    return {
      email: normalizeEmail(dbRecord.email),
      tokenHash: String(dbRecord.codeHash),
      expiresAt: new Date(dbRecord.expiresAt),
      used: Boolean(dbRecord.consumedAt),
    };
  }

  return cleanExpiredTokens(readTokenStore()).find(
    (rt) =>
      rt.tokenHash === tokenHash && rt.expiresAt > now && !rt.used
  );
}

export async function markTokenAsUsed(token: string) {
  const tokenHash = hashResetToken(token);
  await (prisma as any).authMfaChallenge
    .updateMany({
      where: {
        codeHash: tokenHash,
        purpose: PASSWORD_RESET_PURPOSE,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    })
    .catch((error: unknown) => {
      console.warn("Failed to mark DB password reset token as used:", error);
    });

  const records = cleanExpiredTokens(readTokenStore());
  const resetToken = records.find((rt) => rt.tokenHash === tokenHash);
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
  const normalizedEmail = normalizeEmail(email);
  const registryUser = findRegisteredUserByEmail(normalizedEmail);
  const [dbCredential, dbUser] = await Promise.all([
    findDbCredentialByEmail(normalizedEmail).catch(() => null),
    findDbUserByEmail(normalizedEmail).catch(() => null),
  ]);
  return {
    registryUser,
    dbCredential,
    dbUser,
    exists: Boolean(registryUser || dbCredential || dbUser),
  };
}

export async function updateAnyAuthUserPassword(email: string, newPassword: string) {
  const normalizedEmail = normalizeEmail(email);
  const registryUpdated = updateRegisteredUserPassword(normalizedEmail, newPassword);
  const dbCredential = await findDbCredentialByEmail(normalizedEmail).catch(() => null);
  if (dbCredential) {
    await upsertDbCredential({
      userId: dbCredential.userId,
      email: normalizedEmail,
      passwordHash: hashPassword(newPassword),
      emailVerifiedAt: dbCredential.emailVerifiedAt ?? undefined,
    });
  }
  return registryUpdated || Boolean(dbCredential);
}
