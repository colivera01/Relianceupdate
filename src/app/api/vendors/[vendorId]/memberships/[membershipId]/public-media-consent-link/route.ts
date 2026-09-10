import { NextResponse } from "next/server";

import {
  appendEmployeePublicMediaConsentToken,
  createEmployeePublicMediaConsentToken,
} from "@/lib/employee-public-media-consent-token";
import { requireVendorManager } from "@/lib/membership-auth";
import { sendEmployeePublicMediaConsentLinkNotification } from "@/lib/notifications/send-employee-public-media-consent-link";
import { prisma } from "@/server/db";

type RouteParams = { params: Promise<{ vendorId: string; membershipId: string }> };

function appBaseUrl(request: Request) {
  return String(process.env.APP_BASE_URL || new URL(request.url).origin).trim().replace(/\/+$/, "");
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { vendorId, membershipId } = await params;
    const manager = await requireVendorManager(request, vendorId);
    const membership = await (prisma as any).vendorMembership.findUnique({
      where: { id: membershipId },
      select: {
        id: true,
        vendorId: true,
        userId: true,
        role: true,
        status: true,
        user: { select: { name: true, email: true, phone: true } },
        vendor: { select: { name: true, businessName: true } },
      },
    });
    if (!membership || String(membership.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: "Employee membership not found" }, { status: 404 });
    }
    if (
      String(membership.role || "").trim().toUpperCase() !== "EMPLOYEE" ||
      String(membership.status || "").trim().toUpperCase() !== "ACTIVE"
    ) {
      return NextResponse.json({
        success: false,
        code: "ACTIVE_EMPLOYEE_MEMBERSHIP_REQUIRED",
        error: "Only an active Employee can receive a participation link.",
      }, { status: 422 });
    }
    if (!membership.user?.email && !membership.user?.phone) {
      return NextResponse.json({
        success: false,
        code: "EMPLOYEE_CONTACT_REQUIRED",
        error: "Add an email address or phone number before sending a participation link.",
      }, { status: 422 });
    }
    const token = createEmployeePublicMediaConsentToken({
      vendorId,
      membershipId: membership.id,
      userId: membership.userId,
    });
    const participationLink = appendEmployeePublicMediaConsentToken(
      `${appBaseUrl(request)}/employee/public-media-consent`,
      token,
    );
    const delivery = await sendEmployeePublicMediaConsentLinkNotification({
      membershipId: membership.id,
      actorUserId: manager.userId,
      employeeName: membership.user?.name,
      employeeEmail: membership.user?.email,
      employeePhone: membership.user?.phone,
      vendorName: membership.vendor?.businessName || membership.vendor?.name || "Reliance business",
      participationLink,
    });
    if (!delivery.anySuccess) {
      return NextResponse.json({
        success: false,
        code: "PARTICIPATION_LINK_DELIVERY_FAILED",
        error: "The secure participation link could not be delivered. Check the Employee contact details and configured delivery channels.",
        channels: delivery.channels,
      }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      message: "Secure participation link sent. The Employee must make their own choice.",
      channels: delivery.channels,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send participation link";
    const status = message === "Unauthorized" || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
