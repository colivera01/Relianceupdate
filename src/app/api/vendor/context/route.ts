import { NextResponse } from "next/server";
import { getUserIdFromRequest, verifyJwt } from "@/lib/auth";
import {
  isVendorContextDbTimeoutError,
  resolveVendorAccessForUser,
} from "@/lib/vendor-context";

const DEV_BEARER_TOKENS = new Set(["temp-jwt-token", "temp-token"]);

function parseBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
}

function parseCookie(request: Request, keys: string[]): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  const parts = raw.split(";").map((part) => part.trim());
  for (const key of keys) {
    const prefix = `${key}=`;
    const match = parts.find((part) => part.startsWith(prefix));
    if (match) {
      const value = decodeURIComponent(match.slice(prefix.length)).trim();
      if (value) return value;
    }
  }
  return null;
}

async function getVendorIdHintFromRequest(request: Request): Promise<string | null> {
  const headerVendorId = request.headers.get("x-vendor-id")?.trim();
  if (headerVendorId) return headerVendorId;

  const token = parseBearerToken(request);
  if (token) {
    try {
      const payload = await verifyJwt(token);
      const jwtVendorId = String(payload?.vendorId || "").trim();
      if (jwtVendorId) return jwtVendorId;
    } catch {
      // Ignore malformed bearer token here; user resolution handles auth outcomes.
    }
  }

  return parseCookie(request, ["vendorId", "vendor_id", "vid", "session_vendor_id"]);
}

export async function GET(request: Request) {
  const isDev = process.env.NODE_ENV !== "production";
  const headerUserId = request.headers.get("x-user-id");
  const headerVendorId = request.headers.get("x-vendor-id");
  const bearerToken = parseBearerToken(request);

  if (isDev) {
    console.info("[api/vendor/context] request headers", {
      hasAuthorization: Boolean(bearerToken),
      hasCookie: Boolean(request.headers.get("cookie")),
      headerUserId: headerUserId || null,
      headerVendorId: headerVendorId || null,
    });
  }

  try {
    let resolvedUserId = await getUserIdFromRequest(request);
    if (!resolvedUserId && bearerToken && DEV_BEARER_TOKENS.has(bearerToken) && headerUserId) {
      resolvedUserId = headerUserId.trim();
    }

    const resolvedVendorId = await getVendorIdHintFromRequest(request);

    if (isDev) {
      console.info("[api/vendor/context] resolved context identifiers", {
        resolvedUserId: resolvedUserId || null,
        resolvedVendorId: resolvedVendorId || null,
      });
    }

    if (!resolvedUserId) {
      return NextResponse.json(
        {
          success: false,
          code: "VENDOR_CONTEXT_ERROR",
          message: "Missing user identity. Provide x-user-id or a valid Authorization bearer token.",
        },
        { status: 401 }
      );
    }

    const context = await resolveVendorAccessForUser(resolvedUserId, {
      preferredVendorId: resolvedVendorId,
    });

    if (isDev) {
      console.info("[api/vendor/context] membership lookup result", {
        state: context.state,
        membershipId: context.membershipId,
        membershipStatus: context.membershipStatus,
        membershipVendorId: context.vendorId,
        vendorExists: Boolean(context.businessName),
      });
    }

    if (context.state === "ACTIVE" && context.vendorId) {
      return NextResponse.json({
        success: true,
        approved: true,
        vendorId: context.vendorId,
        membershipId: context.membershipId,
        role: context.role,
        businessName: context.businessName,
      });
    }

    if (context.state === "ACTIVE" && !context.businessName) {
      return NextResponse.json(
        {
          success: false,
          code: "VENDOR_CONTEXT_ERROR",
          message: "Active membership found, but linked vendor record is missing.",
        },
        { status: 404 }
      );
    }

    if (context.state === "PENDING") {
      return NextResponse.json(
        {
          success: false,
          code: "VENDOR_PENDING_APPROVAL",
          message: "Vendor account pending approval",
          context: {
            state: "PENDING",
            vendorId: context.vendorId,
            membershipId: context.membershipId,
            membershipStatus: context.membershipStatus,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "NO_ACTIVE_VENDOR_MEMBERSHIP",
        message: "NO_ACTIVE_VENDOR_MEMBERSHIP",
      },
      { status: 403 }
    );
  } catch (error: any) {
    const dbFailure = isVendorContextDbTimeoutError(error);
    const message = dbFailure
      ? "Database connection failure while resolving vendor context."
      : String(error?.message || "Failed to resolve vendor context.");
    console.error("[api/vendor/context] GET error", {
      message,
      dbFailure,
      name: error?.name || null,
      code: error?.code || null,
    });
    return NextResponse.json(
      {
        success: false,
        code: dbFailure ? "DB_CONNECTION_TIMEOUT" : "VENDOR_CONTEXT_ERROR",
        message,
      },
      { status: dbFailure ? 503 : 500 }
    );
  }
}
