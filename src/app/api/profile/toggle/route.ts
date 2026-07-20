import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getAuthSessionClaimsFromRequest, verifyAuthBearerToken } from "@/lib/auth-session";
import { registeredUsers, syncRegisteredUsersFromDisk } from "@/lib/dev-registered-users";
import {
  isOwnerAdminIdentity,
} from "@/lib/internal-identities";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";

type SwitchableProfile = "customer" | "vendor";

function getBearerTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

function normalizeProfile(value: unknown): SwitchableProfile | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "customer" || normalized === "vendor" ? normalized : null;
}

async function resolveProfileState(request: NextRequest, authenticatedUserId: string) {
  const signedSession = getAuthSessionClaimsFromRequest(request);
  if (isOwnerAdminIdentity({ id: authenticatedUserId, email: signedSession?.email })) {
    return {
      availableProfiles: [] as SwitchableProfile[],
      currentProfile: null,
      canSwitch: false,
    };
  }

  syncRegisteredUsersFromDisk();

  const bearerToken = getBearerTokenFromRequest(request);
  const signedBearer = bearerToken ? verifyAuthBearerToken(bearerToken) : null;
  const sessionClaims = signedSession || signedBearer;

  const dbUser = await prisma.user.findUnique({
    where: { id: authenticatedUserId },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });
  if (isOwnerAdminIdentity(dbUser)) {
    return {
      availableProfiles: [] as SwitchableProfile[],
      currentProfile: null,
      canSwitch: false,
    };
  }

  const devRow =
    registeredUsers.find((user) => String(user.id || "").trim() === authenticatedUserId) ||
    (dbUser?.email
      ? registeredUsers.find(
          (user) =>
            String(user.email || "").trim().toLowerCase() ===
            String(dbUser.email || "").trim().toLowerCase()
        )
      : undefined);

  const profileSet = new Set<SwitchableProfile>();
  const sessionProfiles = Array.isArray(sessionClaims?.availableProfiles)
    ? sessionClaims.availableProfiles
    : [];

  for (const profile of sessionProfiles) {
    const normalized = normalizeProfile(profile);
    if (normalized) profileSet.add(normalized);
  }

  const sessionUserType = String(sessionClaims?.userType || "").trim().toLowerCase();
  if (sessionUserType === "customer" || sessionUserType === "both") {
    profileSet.add("customer");
  }
  if (sessionUserType === "vendor" || sessionUserType === "both") {
    profileSet.add("vendor");
  }

  const vendorAccess = await resolveVendorAccessForUser(authenticatedUserId).catch(() => null);
  if (vendorAccess?.state === "ACTIVE" && vendorAccess.vendorId) {
    profileSet.add("vendor");
  }

  const devUserType = String(devRow?.userType || "").trim().toLowerCase();
  if (devUserType === "customer" || devUserType === "both") {
    profileSet.add("customer");
  }

  if (!profileSet.size) {
    profileSet.add("customer");
  }

  const orderedProfiles = (["customer", "vendor"] as const).filter((profile) =>
    profileSet.has(profile)
  );

  const searchParams = new URL(request.url).searchParams;
  const requestedCurrentProfile = normalizeProfile(searchParams.get("currentProfile"));
  let currentProfile: SwitchableProfile = "customer";

  if (requestedCurrentProfile && profileSet.has(requestedCurrentProfile)) {
    currentProfile = requestedCurrentProfile;
  } else if (sessionUserType === "vendor" && profileSet.has("vendor")) {
    currentProfile = "vendor";
  } else if (!profileSet.has("customer") && profileSet.has("vendor")) {
    currentProfile = "vendor";
  }

  return {
    availableProfiles: orderedProfiles,
    currentProfile,
    canSwitch: orderedProfiles.length > 1,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const requestedUserId = String(body?.userId || "").trim();
    const targetProfileType = normalizeProfile(body?.targetProfileType);

    if (!targetProfileType) {
      return NextResponse.json(
        { error: 'Invalid profile type. Must be "customer" or "vendor".' },
        { status: 400 }
      );
    }

    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      return NextResponse.json(
        { error: "You can only switch profiles for your own account." },
        { status: 403 }
      );
    }

    const profileState = await resolveProfileState(request, authenticatedUserId);
    if (!profileState.availableProfiles.includes(targetProfileType)) {
      return NextResponse.json(
        { error: `This account cannot switch to the ${targetProfileType} profile.` },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Profile switched to ${targetProfileType}.`,
      activeProfile: targetProfileType,
      availableProfiles: profileState.availableProfiles,
      canSwitch: profileState.canSwitch,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Profile toggle error:", error);
    return NextResponse.json(
      { error: "Failed to toggle profile. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = String(searchParams.get("userId") || "").trim();
    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      return NextResponse.json(
        { error: "You can only inspect profile access for your own account." },
        { status: 403 }
      );
    }

    const profileState = await resolveProfileState(request, authenticatedUserId);
    return NextResponse.json({
      success: true,
      availableProfiles: profileState.availableProfiles,
      currentProfile: profileState.currentProfile,
      canSwitch: profileState.canSwitch,
    });
  } catch (error) {
    console.error("Profile info error:", error);
    return NextResponse.json(
      { error: "Failed to get profile information. Please try again." },
      { status: 500 }
    );
  }
}
