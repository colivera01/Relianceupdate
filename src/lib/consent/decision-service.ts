import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { readPermissionDecisionCookie } from "./decision-session";
import { actionLinkAvailability, findPermissionByActionSecret } from "./lookup";
import { hashOpaqueSecret } from "./token";

const AUTHORITY_ROLE_SCOPES = new Map([
  ["customer", "self_and_property"],
  ["authorized_representative", "authorized_location_and_property"],
  ["customer_business_representative", "business_location_and_property"],
  ["guardian", "guardian_for_minor"],
]);

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export class PermissionDecisionError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export async function completePermissionDecision(input: {
  request: Request;
  actionSecret: string;
  decision: "allow" | "decline";
  claimedRole: string;
  authorityScope: string;
  bookingMetadataPatch?: Record<string, unknown>;
}) {
  const link = await findPermissionByActionSecret(input.actionSecret);
  const availability = actionLinkAvailability(link);
  if (!availability.active) {
    throw new PermissionDecisionError("PERMISSION_NOT_AVAILABLE", 409, "This recording request is no longer available.");
  }
  const claimedRole = String(input.claimedRole || "").trim().toLowerCase();
  const authorityScope = String(input.authorityScope || "").trim().toLowerCase();
  if (AUTHORITY_ROLE_SCOPES.get(claimedRole) !== authorityScope) {
    throw new PermissionDecisionError("AUTHORITY_REQUIRED", 422, "Confirm your role and authority before deciding.");
  }
  if (input.decision === "allow" && claimedRole === "guardian") {
    throw new PermissionDecisionError(
      "MINOR_RECORDING_NOT_AVAILABLE",
      422,
      "Reliance recording involving a minor is not available in this beta workflow."
    );
  }

  const decisionSecret = readPermissionDecisionCookie(input.request);
  if (!decisionSecret) {
    throw new PermissionDecisionError("IDENTITY_VERIFICATION_REQUIRED", 401, "Verify your identity before deciding.");
  }
  const session = await (prisma as any).consentDecisionSession.findUnique({
    where: { secretHash: hashOpaqueSecret(decisionSecret) },
  });
  if (
    !session ||
    session.consentRecordId !== link.consentRecordId ||
    session.consumedAt ||
    new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    throw new PermissionDecisionError("IDENTITY_VERIFICATION_REQUIRED", 401, "Verify your identity before deciding.");
  }

  const record = link.consentRecord;
  const decidedAt = new Date();
  const actorUserId = session.verifiedUserId || (await getUserIdFromRequest(input.request));
  const ipAddress = String(input.request.headers.get("x-forwarded-for") || input.request.headers.get("x-real-ip") || "")
    .split(",")[0]
    .trim()
    .slice(0, 255) || null;
  const userAgent = String(input.request.headers.get("user-agent") || "").slice(0, 1024) || null;
  const requestHash = hashOpaqueSecret(`${record.id}:${record.generation}:${link.secretHash}`);
  const contentHash = String(record.contentVersion?.contentHash || "");
  const contentVersion = String(record.contentVersion?.version || "");
  if (!record.scopeHash || !contentHash || !contentVersion) {
    throw new PermissionDecisionError("PERMISSION_EVIDENCE_INCOMPLETE", 409, "This request must be reissued before recording can be allowed.");
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const consumed = await (tx as any).consentDecisionSession.updateMany({
      where: { id: session.id, consumedAt: null, expiresAt: { gt: decidedAt } },
      data: { consumedAt: decidedAt },
    });
    if (Number(consumed.count || 0) !== 1) {
      throw new PermissionDecisionError("DECISION_SESSION_USED", 409, "This verification session was already used.");
    }
    const evidence = await (tx as any).consentDecisionEvidence.create({
      data: {
        consentRecordId: record.id,
        decision: input.decision === "allow" ? "ALLOWED" : "DECLINED",
        actorUserId: actorUserId || null,
        claimedRole,
        authorityScope,
        verificationMethod: session.verificationMethod,
        verifiedContactHash: session.verifiedContactHash || null,
        requestHash,
        scopeHash: record.scopeHash,
        contentHash,
        contentVersion,
        ipAddress,
        userAgent,
        metadata: JSON.stringify({ audioEnabled: false, initialAudience: "private" }),
        decidedAt,
      },
    });
    const accepted = input.decision === "allow";
    const updatedRecord = await (tx as any).consentRecord.update({
      where: { id: record.id },
      data: {
        status: accepted ? "accepted" : "declined",
        lifecycleStatus: accepted ? "ALLOWED" : "DECLINED",
        verifiedDecision: true,
        acceptedAt: accepted ? decidedAt : null,
        declinedAt: accepted ? null : decidedAt,
        ipAddress,
        userAgent,
        documentHash: contentHash,
      },
    });
    await (tx as any).consentRequestLink.updateMany({
      where: { consentRecordId: record.id, revokedAt: null },
      data: { revokedAt: decidedAt, revocationReason: "decision_recorded" },
    });
    const currentMetadata = parseMetadata(record.booking.customerMetadata);
    delete currentMetadata.vendor_job_consent_token;
    currentMetadata.vendor_job_consent_record_id = record.id;
    currentMetadata.vendor_job_consent_accepted = accepted;
    currentMetadata.vendor_job_consent_status = accepted ? "accepted" : "declined";
    currentMetadata.vendor_job_consent_verified = true;
    currentMetadata.vendor_job_consent_decided_at = decidedAt.toISOString();
    currentMetadata.vendor_job_customer_visibility_choice = "private";
    Object.assign(currentMetadata, input.bookingMetadataPatch || {});
    if (!accepted) {
      delete currentMetadata.vendor_job_service_order_released_membership_ids;
      delete currentMetadata.vendor_job_service_order_released_at;
    }
    await tx.booking.update({ where: { id: record.bookingId }, data: { customerMetadata: JSON.stringify(currentMetadata) } });
    await (tx as any).consentEvent.create({
      data: {
        consentRecordId: record.id,
        eventType: accepted ? "allowed" : "declined",
        metadata: JSON.stringify({
          evidenceId: evidence.id,
          verificationMethod: session.verificationMethod,
          claimedRole,
          authorityScope,
          contentVersion,
          scopeHash: record.scopeHash,
          initialAudience: "private",
        }),
      },
    });
    return { record: updatedRecord, evidence };
    });
  } catch (error: any) {
    if (String(error?.code || "") === "P2002") {
      throw new PermissionDecisionError(
        "PERMISSION_ALREADY_DECIDED",
        409,
        "A final recording permission decision has already been recorded."
      );
    }
    throw error;
  }
  return { ...result, bookingId: record.bookingId, accepted: input.decision === "allow" };
}
