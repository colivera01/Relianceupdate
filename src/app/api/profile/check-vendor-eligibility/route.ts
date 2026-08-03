import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";

const VENDOR_REGISTRATION_REQUIREMENTS = [
  "Sign in to your Reliance account before starting vendor registration.",
  "Verify the email address on your Reliance account.",
  "Provide your business name and business type.",
  "Provide your business street address, city, state, and ZIP code.",
  "Choose at least one service for your vendor profile.",
  "Complete admin approval before the vendor account goes live.",
];

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserId = await getUserIdFromRequest(request).catch(() => null);
    const user = authenticatedUserId
      ? await prisma.user.findUnique({
          where: { id: authenticatedUserId },
          select: { id: true, email: true },
        })
      : null;
    const vendorAccess = user ? await resolveVendorAccessForUser(user.id).catch(() => null) : null;
    const credential = user ? await findDbCredentialByUserId(user.id).catch(() => null) : null;

    const existingVendorProfile =
      vendorAccess?.state === "ACTIVE" || vendorAccess?.state === "PENDING";
    const emailVerified = Boolean(credential?.emailVerifiedAt);
    const signInRequired = !authenticatedUserId;
    const canCreateVendor =
      Boolean(authenticatedUserId) && !existingVendorProfile && emailVerified;
    const canCreateVendorAfterSignIn =
      !existingVendorProfile && (user ? emailVerified : true);

    return NextResponse.json({
      success: true,
      canCreateVendor,
      canCreateVendorAfterSignIn,
      requirements: VENDOR_REGISTRATION_REQUIREMENTS,
      existingVendorProfile,
      existingVendorState: vendorAccess?.state || "NONE",
      emailVerified,
      signInRequired,
      existingUser: Boolean(user),
    });
  } catch (error) {
    console.error("Vendor eligibility check error:", error);
    return NextResponse.json(
      { error: "Failed to check vendor eligibility. Please try again." },
      { status: 500 }
    );
  }
}
