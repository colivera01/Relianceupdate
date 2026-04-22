import { NextResponse } from "next/server";
import { resolveVendorAccessFromRequest } from "@/lib/vendor-context";

export async function GET(request: Request) {
  try {
    const context = await resolveVendorAccessFromRequest(request);

    if (!context) {
      return NextResponse.json(
        { success: false, code: "UNAUTHORIZED", message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (context.state === "PENDING") {
      return NextResponse.json(
        {
          success: false,
          code: "VENDOR_PENDING_APPROVAL",
          message: "Vendor account pending approval",
          context: {
            state: context.state,
            vendorId: context.vendorId,
            membershipId: context.membershipId,
            membershipStatus: context.membershipStatus,
          },
        },
        { status: 403 }
      );
    }
    if (context.state !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          code: "VENDOR_SESSION_CONTEXT_UNAVAILABLE",
          message: "Vendor session context unavailable. Please sign in again.",
          context: {
            state: context.state,
            vendorId: context.vendorId,
            membershipId: context.membershipId,
            membershipStatus: context.membershipStatus,
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      approved: true,
      vendorId: context.vendorId,
      membershipId: context.membershipId,
      role: context.role,
      businessName: context.businessName,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to resolve vendor context", details: error?.message },
      { status: 500 }
    );
  }
}
