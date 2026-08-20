import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { readPermissionDecisionCookie } from "./decision-session";
import { actionLinkAvailability, findPermissionByActionSecret } from "./lookup";
import { hashOpaqueSecret } from "./token";
import {
  AUTHORITY_ROLE_SCOPES,
  buildStoredAuthorityEvidence,
  evaluatePermissionAuthority,
  type AuthorityValidationResult,
} from "./authority-validation";
import { isSimplifiedV1PermissionVersion } from "./content-version";
import { cancelSimplifiedV1WorkRecordAfterDecline } from "./decline-cancellation";

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

function authorityDecisionError(validation: AuthorityValidationResult) {
  if (validation.code === "AUTHORITY_MISMATCH") {
    return new PermissionDecisionError(
      "AUTHORITY_MISMATCH",
      422,
      "This role does not match the decision-maker required for this recording request.",
    );
  }
  if (
    validation.code === "CLAIMED_AUTHORITY_UNSUPPORTED" ||
    validation.code === "AUTHORITY_SCOPE_INVALID"
  ) {
    return new PermissionDecisionError(
      "AUTHORITY_REQUIRED",
      422,
      "Confirm the required role and authority before deciding.",
    );
  }
  return new PermissionDecisionError(
    "AUTHORITY_VERIFICATION_REQUIRED",
    409,
    "Reliance cannot verify the authority required for this request. Recording remains locked; contact the service provider.",
  );
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
  if (
    !Object.prototype.hasOwnProperty.call(AUTHORITY_ROLE_SCOPES, claimedRole) ||
    AUTHORITY_ROLE_SCOPES[claimedRole as keyof typeof AUTHORITY_ROLE_SCOPES] !== authorityScope
  ) {
    throw new PermissionDecisionError("AUTHORITY_REQUIRED", 422, "Confirm your role and authority before deciding.");
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
  const simplifiedV1 = isSimplifiedV1PermissionVersion(contentVersion);
  if (!record.scopeHash || !contentHash || !contentVersion) {
    throw new PermissionDecisionError("PERMISSION_EVIDENCE_INCOMPLETE", 409, "This request must be reissued before recording can be allowed.");
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const currentRecord = await (tx as any).consentRecord.findFirst({
      where: {
        id: record.id,
        bookingId: record.bookingId,
        vendorId: record.vendorId,
        generation: record.generation,
        isCurrent: true,
        verifiedDecision: false,
      },
      select: {
        id: true,
        scopeHash: true,
        decisionEvidence: { select: { id: true } },
      },
    });
    if (
      !currentRecord ||
      currentRecord.decisionEvidence ||
      String(currentRecord.scopeHash || "") !== String(record.scopeHash || "")
    ) {
      throw new PermissionDecisionError(
        "PERMISSION_NOT_AVAILABLE",
        409,
        "This recording request is no longer current.",
      );
    }
    const assessment = await (tx as any).recordingScopeAssessment.findFirst({
      where: {
        bookingId: record.bookingId,
        vendorId: record.vendorId,
        isCurrent: true,
        status: "COMPLETE",
        scopeHash: record.scopeHash,
      },
      orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
      select: {
        id: true,
        generation: true,
        authorityHolderType: true,
        locationType: true,
        scopeHash: true,
      },
    });
    const authorityValidation = evaluatePermissionAuthority({
      assessment,
      claimedRole,
      authorityScope,
      verificationMethod: session.verificationMethod,
      verifiedContactHash: session.verifiedContactHash,
    });
    if (!authorityValidation.ok || !assessment) {
      throw authorityDecisionError(authorityValidation);
    }
    const authorityEvidence = buildStoredAuthorityEvidence({
      assessment,
      validation: authorityValidation,
    });
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
        metadata: JSON.stringify({
          audioEnabled: false,
          initialAudience: "private",
          authority: authorityEvidence,
        }),
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
    const authorityModel = (tx as any).recordingAuthorityRequirement;
    if (assessment && authorityModel?.updateMany) {
      // New simplified-V1 assessments use CUSTOMER. Retain the historical
      // identifier so older requests can still record their original evidence.
      const authorityTypes = ["CUSTOMER", "CUSTOMER_OR_REPRESENTATIVE"];
      if (claimedRole === "customer") authorityTypes.push("CUSTOMER_LIKENESS");
      await authorityModel.updateMany({
        where: {
          assessmentId: assessment.id,
          authorityType: { in: authorityTypes },
        },
        data: accepted
          ? {
              status: "VERIFIED",
              actorUserId: actorUserId || null,
              evidenceReference: evidence.id,
              verifiedAt: decidedAt,
            }
          : {
              status: "DECLINED",
              actorUserId: actorUserId || null,
              evidenceReference: evidence.id,
              verifiedAt: decidedAt,
            },
      });
    }
    await (tx as any).consentRequestLink.updateMany({
      where: { consentRecordId: record.id, revokedAt: null },
      data: {
        revokedAt: decidedAt,
        revocationReason:
          !accepted && simplifiedV1
            ? "CUSTOMER_RECORDING_PERMISSION_DECLINED"
            : "decision_recorded",
      },
    });
    const permissionMetadata: Record<string, unknown> = {
      vendor_job_consent_record_id: record.id,
      vendor_job_consent_accepted: accepted,
      vendor_job_consent_status: accepted ? "accepted" : "declined",
      vendor_job_consent_verified: true,
      vendor_job_consent_decided_at: decidedAt.toISOString(),
      vendor_job_customer_visibility_choice: "private",
      ...(input.bookingMetadataPatch || {}),
    };
    let cancellation = null;
    if (!accepted && simplifiedV1) {
      cancellation = await cancelSimplifiedV1WorkRecordAfterDecline({
        tx,
        bookingId: record.bookingId,
        vendorId: record.vendorId,
        consentRecordId: record.id,
        actorUserId: actorUserId || null,
        evidenceId: evidence.id,
        decidedAt,
        permissionMetadata,
      });
    } else {
      const currentMetadata = {
        ...parseMetadata(record.booking.customerMetadata),
        ...permissionMetadata,
      };
      delete currentMetadata.vendor_job_consent_token;
      if (!accepted) {
        delete currentMetadata.vendor_job_service_order_released_membership_ids;
        delete currentMetadata.vendor_job_service_order_released_at;
      }
      await tx.booking.update({
        where: { id: record.bookingId },
        data: { customerMetadata: JSON.stringify(currentMetadata) },
      });
    }
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
          expectedAuthority: authorityEvidence.expectedAuthority,
          claimedAuthority: authorityEvidence.claimedAuthority,
          authorityMatched: authorityEvidence.expectedAndClaimedMatch,
          authorityVerificationBasis: authorityEvidence.authorityVerificationBasis,
          authorityEvidenceSchemaVersion: authorityEvidence.schemaVersion,
          initialAudience: "private",
          simplifiedV1,
          workRecordCanceled: Boolean(cancellation),
        }),
      },
    });
    return { record: updatedRecord, evidence, cancellation };
    }, { isolationLevel: "Serializable" as any });
  } catch (error: any) {
    if (String(error?.code || "") === "P2002") {
      throw new PermissionDecisionError(
        "PERMISSION_ALREADY_DECIDED",
        409,
        "A final recording permission decision has already been recorded."
      );
    }
    if (String(error?.message || "") === "DECLINE_CANCELLATION_STATE_CHANGED") {
      throw new PermissionDecisionError(
        "PERMISSION_NOT_AVAILABLE",
        409,
        "This recording request is no longer available because the Reliance work record changed."
      );
    }
    throw error;
  }
  return {
    ...result,
    bookingId: record.bookingId,
    accepted: input.decision === "allow",
    simplifiedV1,
    workRecordCanceled: Boolean(result.cancellation),
  };
}
