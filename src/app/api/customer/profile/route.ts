import { NextRequest, NextResponse } from "next/server";
import { addRegisteredUser, registeredUsers, syncRegisteredUsersFromDisk } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { getAuthSessionClaimsFromRequest, verifyAuthBearerToken } from "@/lib/auth-session";
import { accountStatusErrorBody, AccountStatusError, isUserAccountRestricted } from "@/lib/account-status";
import { addressChanged, geocodeAddress } from "@/lib/geocoding";
import { findDbCredentialByUserId, upsertDbCredential } from "@/lib/auth-credentials";
import { sendOrPreviewEmailVerification } from "@/lib/auth-email-verification";
import { isOwnerAdminIdentity } from "@/lib/internal-identities";

function isTransientDbConnectivityError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');
  return (
    code === 'P1001' ||
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.toLowerCase().includes('prisma connect probe timeout')
  );
}

async function withTransientDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbConnectivityError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    return operation();
  }
}

function parseBearer(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

function hasAcceptedSession(request: NextRequest): boolean {
  const signedSession = getAuthSessionClaimsFromRequest(request);
  if (signedSession?.userId) return true;

  const token = parseBearer(request);
  if (!token) return false;
  if (verifyAuthBearerToken(token)?.userId) return true;
  return process.env.NODE_ENV !== "production" && Boolean(request.headers.get("x-user-id")?.trim());
}

function splitDisplayName(name: string | null | undefined) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";
  return { firstName, lastName };
}

