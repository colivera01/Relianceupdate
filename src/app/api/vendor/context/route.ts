import { NextResponse } from "next/server";
import {
  isVendorContextDbTimeoutError,
  resolveVendorAccessForUser,
} from "@/lib/vendor-context";
import { getRestrictedAccountMessage } from "@/lib/account-status";
import {
  authorizationErrorResponse,
  requireRequestActor,
} from "@/lib/request-actor";

function getVendorIdHintFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const queryVendorId = String(url.searchParams.get("vendorId") || "").trim();
  if (queryVendorId) return queryVendorId;
  if (process.env.NODE_ENV !== "production") {
    return String(request.headers.get("x-vendor-id") || "").trim() || null;
  }
  return null;
}

export async function GET(request: Request) {
  const isDev = process.env.NODE_ENV !== "production";
  const headerUserId = request.headers.get("x-user-id");
  const headerVendorId = request.headers.get("x-vendor-id");
  if (isDev) {
    console.info("[api/vendor/context] request headers", {
      hasAuthorization: Boolean(request.headers.get("authorization")),
      hasCookie: Boolean(request.headers.get("cookie")),
      headerUserId: headerUserId || null,
      headerVendorId: headerVendorId || null,
    });
  }

  try {
    const actor = await requireRequestActor(request);
    if (actor.platformRoles.includes("ADMIN")) {
      return NextResponse.json(
        { success: false, code: "ADMIN_ONLY_ACCOUNT", message: "Admin accounts cannot open vendor workspaces." },
        { status: 403 }
      );
    }
    const requestedVendorId = getVendorIdHintFromRequest(request);
    const resolvedVendorId = requestedVendorId ||
      (actor.vendorMemberships.length === 1 ? actor.vendorMemberships[0].vendorId : null);

    if (isDev) {
      console.info("[api/vendor/context] resolved context identifiers", {
        resolvedUserId: actor.userId,
        resolvedVendorId: resolvedVendorId || null,
      });
    }

    if (!resolvedVendorId) {
      return NextResponse.json(
        {
          success: false,
          code: "VENDOR_CONTEXT_REQUIRED",
          message: "Choose a business workspace to continue.",
        },
        { status: 400 }
      );
    }

    const context = await resolveVendorAccessForUser(actor.userId, {
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

    if (context.state === "RESTRICTED") {
      const accountType = context.restrictedAccountType || "vendor";
      const message = getRestrictedAccountMessage(accountType, context.accountStatus);
      return NextResponse.json(
        {
          success: false,
          code: `${accountType.toUpperCase()}_ACCOUNT_RESTRICTED`,
          message,
          context: {
            state: "RESTRICTED",
            accountType,
            accountStatus: context.accountStatus,
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
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse as NextResponse;
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
