import { NextRequest, NextResponse } from "next/server";
import { registeredUsers } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";

/** Dev / interim login tokens accepted by customer profile routes. */
const DEV_BEARER_TOKENS = new Set(["temp-jwt-token", "temp-token"]);

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
      return NextResponse.json(
        { error: "Unauthorized: missing user context (cookie or x-user-id)" },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, createdAt: true },
    });

    const devRow =
      registeredUsers.find((u) => String(u.id) === String(userId)) ||
      (dbUser?.email
        ? registeredUsers.find(
            (u) =>
              u.email && String(u.email).toLowerCase() === String(dbUser.email).toLowerCase()
          )
        : undefined);

    if (!dbUser && !devRow) {
      return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    }

    const canonicalId = dbUser?.id ?? devRow?.id ?? userId;
    const email = dbUser?.email ?? devRow?.email ?? "";
    const { firstName, lastName } = devRow
      ? { firstName: String(devRow.firstName || ""), lastName: String(devRow.lastName || "") }
      : splitDisplayName(dbUser?.name);

    const profileData = {
      id: canonicalId,
      firstName,
      lastName,
      email,
      phone: devRow?.phone ?? dbUser?.phone ?? "",
      address: devRow?.address ?? "",
      city: devRow?.city ?? "",
      state: devRow?.state ?? "",
      zipCode: devRow?.zipCode ?? "",
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
    console.error("Error fetching customer profile:", error);
    return NextResponse.json({ error: "Failed to fetch customer profile" }, { status: 500 });
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
      select: { id: true, email: true },
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

    if (customerIndex === -1) {
      return NextResponse.json(
        { error: "Customer profile not found in dev registry; cannot update in-memory row." },
        { status: 404 }
      );
    }

    const body = await request.json();

    registeredUsers[customerIndex] = {
      ...registeredUsers[customerIndex],
      ...body,
    };

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: registeredUsers[customerIndex],
    });
  } catch (error) {
    console.error("Error updating customer profile:", error);
    return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 });
  }
}