export async function GET(request: NextRequest) {
  let resolvedUserId: string | null = null;
  try {
    syncRegisteredUsersFromDisk();
    if (!hasAcceptedSession(request)) {
      return NextResponse.json(
        { error: "Unauthorized: sign in required" },
        { status: 401 }
      );
    }

    resolvedUserId = await getUserIdFromRequest(request);
    if (!resolvedUserId) {
      return NextResponse.json(
        { error: "Unauthorized: missing authenticated user context" },
        { status: 401 }
      );
    }
    const signedSession = getAuthSessionClaimsFromRequest(request);
    if (isOwnerAdminIdentity({ id: resolvedUserId, email: signedSession?.email })) {
      return NextResponse.json(
        { error: "This Admin account does not have a Customer profile.", code: "ADMIN_ONLY_ACCOUNT" },
        { status: 403 }
      );
    }

    const dbUser = await withTransientDbRetry(() =>
      prisma.user.findUnique({
        where: { id: resolvedUserId as string },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          profilePhoto: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          latitude: true,
          longitude: true,
          geocodedAt: true,
          locationPreferenceEnabled: true,
          accountStatus: true,
          createdAt: true,
        },
      })
    );
    if (isOwnerAdminIdentity(dbUser)) {
      return NextResponse.json(
        { error: "This Admin account does not have a Customer profile.", code: "ADMIN_ONLY_ACCOUNT" },
        { status: 403 }
      );
    }
    const dbCredential = dbUser ? await findDbCredentialByUserId(dbUser.id).catch(() => null) : null;

    const devRow =
      registeredUsers.find((u) => String(u.id) === String(resolvedUserId)) ||
      (dbUser?.email
        ? registeredUsers.find(
            (u) =>
              u.email && String(u.email).toLowerCase() === String(dbUser.email).toLowerCase()
          )
        : undefined);

    if (!dbUser && !devRow) {
      return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    }
    if (dbUser && isUserAccountRestricted((dbUser as any).accountStatus)) {
      const statusError = new AccountStatusError("user", (dbUser as any).accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }

    const canonicalId = dbUser?.id ?? devRow?.id ?? resolvedUserId;
    const email = dbUser?.email ?? devRow?.email ?? "";
    const { firstName, lastName } = devRow
      ? { firstName: String(devRow.firstName || ""), lastName: String(devRow.lastName || "") }
      : splitDisplayName(dbUser?.name);

    const profileData = {
      id: canonicalId,
      firstName,
      lastName,
      email,
      phone: dbUser?.phone ?? devRow?.phone ?? "",
      profilePhoto: dbUser?.profilePhoto ?? devRow?.profilePhoto ?? null,
      address: dbUser?.address ?? devRow?.address ?? "",
      city: dbUser?.city ?? devRow?.city ?? "",
      state: dbUser?.state ?? devRow?.state ?? "",
      zipCode: dbUser?.zipCode ?? devRow?.zipCode ?? "",
      latitude: dbUser?.latitude ?? null,
      longitude: dbUser?.longitude ?? null,
      geocodedAt: dbUser?.geocodedAt?.toISOString() ?? null,
      locationPreferenceEnabled: dbUser?.locationPreferenceEnabled ?? false,
      bio: devRow?.bio ?? "",
      userType: devRow?.userType || "customer",
      createdAt: devRow?.createdAt ?? dbUser?.createdAt?.toISOString() ?? new Date().toISOString(),
      isActive: devRow?.isActive ?? true,
      preferences:
        devRow?.preferences ||
        ({
          notifications: true,
          emailMarketing: false,
        } as Record<string, unknown>),
      favorites: devRow?.favorites || [],
      bookingHistory: devRow?.bookingHistory || [],
      reviews: devRow?.reviews || [],
      emailVerified: Boolean(dbCredential?.emailVerifiedAt),
      emailVerifiedAt: dbCredential?.emailVerifiedAt?.toISOString?.() ?? null,
    };

    return NextResponse.json({
      success: true,
      profile: profileData,
    });
  } catch (error) {
    const err = error as any;
    console.error("[PROFILE_API_ERROR]", err);
    if (isTransientDbConnectivityError(err)) {
      syncRegisteredUsersFromDisk();
      const fallbackRow =
        resolvedUserId != null
          ? registeredUsers.find((u) => String(u.id) === String(resolvedUserId))
          : undefined;
      if (fallbackRow) {
        return NextResponse.json({
          success: true,
          profile: {
            id: fallbackRow.id,
            firstName: fallbackRow.firstName || "",
            lastName: fallbackRow.lastName || "",
            email: fallbackRow.email || "",
            phone: fallbackRow.phone || "",
            profilePhoto: fallbackRow.profilePhoto || null,
            address: fallbackRow.address || "",
            city: fallbackRow.city || "",
            state: fallbackRow.state || "",
            zipCode: fallbackRow.zipCode || "",
            locationPreferenceEnabled: Boolean((fallbackRow as any).locationPreferenceEnabled),
            bio: fallbackRow.bio || "",
            userType: fallbackRow.userType || "customer",
            createdAt: fallbackRow.createdAt || new Date().toISOString(),
            isActive: fallbackRow.isActive ?? true,
            preferences: fallbackRow.preferences || { notifications: true, emailMarketing: false },
            favorites: fallbackRow.favorites || [],
            bookingHistory: fallbackRow.bookingHistory || [],
            reviews: fallbackRow.reviews || [],
          },
          degraded: true,
          warning: "DB unavailable; served customer profile from dev registry fallback.",
        });
      }
      return NextResponse.json(
        {
          success: false,
          code: "DB_UNAVAILABLE",
          message: "The database is temporarily unavailable. Please try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: err?.message || "Unknown error",
        stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    syncRegisteredUsersFromDisk();
    if (!hasAcceptedSession(request)) {
      return NextResponse.json(
        { error: "Unauthorized: sign in required" },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signedSession = getAuthSessionClaimsFromRequest(request);
    if (isOwnerAdminIdentity({ id: userId, email: signedSession?.email })) {
      return NextResponse.json(
        { error: "This Admin account cannot update a Customer profile.", code: "ADMIN_ONLY_ACCOUNT" },
        { status: 403 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        profilePhoto: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        accountStatus: true,
      },
    });
    if (isOwnerAdminIdentity(dbUser)) {
      return NextResponse.json(
        { error: "This Admin account cannot update a Customer profile.", code: "ADMIN_ONLY_ACCOUNT" },
        { status: 403 }
      );
    }
    if (dbUser && isUserAccountRestricted((dbUser as any).accountStatus)) {
      const statusError = new AccountStatusError("user", (dbUser as any).accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }

    const customerIndex = registeredUsers.findIndex(
      (u) =>
        String(u.id) === String(userId) ||
        Boolean(
          dbUser?.email &&
            u.email &&
            String(u.email).toLowerCase() === String(dbUser.email).toLowerCase()
        )
    );

    if (!dbUser && customerIndex === -1) {
      return NextResponse.json(
        { error: "Customer profile not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim();
    const nextName = [firstName, lastName].filter(Boolean).join(" ") || undefined;
    const profileUpdate = {
      ...(nextName ? { name: nextName } : {}),
      ...(body?.email !== undefined ? { email: String(body.email || "").trim() || null } : {}),
      ...(body?.phone !== undefined ? { phone: String(body.phone || "").trim() || null } : {}),
      ...(body?.address !== undefined ? { address: String(body.address || "").trim() || null } : {}),
      ...(body?.city !== undefined ? { city: String(body.city || "").trim() || null } : {}),
      ...(body?.state !== undefined ? { state: String(body.state || "").trim() || null } : {}),
      ...(body?.zipCode !== undefined ? { zipCode: String(body.zipCode || "").trim() || null } : {}),
      ...(body?.locationPreferenceEnabled !== undefined
        ? { locationPreferenceEnabled: Boolean(body.locationPreferenceEnabled) }
        : {}),
    };
    const nextAddress = {
      address: body?.address !== undefined ? String(body.address || "").trim() : dbUser?.address,
      city: body?.city !== undefined ? String(body.city || "").trim() : dbUser?.city,
      state: body?.state !== undefined ? String(body.state || "").trim() : dbUser?.state,
      zipCode: body?.zipCode !== undefined ? String(body.zipCode || "").trim() : dbUser?.zipCode,
    };
    const shouldRefreshCoordinates =
      Boolean(dbUser) &&
      ["address", "city", "state", "zipCode"].some((key) => body?.[key] !== undefined) &&
      addressChanged(dbUser, nextAddress);
    const geocodeResult = shouldRefreshCoordinates ? await geocodeAddress(nextAddress) : null;
    const coordinateUpdate =
      geocodeResult?.status === "success"
        ? {
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            geocodedAt: geocodeResult.geocodedAt,
          }
        : shouldRefreshCoordinates
        ? {
            latitude: null,
            longitude: null,
            geocodedAt: null,
          }
        : {};

    const updatedDbUser = dbUser
      ? await (prisma as any).user.update({
          where: { id: userId },
          data: { ...profileUpdate, ...coordinateUpdate },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            profilePhoto: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
            geocodedAt: true,
            locationPreferenceEnabled: true,
            createdAt: true,
          },
        })
      : null;

    const nextEmail = String(
      body?.email !== undefined ? body.email || "" : updatedDbUser?.email || dbUser?.email || ""
    ).trim();
    const previousEmail = String(dbUser?.email || "").trim();
    const emailChanged = Boolean(nextEmail) && nextEmail.toLowerCase() !== previousEmail.toLowerCase();

    let updatedCredential = dbUser ? await findDbCredentialByUserId(dbUser.id).catch(() => null) : null;
    let verificationLinkPreview: string | undefined;
    let verificationTokenPreview: string | undefined;
    let emailDeliveryQueued: boolean | undefined;

    if (updatedCredential && nextEmail) {
      updatedCredential = await upsertDbCredential({
        userId: dbUser!.id,
        email: nextEmail,
        passwordHash: updatedCredential.passwordHash,
        emailVerifiedAt: emailChanged ? null : updatedCredential.emailVerifiedAt,
      });
      const refreshedCredential = updatedCredential!;

      if (emailChanged) {
        const credentialId = String(refreshedCredential.id);
        const verification = await sendOrPreviewEmailVerification({
          email: nextEmail,
          credentialId,
          recipientName: nextName || updatedDbUser?.name || null,
          baseUrl: request.nextUrl.origin,
        }).catch((error) => {
          console.error("Customer profile verification email send error:", error);
          return null;
        });
        emailDeliveryQueued = Boolean(verification?.sendResult.ok);
        if (process.env.NODE_ENV !== "production") {
          verificationLinkPreview = verification?.verificationLink;
          verificationTokenPreview = verification?.verificationTokenPreview;
        }
      }
    }

    if (customerIndex !== -1) {
      addRegisteredUser({
        ...registeredUsers[customerIndex],
        ...body,
        id: dbUser?.id || registeredUsers[customerIndex]?.id || userId,
        email: body?.email !== undefined ? String(body.email || "").trim() : dbUser?.email || registeredUsers[customerIndex]?.email || "",
        firstName,
        lastName,
        phone: body?.phone !== undefined ? String(body.phone || "").trim() : registeredUsers[customerIndex]?.phone || "",
        address: body?.address !== undefined ? String(body.address || "").trim() : registeredUsers[customerIndex]?.address || "",
        city: body?.city !== undefined ? String(body.city || "").trim() : registeredUsers[customerIndex]?.city || "",
        state: body?.state !== undefined ? String(body.state || "").trim() : registeredUsers[customerIndex]?.state || "",
        zipCode: body?.zipCode !== undefined ? String(body.zipCode || "").trim() : registeredUsers[customerIndex]?.zipCode || "",
        locationPreferenceEnabled:
          body?.locationPreferenceEnabled !== undefined
            ? Boolean(body.locationPreferenceEnabled)
            : Boolean(registeredUsers[customerIndex]?.locationPreferenceEnabled),
      });
      syncRegisteredUsersFromDisk();
    }

    const splitName = splitDisplayName(updatedDbUser?.name);
    const fallbackProfile =
      customerIndex !== -1
        ? registeredUsers.find(
            (candidate) =>
              String(candidate?.id || "") === String(dbUser?.id || userId) ||
              (candidate?.email &&
                String(candidate.email).toLowerCase() === String(body?.email || dbUser?.email || "").toLowerCase())
          ) || registeredUsers[customerIndex]
        : {};
    const profile = updatedDbUser
      ? {
          id: updatedDbUser.id,
          firstName: firstName || splitName.firstName,
          lastName: lastName || splitName.lastName,
          email: updatedDbUser.email || "",
          phone: updatedDbUser.phone || "",
          profilePhoto: updatedDbUser.profilePhoto || null,
          address: updatedDbUser.address || "",
          city: updatedDbUser.city || "",
          state: updatedDbUser.state || "",
          zipCode: updatedDbUser.zipCode || "",
          latitude: updatedDbUser.latitude ?? null,
          longitude: updatedDbUser.longitude ?? null,
          geocodedAt: updatedDbUser.geocodedAt?.toISOString() ?? null,
          locationPreferenceEnabled: updatedDbUser.locationPreferenceEnabled ?? false,
          emailVerified: Boolean(updatedCredential?.emailVerifiedAt),
          emailVerifiedAt: updatedCredential?.emailVerifiedAt?.toISOString?.() ?? null,
          bio: (fallbackProfile as any)?.bio || body?.bio || "",
          createdAt: updatedDbUser.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }
      : registeredUsers[customerIndex];

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile,
      ...(emailChanged
        ? {
            emailVerificationRequired: true,
            emailDeliveryQueued: Boolean(emailDeliveryQueued),
            ...(process.env.NODE_ENV !== "production" && verificationLinkPreview
              ? { verificationLinkPreview, verificationTokenPreview }
              : {}),
          }
        : {}),
    });
  } catch (error) {
    console.error("Error updating customer profile:", error);
    return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 });
  }
}
