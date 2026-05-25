import { NextRequest, NextResponse } from "next/server";
import { registeredUsers } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { addressChanged, geocodeAddress } from "@/lib/geocoding";

/** Dev / interim login tokens accepted by customer profile routes. */
const DEV_BEARER_TOKENS = new Set(["temp-jwt-token", "temp-token"]);

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

function splitDisplayName(name: string | null | undefined) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";
  return { firstName, lastName };
}

export async function GET(request: NextRequest) {
  let resolvedUserId: string | null = null;
  try {
    const token = parseBearer(request);
    if (!token) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    if (!DEV_BEARER_TOKENS.has(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    resolvedUserId = await getUserIdFromRequest(request);
    if (!resolvedUserId) {
      return NextResponse.json(
        { error: "Unauthorized: missing user context (cookie or x-user-id)" },
        { status: 401 }
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
    );

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
    };

    return NextResponse.json({
      success: true,
      profile: profileData,
    });
  } catch (error) {
    const err = error as any;
    console.error("[PROFILE_API_ERROR]", err);
    if (isTransientDbConnectivityError(err)) {
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
            address: fallbackRow.address || "",
            city: fallbackRow.city || "",
            state: fallbackRow.state || "",
            zipCode: fallbackRow.zipCode || "",
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
    const token = parseBearer(request);
    if (!token) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    if (!DEV_BEARER_TOKENS.has(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

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

    if (customerIndex !== -1) {
      registeredUsers[customerIndex] = {
        ...registeredUsers[customerIndex],
        ...body,
      };
    }

    const splitName = splitDisplayName(updatedDbUser?.name);
    const fallbackProfile = customerIndex !== -1 ? registeredUsers[customerIndex] : {};
    const profile = updatedDbUser
      ? {
          id: updatedDbUser.id,
          firstName: firstName || splitName.firstName,
          lastName: lastName || splitName.lastName,
          email: updatedDbUser.email || "",
          phone: updatedDbUser.phone || "",
          address: updatedDbUser.address || "",
          city: updatedDbUser.city || "",
          state: updatedDbUser.state || "",
          zipCode: updatedDbUser.zipCode || "",
          latitude: updatedDbUser.latitude ?? null,
          longitude: updatedDbUser.longitude ?? null,
          geocodedAt: updatedDbUser.geocodedAt?.toISOString() ?? null,
          locationPreferenceEnabled: updatedDbUser.locationPreferenceEnabled ?? false,
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
    console.error("Error updating customer profile:", error);
    return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 });
  }
}
