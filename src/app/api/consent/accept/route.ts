import { NextRequest, NextResponse } from "next/server";

import { completePermissionDecision, PermissionDecisionError } from "@/lib/consent/decision-service";
import { PERMISSION_DECISION_COOKIE, permissionDecisionCookieOptions } from "@/lib/consent/decision-session";
import { findPermissionByActionSecret } from "@/lib/consent/lookup";
import { formatAddress, geocodeAddress, hasCompleteAddress } from "@/lib/geocoding";
import { sendConsentDecisionNotifications } from "@/lib/notifications/send-consent-decision";

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    if (!token) return NextResponse.json({ success: false, error: "Request is not available" }, { status: 400 });

    const link = await findPermissionByActionSecret(token);
    const metadata = parseMetadata(link?.consentRecord?.booking?.customerMetadata);
    const bookingMetadataPatch: Record<string, unknown> = {};
    if (String(metadata.vendor_job_recording_location || "").trim() === "customer-business") {
      const rawAddress = body?.customerBusinessAddress || {};
      const address = {
        address: String(rawAddress?.address || "").trim(),
        city: String(rawAddress?.city || "").trim(),
        state: String(rawAddress?.state || "").trim(),
        zipCode: String(rawAddress?.zipCode || "").trim(),
      };
      if (!hasCompleteAddress(address)) {
        return NextResponse.json(
          { success: false, code: "CUSTOMER_BUSINESS_ADDRESS_REQUIRED", error: "Enter the complete customer business address before allowing recording." },
          { status: 422 }
        );
      }
      const geocode = await geocodeAddress(address);
      if (geocode.status !== "success") {
        return NextResponse.json(
          { success: false, code: "CUSTOMER_BUSINESS_ADDRESS_NOT_VERIFIED", error: "We could not verify that business address. Check it and try again." },
          { status: 422 }
        );
      }
      Object.assign(bookingMetadataPatch, {
        vendor_job_customer_business_address: address.address,
        vendor_job_customer_business_city: address.city,
        vendor_job_customer_business_state: address.state,
        vendor_job_customer_business_zip_code: address.zipCode,
        vendor_job_customer_business_latitude: geocode.latitude,
        vendor_job_customer_business_longitude: geocode.longitude,
        vendor_job_customer_business_geocoded_at: geocode.geocodedAt.toISOString(),
        vendor_job_customer_business_formatted_address: geocode.formattedAddress || formatAddress(address),
        vendor_job_recording_location_snapshot: {
          type: "customer-business",
          source: "customer_supplied",
          status: "verified_coordinates",
          address: address.address,
          city: address.city,
          state: address.state,
          zip_code: address.zipCode,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          geocoded_at: geocode.geocodedAt.toISOString(),
          captured_at: new Date().toISOString(),
        },
      });
    }

    const result = await completePermissionDecision({
      request,
      actionSecret: token,
      decision: "allow",
      claimedRole: body?.claimedRole,
      authorityScope: body?.authorityScope,
      bookingMetadataPatch,
    });
    const notifications = await sendConsentDecisionNotifications({
      request,
      bookingId: result.bookingId,
      accepted: true,
      actorUserId: result.evidence.actorUserId || "verified-permission-recipient",
    }).catch((error) => {
      console.error("[permission/allow] decision notification failed", error);
      return null;
    });
    const response = NextResponse.json({
      success: true,
      permission: { state: "allowed", initialAudience: "private", audioEnabled: false },
      notifications,
    });
    response.cookies.set(PERMISSION_DECISION_COOKIE, "", { ...permissionDecisionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof PermissionDecisionError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    console.error("[permission/allow] POST failed", error);
    return NextResponse.json({ success: false, error: "Unable to save this recording decision" }, { status: 500 });
  }
}
