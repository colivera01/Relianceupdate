import { NextRequest, NextResponse } from "next/server";
import { findRegisteredUserByEmail, registeredUsers, addRegisteredUser } from "@/lib/dev-registered-users";
import { hashPassword, verifyPassword } from "@/lib/auth-password";
import {
  accountStatusErrorBody,
  AccountStatusError,
  isUserAccountRestricted,
} from "@/lib/account-status";
import { isOwnerAdminEmail, isOwnerAdminPhone, isOwnerAdminUserId } from "@/lib/internal-identities";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { clearFailedLoginAttempts, getAuthRateLimitKey, getLoginThrottleState, recordFailedLoginAttempt } from "@/lib/auth-rate-limit";
import { findDbCredentialByEmail, upsertDbCredential } from "@/lib/auth-credentials";
import { issueLoginMfaChallenge, requiresLoginMfa, resolveTrustedDeviceUserIdFromRequest } from "@/lib/auth-mfa";
import { buildSuccessfulLoginResponse } from "@/lib/auth-login-response";
import type { AuthLoginUserPayload } from "@/lib/auth-login-response";
import { sanitizeCustomerFacingAvatar } from "@/lib/avatar-display";
import { prisma } from "@/server/db";

const IS_DEV = process.env.NODE_ENV !== "production";

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getRegistryProfiles(user: any): Set<string> {
  const profiles = new Set<string>();
  const normalizedUserType = String(user?.userType ?? "")
    .trim()
    .toLowerCase();
  const hasVendorSignals = Boolean(
    user?.businessName || user?.category || user?.serviceTypes
  );

  if (normalizedUserType === "admin") {
    profiles.add("admin");
  }

  if (normalizedUserType === "vendor" || normalizedUserType === "both" || hasVendorSignals) {
    profiles.add("vendor");
  }

  if (normalizedUserType === "customer" || normalizedUserType === "both") {
    profiles.add("customer");
  }

  if (!profiles.size && !hasVendorSignals) {
    profiles.add("customer");
  }

  return profiles;
}

