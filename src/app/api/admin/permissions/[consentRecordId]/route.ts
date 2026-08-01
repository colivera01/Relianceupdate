import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { parseRedactedPermissionMetadata } from "@/lib/consent/admin-view";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ consentRecordId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { consentRecordId } = await context.params;
    const record = await (prisma as any).consentRecord.findUnique({
      where: { id: consentRecordId },
      include: {
        vendor: { select: { id: true, name: true, businessName: true } },
        booking: { select: { id: true, title: true, service: { select: { name: true } } } },
        contentVersion: { select: { version: true, contentHash: true, scopeSchemaVersion: true } },
        decisionEvidence: {
          select: {
            id: true,
            decision: true,
            actorUserId: true,
            claimedRole: true,
            authorityScope: true,
            verificationMethod: true,
            requestHash: true,
            scopeHash: true,
            contentHash: true,
            contentVersion: true,
            ipAddress: true,
            userAgent: true,
            metadata: true,
            decidedAt: true,
          },
        },
        events: { orderBy: { createdAt: "asc" } },
        requestLinks: {
          orderBy: { generation: "asc" },
          select: { id: true, generation: true, expiresAt: true, revokedAt: true, revocationReason: true, lastViewedAt: true, createdAt: true },
        },
      },
    });
    if (!record) {
      return NextResponse.json({ success: false, error: "Permission record not found" }, { status: 404 });
    }
    const notificationAttempts = await (prisma as any).bookingNotificationAttempt.findMany({
      where: { consentRecordId: record.id },
      orderBy: { attemptedAt: "asc" },
      select: {
        id: true,
        channel: true,
        destinationMasked: true,
        status: true,
        attemptNumber: true,
        providerMessageId: true,
        errorCode: true,
        errorMessage: true,
        attemptedAt: true,
      },
    });
    return NextResponse.json({
      success: true,
      permission: {
        id: record.id,
        bookingId: record.bookingId,
        vendorId: record.vendorId,
        lifecycleStatus: record.lifecycleStatus,
        verifiedDecision: record.verifiedDecision,
        legacyEvidence: record.legacyEvidence,
        generation: record.generation,
        recipient: {
          name: record.recipientName,
          email: record.recipientEmailMasked,
          phone: record.recipientPhoneMasked,
          mismatch: record.recipientMismatch,
        },
        audioEnabled: record.audioEnabled,
        scopeHash: record.scopeHash,
        requestedAt: record.requestedAt,
        acceptedAt: record.acceptedAt,
        declinedAt: record.declinedAt,
        expiresAt: record.expiresAt,
        vendor: record.vendor,
        booking: record.booking,
        contentVersion: record.contentVersion,
        decisionEvidence: record.decisionEvidence
          ? {
              ...record.decisionEvidence,
              metadata: parseRedactedPermissionMetadata(record.decisionEvidence.metadata),
            }
          : null,
        events: record.events.map((event: any) => ({
          id: event.id,
          eventType: event.eventType,
          createdAt: event.createdAt,
          metadata: parseRedactedPermissionMetadata(event.metadata),
        })),
        requestLinks: record.requestLinks,
        notificationAttempts,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load permission evidence";
    const status = message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
