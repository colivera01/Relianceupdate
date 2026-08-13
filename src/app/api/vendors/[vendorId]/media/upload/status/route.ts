import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { setUploadAttemptState } from "@/lib/service-video-evidence";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const assetId = String(body.assetId || "").trim();
    const bookingId = String(body.bookingId || "").trim();
    const requestedState = String(body.uploadState || "").trim().toUpperCase();
    if (!assetId || !bookingId || !["RETRY_REQUIRED", "REJECTED"].includes(requestedState)) {
      return NextResponse.json(
        { error: "assetId, bookingId, and a valid uploadState are required" },
        { status: 422 }
      );
    }

    const tokenAccess = await resolveEmployeeCaptureAccess(request, { vendorId, bookingId });
    const membership = tokenAccess || (await requireVendorMembership(request, vendorId));
    const attempt = await (prisma as any).mediaUploadAttempt.findFirst({
      where: {
        assetId,
        vendorId,
        bookingId,
        membershipId: membership.membershipId,
        state: { in: ["UPLOADING", "RETRY_REQUIRED"] },
      },
      select: { assetId: true, stage: true },
    });
    if (!attempt) {
      return NextResponse.json({ error: "Upload attempt not found" }, { status: 404 });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, vendorId },
      select: { id: true, customerMetadata: true },
    });
    if (!booking) return NextResponse.json({ error: "Work record not found" }, { status: 404 });
    const gate = await loadRecordingPermissionGate({
      bookingId,
      vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: membership.membershipId,
      surface: "upload_status",
      capability: "record",
      actorKind: tokenAccess ? "EMPLOYEE_LINK" : String((membership as any).role || "VENDOR_MEMBER"),
      recordingStage: String(attempt.stage || "").trim().toUpperCase(),
    });
    if (gate.blockCode) return NextResponse.json(recordingGateErrorBody(gate), { status: 409 });

    const state = requestedState as "RETRY_REQUIRED" | "REJECTED";
    await setUploadAttemptState({
      assetId,
      vendorId,
      state,
      failureCode: state === "REJECTED" ? "CLIENT_REJECTED" : "CLIENT_UPLOAD_FAILED",
      failureMessage:
        state === "REJECTED"
          ? "The client rejected the captured file before it was saved."
          : "The client reported that the upload did not finish.",
    });
    return NextResponse.json({ success: true, uploadState: state });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error?.name === "ServiceVideoMutationBlockedError") {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update upload status" }, { status: 500 });
  }
}
