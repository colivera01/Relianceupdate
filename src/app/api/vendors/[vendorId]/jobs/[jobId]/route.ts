import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveOperationalClientLabel } from "@/lib/operational-client";
import { loadRecordingPermissionGate } from "@/lib/consent/recording-gate";
import { parseRecordingComplianceMetadata } from "@/lib/job-assignment";
import { resolveOperationalPhase } from "@/lib/vendor-job-operational-phase";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

function parseCustomerMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function extractAssignedEmployeesFromMetadata(value: string | null | undefined): string[] {
  const metadata = parseCustomerMetadata(value);
  const raw = metadata.vendor_job_assigned_employees;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || "").trim()).filter(Boolean);
}

function resolveJobSourceFromMetadata(value: string | null | undefined): "customer_booking" | "vendor_created_job" {
  const metadata = parseCustomerMetadata(value);
  const claimStatus = String(metadata.claim_status || "").trim().toUpperCase();
  const linkedFlag = metadata.customer_account_linked;
  const explicitSource = String(metadata.booking_source || metadata.source || "").trim().toLowerCase();
  if (explicitSource === "customer_booking") {
    return "customer_booking";
  }
  if (explicitSource === "vendor_created_job") {
    return "vendor_created_job";
  }
  if (claimStatus || typeof linkedFlag === "boolean") {
    return "vendor_created_job";
  }
  return "customer_booking";
}

function normalizeVendorJobStatus(status: string | null | undefined): string {
  const normalized = String(status || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "CONFIRMED") return "IN_PROGRESS";
  return normalized || "UNKNOWN";
}

export async function GET(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    const membership = await requireVendorMembership(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        customerMetadata: true,
        rejectionReason: true,
        rejectedAt: true,
        service: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Job not found for this vendor." },
        { status: 404 }
      );
    }

    const metadata = parseCustomerMetadata(booking.customerMetadata || null);
    const rawCancellation =
      metadata.vendor_job_cancellation &&
      typeof metadata.vendor_job_cancellation === "object" &&
      !Array.isArray(metadata.vendor_job_cancellation)
        ? (metadata.vendor_job_cancellation as Record<string, unknown>)
        : null;
    const canceledByUserId = String(rawCancellation?.canceled_by_user_id || "").trim();
    const cancellationActor =
      canceledByUserId && (prisma as any).user?.findUnique
        ? await (prisma as any).user.findUnique({
            where: { id: canceledByUserId },
            select: { name: true, email: true },
          })
        : null;
    const notes = String(metadata.user_notes || "").trim();
    const customerEmail =
      String(metadata.client_email || metadata.claim_contact_email || "").trim() ||
      (!String(booking.user?.email || "").trim().toLowerCase().endsWith("@reliance.local")
        ? String(booking.user?.email || "").trim()
        : "");
    const customerPhone =
      String(metadata.client_phone || metadata.claim_contact_phone || booking.user?.phone || "").trim();
    const client = resolveOperationalClientLabel({
      clientName: booking.clientName,
      userName: booking.user?.name,
    });
    const assignedEmployees = extractAssignedEmployeesFromMetadata(booking.customerMetadata);
    const recordingCompliance = parseRecordingComplianceMetadata(booking.customerMetadata);
    const permissionGate = await loadRecordingPermissionGate({
      bookingId: booking.id,
      vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: membership.membershipId,
      surface: "admin_evidence",
      capability: "observe",
      actorKind: membership.role === "MANAGER" ? "VENDOR_MANAGER" : "EMPLOYEE",
    });
    const operationalPhase = resolveOperationalPhase({
      bookingStatus: booking.status,
      customerMetadata: booking.customerMetadata,
      linkedMediaCount: 0,
      assignedEmployees,
    });

    return NextResponse.json({
      job: {
        id: booking.id,
        title: booking.title || booking.service?.name || "Untitled Job",
        client,
        customerEmail,
        customerPhone,
        status: normalizeVendorJobStatus(booking.status),
        source: resolveJobSourceFromMetadata(booking.customerMetadata),
        date: booking.date?.toISOString() || booking.createdAt.toISOString(),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt?.toISOString() || booking.createdAt.toISOString(),
        assignedEmployees,
        operationalPhase,
        recordingCompliance: {
          location: permissionGate.location,
          permissionRequired: permissionGate.permissionRequired,
          permissionStatus: permissionGate.permissionState,
          serviceOrderReleasedAt: recordingCompliance.serviceOrderReleasedAt,
        },
        serviceName: booking.service?.name || "",
        serviceType: booking.service?.name || "",
        rejectionReason: booking.rejectionReason || null,
        rejectedAt: booking.rejectedAt?.toISOString?.() || null,
        notes: notes ? [{ text: notes }] : [],
        cancellation: rawCancellation
          ? {
              reason: String(rawCancellation.reason || "").trim(),
              canceledAt: String(rawCancellation.canceled_at || "").trim() || null,
              canceledByUserId: canceledByUserId || null,
              canceledBy:
                String(cancellationActor?.name || cancellationActor?.email || "").trim() ||
                "Vendor manager",
            }
          : null,
      },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: "Failed to load vendor job detail",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