function toSessionUserType(profiles: Set<string>, fallbackUserType: string | undefined): string {
  if (profiles.has("admin")) return "admin";
  if (profiles.has("customer") && profiles.has("vendor")) return "both";
  if (profiles.has("vendor")) return "vendor";
  if (profiles.has("customer")) return "customer";
  return fallbackUserType || "customer";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailNorm = normalizeEmail(body?.email);
    const passwordRaw = body?.password != null ? String(body.password) : "";

    console.log("[auth/login] attempt", { email: emailNorm, passwordLen: passwordRaw.length });

    const rateLimitKey = getAuthRateLimitKey(emailNorm, request);
    const throttleState = getLoginThrottleState(rateLimitKey);
    if (throttleState.blocked) {
      return NextResponse.json(
        {
          error: "Too many failed sign-in attempts. Please try again later.",
          code: "LOGIN_TEMPORARILY_LOCKED",
          retryAfterSeconds: throttleState.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(throttleState.retryAfterSeconds),
          },
        }
      );
    }

    if (!emailNorm || !passwordRaw) {
      return NextResponse.json(
        {
          error: "Email and password are required",
          code: "MISSING_CREDENTIALS",
        },
        { status: 400 }
      );
    }

    const user = findRegisteredUserByEmail(emailNorm);
    let dbCredential: Awaited<ReturnType<typeof findDbCredentialByEmail>> = null;
    try {
      dbCredential = await findDbCredentialByEmail(emailNorm);
    } catch (credentialLookupError) {
      if (!IS_DEV) {
        throw credentialLookupError;
      }
      console.warn("[auth/login] credential lookup skipped:", credentialLookupError);
    }

    if (!user && !dbCredential) {
      recordFailedLoginAttempt(rateLimitKey);
      console.warn("[auth/login] USER_NOT_FOUND in dev registry", {
        email: emailNorm,
        knownEmails: registeredUsers.map((u) => u?.email).filter(Boolean),
      });
      return NextResponse.json(
        {
          error: IS_DEV
            ? `No dev user registered for "${emailNorm}". Check src/lib/dev-registered-users.ts.`
            : "Invalid email or password",
          code: "USER_NOT_FOUND",
        },
        { status: 401 }
      );
    }

    const credentialSource = dbCredential?.passwordHash
      ? dbCredential.passwordHash
      : String(user?.passwordHash || user?.password || "");

    if (!verifyPassword(passwordRaw, credentialSource)) {
      recordFailedLoginAttempt(rateLimitKey);
      console.warn("[auth/login] INVALID_PASSWORD", { email: emailNorm });
      return NextResponse.json(
        {
          error: IS_DEV
            ? "Password does not match the dev registry for this email. Use the exact password from dev-registered-users (or reset dev user)."
            : "Invalid email or password",
          code: "INVALID_PASSWORD",
        },
        { status: 401 }
      );
    }

    if (user && !user.passwordHash) {
      addRegisteredUser({
        ...user,
        passwordHash: hashPassword(passwordRaw),
      });
    }

    clearFailedLoginAttempts(rateLimitKey);

    console.log("[auth/login] credentials OK, resolving DB user for:", emailNorm);

    let usedDevRegistryIdBecauseDbUnreachable = false;

    let resolvedUserId = dbCredential?.userId || user?.id || "temp-id";
    let resolvedDbUser: { id: string; accountStatus: string; name?: string | null; email?: string | null; phone?: string | null } | null = null;
    try {
      const dbUser = await prisma.user.findFirst({
        where: { email: user?.email || emailNorm },
        select: { id: true, accountStatus: true, name: true, email: true, phone: true },
      });
      if (dbUser?.id) {
        resolvedDbUser = dbUser;
        if (isUserAccountRestricted(dbUser.accountStatus)) {
          const statusError = new AccountStatusError("user", dbUser.accountStatus);
          return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
        }
        resolvedUserId = dbUser.id;
      } else if (IS_DEV) {
        console.warn("[auth/login] no Prisma user row for email; using dev registry id", {
          email: user?.email || emailNorm,
          fallbackId: resolvedUserId,
        });
      }
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.error("[auth/login] Prisma error while resolving user id:", msg);
      if (IS_DEV) {
        usedDevRegistryIdBecauseDbUnreachable = true;
        console.warn("[auth/login] DEV: using dev registry user id (DB unreachable). Add client IP to Azure SQL firewall for Prisma-backed ids.", {
          fallbackId: resolvedUserId,
        });
      } else {
        return NextResponse.json(
          {
            error: "Login failed. Please try again.",
            code: "USER_ID_RESOLUTION_DB_ERROR",
          },
          { status: 503 }
        );
      }
    }

    const profileSet = getRegistryProfiles(user);
    const isOwnerAdminIdentity =
      isOwnerAdminEmail(user?.email || resolvedDbUser?.email || emailNorm) ||
      isOwnerAdminPhone(user?.phone || resolvedDbUser?.phone) ||
      isOwnerAdminUserId(resolvedUserId) ||
      isOwnerAdminUserId(user?.id);

    if (isOwnerAdminIdentity) {
      profileSet.add("admin");
    }

    try {
      const vendorAccess = await resolveVendorAccessForUser(resolvedUserId);
      if ((vendorAccess.state === "ACTIVE" || vendorAccess.state === "PENDING") && vendorAccess.vendorId) {
        profileSet.add("vendor");
      }
    } catch (vendorErr: unknown) {
      const msg = vendorErr instanceof Error ? vendorErr.message : String(vendorErr);
      console.error("[auth/login] Prisma error while resolving vendor membership:", msg);
      if (!IS_DEV) {
        return NextResponse.json(
          {
            error: "Login failed. Please try again.",
            code: "VENDOR_PROFILE_RESOLUTION_DB_ERROR",
          },
          { status: 503 }
        );
      }
    }

    const availableProfiles = (["customer", "vendor", "admin"] as const).filter((profile) =>
      profileSet.has(profile)
    );
    const sessionUserType = toSessionUserType(profileSet, user?.userType);

    const userResponse: AuthLoginUserPayload = {
      id: resolvedUserId,
      name:
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        resolvedDbUser?.name ||
        user?.email ||
        resolvedDbUser?.email ||
        emailNorm,
      email: user?.email || resolvedDbUser?.email || emailNorm,
      userType: sessionUserType as AuthLoginUserPayload["userType"],
      availableProfiles,
      emailVerified: Boolean(dbCredential?.emailVerifiedAt),
      emailVerifiedAt: dbCredential?.emailVerifiedAt?.toISOString?.() ?? null,
      avatar: sanitizeCustomerFacingAvatar(user?.avatar) || undefined,
    };

    let resolvedCredentialForMfa = dbCredential;
    try {
      const syncedCredential = await upsertDbCredential({
        userId: resolvedUserId,
        email: user?.email || emailNorm,
        passwordHash: dbCredential?.passwordHash || String(user?.passwordHash || ""),
      });
      if (syncedCredential?.id && syncedCredential?.email) {
        resolvedCredentialForMfa = syncedCredential;
      }
    } catch (credentialUpsertError) {
      if (!IS_DEV) {
        throw credentialUpsertError;
      }
      console.warn("[auth/login] credential upsert skipped:", credentialUpsertError);
    }
    const mfaRequired = requiresLoginMfa(availableProfiles);
    const trustedDeviceUserId = mfaRequired
      ? await resolveTrustedDeviceUserIdFromRequest(request).catch(() => null)
      : null;
    const trustedDeviceMatchesUser =
      mfaRequired && trustedDeviceUserId && String(trustedDeviceUserId) === String(resolvedUserId);

    if (mfaRequired && !trustedDeviceMatchesUser) {
      const credentialForMfa =
        resolvedCredentialForMfa?.id && resolvedCredentialForMfa?.email
          ? resolvedCredentialForMfa
          : await findDbCredentialByEmail(userResponse.email).catch(() => null);
      if (!credentialForMfa?.id || !credentialForMfa.email) {
        return NextResponse.json(
          {
            error: IS_DEV
              ? "Reliance could not load the email-backed sign-in credential required to start MFA. Try again; if it keeps happening, check Azure SQL connectivity."
              : "Sign-in is temporarily unavailable. Please try again.",
            code: "MFA_CREDENTIAL_UNAVAILABLE",
          },
          { status: 503 }
        );
      }

      const challenge = await issueLoginMfaChallenge({
        credentialId: String(credentialForMfa.id),
        userId: resolvedUserId,
        email: credentialForMfa.email,
        recipientName: userResponse.name,
        baseUrl: request.nextUrl.origin,
        userSnapshot: userResponse,
      });

      return NextResponse.json(
        {
          success: true,
          mfaRequired: true,
          message: "A sign-in code was sent to your email.",
          challengeId: challenge.challengeId,
          email: credentialForMfa.email,
          availableProfiles,
          userType: sessionUserType,
          ...(IS_DEV ? { mfaCodePreview: challenge.codePreview } : {}),
        },
        { status: 202 }
      );
    }

    return buildSuccessfulLoginResponse({
      user: userResponse,
      ...(IS_DEV && usedDevRegistryIdBecauseDbUnreachable
        ? {
            devWarning:
              "Database unreachable; logged in with dev-registry user id. Add your public IP to the Azure SQL server firewall (error 40615) so ids match Prisma and My Services/bookings stay consistent.",
          }
        : {}),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[auth/login] unhandled error:", error);
    return NextResponse.json(
      {
        error: IS_DEV ? `Login route exception: ${msg}` : "Login failed. Please try again.",
        code: "LOGIN_ROUTE_EXCEPTION",
        details: IS_DEV ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
