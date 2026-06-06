import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { isInternalDemoUserRecord } from "@/lib/internal-identities";

const IS_DEV = process.env.NODE_ENV !== "production";

function isDevAuditEmail(email: unknown): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized.endsWith("@reliance.test");
}

export async function requireVerifiedEmailForAction(params: {
  userId: string;
  action: string;
}) {
  const userId = String(params.userId || "").trim();
  if (!userId) {
    return NextResponse.json(
      {
        error: "Authenticated user is required",
        code: "AUTHENTICATION_REQUIRED",
      },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      demo: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: "User not found",
        code: "USER_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  if (IS_DEV && (isInternalDemoUserRecord(user) || isDevAuditEmail(user.email))) {
    return null;
  }

  const credential = await findDbCredentialByUserId(userId).catch(() => null);
  if (!credential?.email) {
    return NextResponse.json(
      {
        error: "A verified email is required for this action.",
        code: "EMAIL_VERIFICATION_REQUIRED",
        action: params.action,
      },
      { status: 403 }
    );
  }

  if (!credential.emailVerifiedAt) {
    return NextResponse.json(
      {
        error: "Verify your email before continuing.",
        code: "EMAIL_VERIFICATION_REQUIRED",
        action: params.action,
        email: credential.email,
      },
      { status: 403 }
    );
  }

  return null;
}
