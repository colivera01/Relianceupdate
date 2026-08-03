import { NextRequest, NextResponse } from "next/server";
import {
  authorizationErrorResponse,
  requireRequestActor,
  type RequestActor,
} from "@/lib/request-actor";

type SwitchableProfile = "customer" | "vendor";

function normalizeProfile(value: unknown): SwitchableProfile | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "customer" || normalized === "vendor" ? normalized : null;
}

function resolveProfileState(request: NextRequest, actor: RequestActor) {
  if (actor.platformRoles.includes("ADMIN")) {
    return {
      availableProfiles: [] as SwitchableProfile[],
      currentProfile: null,
      canSwitch: false,
    };
  }

  const profileSet = new Set<SwitchableProfile>(["customer"]);
  if (actor.vendorMemberships.length > 0) {
    profileSet.add("vendor");
  }

  const orderedProfiles = (["customer", "vendor"] as const).filter((profile) =>
    profileSet.has(profile)
  );

  const searchParams = new URL(request.url).searchParams;
  const requestedCurrentProfile = normalizeProfile(searchParams.get("currentProfile"));
  let currentProfile: SwitchableProfile = "customer";

  if (requestedCurrentProfile && profileSet.has(requestedCurrentProfile)) {
    currentProfile = requestedCurrentProfile;
  }

  return {
    availableProfiles: orderedProfiles,
    currentProfile,
    canSwitch: orderedProfiles.length > 1,
  };
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRequestActor(request);

    const body = await request.json();
    const requestedUserId = String(body?.userId || "").trim();
    const targetProfileType = normalizeProfile(body?.targetProfileType);

    if (!targetProfileType) {
      return NextResponse.json(
        { error: 'Invalid profile type. Must be "customer" or "vendor".' },
        { status: 400 }
      );
    }

    if (requestedUserId && requestedUserId !== actor.userId) {
      return NextResponse.json(
        { error: "You can only switch profiles for your own account." },
        { status: 403 }
      );
    }

    const profileState = resolveProfileState(request, actor);
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
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Profile toggle error:", error);
    return NextResponse.json(
      { error: "Failed to toggle profile. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireRequestActor(request);

    const { searchParams } = new URL(request.url);
    const requestedUserId = String(searchParams.get("userId") || "").trim();
    if (requestedUserId && requestedUserId !== actor.userId) {
      return NextResponse.json(
        { error: "You can only inspect profile access for your own account." },
        { status: 403 }
      );
    }

    const profileState = resolveProfileState(request, actor);
    return NextResponse.json({
      success: true,
      availableProfiles: profileState.availableProfiles,
      currentProfile: profileState.currentProfile,
      canSwitch: profileState.canSwitch,
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Profile info error:", error);
    return NextResponse.json(
      { error: "Failed to get profile information. Please try again." },
      { status: 500 }
    );
  }
}
