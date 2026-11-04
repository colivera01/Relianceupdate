import { NextRequest, NextResponse } from "next/server";
import { addRegisteredUser, registeredUsers, syncRegisteredUsersFromDisk } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";
import { accountStatusErrorBody, AccountStatusError, isUserAccountRestricted } from "@/lib/account-status";
import { addressChanged, geocodeAddress } from "@/lib/geocoding";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import {
  authorizationErrorResponse,
  requireRequestActor,
} from "@/lib/request-actor";

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

function splitDisplayName(name: string | null | undefined) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";
  return { firstName, lastName };
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    value.length <= 32 &&
    /^\+?[0-9\s().-]+$/.test(value) &&
    digits.length >= 10 &&
    digits.length <= 15
  );
}

function uniqueConstraintTarget(error: unknown): string | null {
  if (String((error as any)?.code || "").toUpperCase() !== "P2002") return null;
  const target = (error as any)?.meta?.target;
  return Array.isArray(target)
    ? target.map((value) => String(value || "")).join(" ").toLowerCase()
    : String(target || "").toLowerCase();
}

export async function GET(request: NextRequest) {
  let resolvedUserId: string | null = null;
  try {
    syncRegisteredUsersFromDisk();
    const actor = await requireRequestActor(request);
    resolvedUserId = actor.userId;
    if (actor.platformRoles.includes("ADMIN")) {
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
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
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
    const actor = await requireRequestActor(request);
    const userId = actor.userId;
    if (actor.platformRoles.includes("ADMIN")) {
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
        name: true,
        phone: true,
        profilePhoto: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        accountStatus: true,
      },
    });
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
    const registryProfile = customerIndex !== -1 ? registeredUsers[customerIndex] : null;
    const currentName = dbUser
      ? splitDisplayName(dbUser.name)
      : {
          firstName: String(registryProfile?.firstName || "").trim(),
          lastName: String(registryProfile?.lastName || "").trim(),
        };
    const firstName = body?.firstName !== undefined
      ? String(body.firstName || "").trim()
      : currentName.firstName;
    const lastName = body?.lastName !== undefined
      ? String(body.lastName || "").trim()
      : currentName.lastName;
    const phone = body?.phone !== undefined
      ? String(body.phone || "").trim()
      : String(dbUser?.phone || registryProfile?.phone || "").trim();
    if (!firstName) {
      return NextResponse.json(
        { success: false, code: "PROFILE_FIRST_NAME_REQUIRED", error: "First name is required." },
        { status: 422 }
      );
    }
    if (!lastName) {
      return NextResponse.json(
        { success: false, code: "PROFILE_LAST_NAME_REQUIRED", error: "Last name is required." },
        { status: 422 }
      );
    }
    if (firstName.length > 100 || lastName.length > 100) {
      return NextResponse.json(
        { success: false, code: "PROFILE_NAME_TOO_LONG", error: "First and last names must each be 100 characters or fewer." },
        { status: 422 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { success: false, code: "PROFILE_PHONE_REQUIRED", error: "Phone number is required." },
        { status: 422 }
      );
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, code: "PROFILE_PHONE_INVALID", error: "Enter a valid phone number." },
        { status: 422 }
      );
    }
    const nextName = [firstName, lastName].filter(Boolean).join(" ") || undefined;
    const submittedEmail = body?.email !== undefined ? normalizeEmail(body.email) : null;
    if (submittedEmail !== null && !isValidEmail(submittedEmail)) {
      return NextResponse.json(
        {
          success: false,
          code: "PROFILE_EMAIL_INVALID",
          error: "Enter a valid email address.",
        },
        { status: 422 }
      );
    }

    const previousEmail = normalizeEmail(
      dbUser?.email || (customerIndex !== -1 ? registeredUsers[customerIndex]?.email : "")
    );
    if (submittedEmail !== null && submittedEmail !== previousEmail) {
      return NextResponse.json(
        {
          success: false,
          code: "PROFILE_EMAIL_CHANGE_REQUIRES_SUPPORT",
          error: "Your sign-in email cannot be changed from Profile Settings. Contact Support & Help for assistance.",
        },
        { status: 422 }
      );
    }

    const profileUpdate = {
      ...(body?.firstName !== undefined || body?.lastName !== undefined ? { name: nextName } : {}),
      ...(body?.phone !== undefined ? { phone } : {}),
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
    const updatedCredential = dbUser ? await findDbCredentialByUserId(dbUser.id).catch(() => null) : null;

    if (customerIndex !== -1) {
      try {
        addRegisteredUser({
          ...registeredUsers[customerIndex],
          ...body,
          id: dbUser?.id || registeredUsers[customerIndex]?.id || userId,
          email: previousEmail,
          firstName,
          lastName,
          phone,
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
      } catch (registryError) {
        if (!dbUser) throw registryError;
        console.error("Customer profile dev registry mirror failed after durable update:", registryError);
      }
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
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    const conflictTarget = uniqueConstraintTarget(error);
    if (conflictTarget !== null) {
      if (conflictTarget.includes("phone")) {
        return NextResponse.json(
          {
            success: false,
            code: "PROFILE_PHONE_IN_USE",
            error: "That phone number is already connected to another account.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          code: conflictTarget.includes("email") ? "PROFILE_EMAIL_IN_USE" : "PROFILE_CONFLICT",
          error: conflictTarget.includes("email")
            ? "That email address is already connected to another account."
            : "Those profile details conflict with another account. Review them or contact Support & Help.",
        },
        { status: 409 }
      );
    }
    console.error("Error updating customer profile:", error);
    return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 });
  }
}
