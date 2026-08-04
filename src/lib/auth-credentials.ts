import crypto from "crypto";
import { prisma } from "@/server/db";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function createCredentialId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

export type DbAuthCredential = {
  id: string;
  userId: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  passwordUpdatedAt: Date;
};

export async function findDbCredentialByEmail(email: string): Promise<DbAuthCredential | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const credential = await (prisma as any).authCredential?.findUnique?.({
    where: { email: normalizedEmail },
    select: {
      id: true,
      userId: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      passwordUpdatedAt: true,
    },
  });

  return credential ? (credential as DbAuthCredential) : null;
}

export async function findDbCredentialByUserId(userId: string): Promise<DbAuthCredential | null> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;

  const credential = await (prisma as any).authCredential?.findUnique?.({
    where: { userId: normalizedUserId },
    select: {
      id: true,
      userId: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      passwordUpdatedAt: true,
    },
  });

  return credential ? (credential as DbAuthCredential) : null;
}

export async function upsertDbCredential(params: {
  userId: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt?: Date | null;
  db?: any;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  if (!params.userId || !normalizedEmail || !params.passwordHash) {
    throw new Error("Missing required credential fields");
  }

  const updateData: Record<string, unknown> = {
    email: normalizedEmail,
    passwordHash: params.passwordHash,
    passwordUpdatedAt: new Date(),
  };
  if (Object.prototype.hasOwnProperty.call(params, "emailVerifiedAt")) {
    updateData.emailVerifiedAt = params.emailVerifiedAt;
  }

  const db = params.db || (prisma as any);
  return db.authCredential.upsert({
    where: { userId: params.userId },
    create: {
      id: createCredentialId(),
      userId: params.userId,
      email: normalizedEmail,
      passwordHash: params.passwordHash,
      emailVerifiedAt: params.emailVerifiedAt ?? null,
    },
    update: {
      ...updateData,
    },
  });
}
