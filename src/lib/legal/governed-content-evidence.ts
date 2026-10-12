import {
  assertNoProtectedCredentialMaterial,
  legalEvidenceSha256,
  requireLegalEvidenceText,
  requireSha256,
  stableLegalEvidenceJson,
} from "./legal-evidence-core";

export const GOVERNED_CONTENT_STATUSES = ["DRAFT", "PRODUCT_OWNER_APPROVED"] as const;
export type GovernedContentStatus = (typeof GOVERNED_CONTENT_STATUSES)[number];

export const GOVERNED_CONTENT_CLASSES = ["POLICY", "PUBLIC_CHOICE"] as const;
export type GovernedContentClass = (typeof GOVERNED_CONTENT_CLASSES)[number];

export type GovernedContentVersionLike = {
  id: string;
  contentKey: string;
  contentClass: string;
  audienceRole?: string | null;
  version: string;
  governanceStatus: string;
  contentSnapshot: string;
  contentHash: string;
};

export function buildGovernedContentVersionCandidate(input: {
  contentKey: string;
  contentClass: GovernedContentClass;
  audienceRole?: string | null;
  version: string;
  governanceStatus?: GovernedContentStatus;
  contentSnapshot: string;
  sourceRevision?: string | null;
  productOwnerApprovedByPrincipalId?: string | null;
  productOwnerApprovedAt?: Date | null;
  supersedesVersionId?: string | null;
}) {
  const governanceStatus = input.governanceStatus || "DRAFT";
  if (!GOVERNED_CONTENT_STATUSES.includes(governanceStatus)) {
    throw new Error("GOVERNED_CONTENT_STATUS_NOT_AUTHORIZED");
  }
  if (!GOVERNED_CONTENT_CLASSES.includes(input.contentClass)) {
    throw new Error("GOVERNED_CONTENT_CLASS_INVALID");
  }
  const contentSnapshot = String(input.contentSnapshot ?? "");
  if (!contentSnapshot.trim()) throw new Error("GOVERNED_CONTENT_SNAPSHOT_REQUIRED");
  const approver = String(input.productOwnerApprovedByPrincipalId || "").trim() || null;
  const approvedAt = input.productOwnerApprovedAt || null;
  if (governanceStatus === "DRAFT" && (approver || approvedAt)) {
    throw new Error("GOVERNED_CONTENT_DRAFT_CANNOT_HAVE_APPROVAL");
  }
  if (governanceStatus === "PRODUCT_OWNER_APPROVED" && (!approver || !approvedAt)) {
    throw new Error("GOVERNED_CONTENT_PRODUCT_OWNER_APPROVAL_REQUIRED");
  }
  return {
    contentKey: requireLegalEvidenceText(input.contentKey, "contentKey"),
    contentClass: input.contentClass,
    audienceRole: String(input.audienceRole || "").trim() || null,
    version: requireLegalEvidenceText(input.version, "version"),
    governanceStatus,
    contentSnapshot,
    contentHash: legalEvidenceSha256(contentSnapshot),
    sourceRevision: String(input.sourceRevision || "").trim() || null,
    productOwnerApprovedByPrincipalId: approver,
    productOwnerApprovedAt: approvedAt,
    supersedesVersionId: String(input.supersedesVersionId || "").trim() || null,
  };
}

export function assertGovernedContentVersionIntegrity(
  content: GovernedContentVersionLike,
  expectedClass?: GovernedContentClass,
): void {
  if (!GOVERNED_CONTENT_STATUSES.includes(content.governanceStatus as GovernedContentStatus)) {
    throw new Error("GOVERNED_CONTENT_STATUS_NOT_AUTHORIZED");
  }
  if (expectedClass && content.contentClass !== expectedClass) {
    throw new Error("GOVERNED_CONTENT_CLASS_MISMATCH");
  }
  if (legalEvidenceSha256(content.contentSnapshot) !== content.contentHash) {
    throw new Error("GOVERNED_CONTENT_HASH_MISMATCH");
  }
}

export function roleAssentChainKey(input: {
  actorPrincipalId: string;
  actorRole: string;
  contentKey: string;
  contextType: string;
  contextId: string;
}): string {
  return legalEvidenceSha256({
    actorPrincipalId: requireLegalEvidenceText(input.actorPrincipalId, "actorPrincipalId"),
    actorRole: requireLegalEvidenceText(input.actorRole, "actorRole").toUpperCase(),
    contentKey: requireLegalEvidenceText(input.contentKey, "contentKey"),
    contextType: requireLegalEvidenceText(input.contextType, "contextType").toUpperCase(),
    contextId: requireLegalEvidenceText(input.contextId, "contextId"),
  });
}

export function buildRoleAssentEvidenceCandidate(input: {
  content: GovernedContentVersionLike;
  actorPrincipalId: string;
  actorUserId?: string | null;
  actorRole: string;
  vendorId?: string | null;
  membershipId?: string | null;
  bookingId?: string | null;
  contextType: string;
  contextId: string;
  context: Record<string, unknown>;
  decision: "ASSENT" | "DECLINE";
  verificationMethod: string;
  verificationContext: Record<string, unknown>;
  sequence: number;
  supersedesEvidenceId?: string | null;
  requestId: string;
  request: Record<string, unknown>;
  decidedAt: Date;
}) {
  assertGovernedContentVersionIntegrity(input.content, "POLICY");
  assertNoProtectedCredentialMaterial(input.verificationContext, "verificationContext");
  assertNoProtectedCredentialMaterial(input.request, "request");
  if (input.decision !== "ASSENT" && input.decision !== "DECLINE") {
    throw new Error("ROLE_ASSENT_DECISION_INVALID");
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error("ROLE_ASSENT_SEQUENCE_INVALID");
  }
  const actorPrincipalId = requireLegalEvidenceText(input.actorPrincipalId, "actorPrincipalId");
  const actorRole = requireLegalEvidenceText(input.actorRole, "actorRole").toUpperCase();
  const contextType = requireLegalEvidenceText(input.contextType, "contextType").toUpperCase();
  const contextId = requireLegalEvidenceText(input.contextId, "contextId");
  const contextHash = legalEvidenceSha256(input.context);
  const chainKey = roleAssentChainKey({
    actorPrincipalId,
    actorRole,
    contentKey: input.content.contentKey,
    contextType,
    contextId,
  });
  const requestHash = legalEvidenceSha256(input.request);
  const document = {
    contentVersionId: input.content.id,
    actorPrincipalId,
    actorUserId: String(input.actorUserId || "").trim() || null,
    actorRole,
    vendorId: String(input.vendorId || "").trim() || null,
    membershipId: String(input.membershipId || "").trim() || null,
    bookingId: String(input.bookingId || "").trim() || null,
    contextType,
    contextId,
    contextHash,
    decision: input.decision,
    policyKey: input.content.contentKey,
    policyVersion: input.content.version,
    contentSnapshot: input.content.contentSnapshot,
    contentHash: input.content.contentHash,
    verificationMethod: requireLegalEvidenceText(input.verificationMethod, "verificationMethod"),
    verificationContextJson: stableLegalEvidenceJson(input.verificationContext),
    chainKey,
    sequence: input.sequence,
    supersedesEvidenceId: String(input.supersedesEvidenceId || "").trim() || null,
    requestId: requireLegalEvidenceText(input.requestId, "requestId"),
    requestHash,
    decidedAt: input.decidedAt,
  };
  return { ...document, evidenceHash: legalEvidenceSha256(document) };
}

export function buildPublicChoiceContentEvidenceCandidate(input: {
  content: GovernedContentVersionLike;
  bookingId: string;
  packageId: string;
  packageVersion: number;
  packageHash: string;
  stageSetHash: string;
  customerUserId: string;
  visibilityDecisionId?: string | null;
  choice: "SHARE_PUBLICLY" | "MAKE_PRIVATE";
  includesAudio: boolean;
  audioDisclosureIncluded: boolean;
  outsideCopyDisclosureIncluded: boolean;
  verificationMethod: string;
  verificationContext: Record<string, unknown>;
  requestId: string;
  request: Record<string, unknown>;
  recordedAt: Date;
}) {
  assertGovernedContentVersionIntegrity(input.content, "PUBLIC_CHOICE");
  assertNoProtectedCredentialMaterial(input.verificationContext, "verificationContext");
  assertNoProtectedCredentialMaterial(input.request, "request");
  if (input.choice !== "SHARE_PUBLICLY" && input.choice !== "MAKE_PRIVATE") {
    throw new Error("PUBLIC_CHOICE_DECISION_INVALID");
  }
  if (input.includesAudio && !input.audioDisclosureIncluded) {
    throw new Error("PUBLIC_CHOICE_AUDIO_DISCLOSURE_REQUIRED");
  }
  if (input.choice === "SHARE_PUBLICLY" && !input.outsideCopyDisclosureIncluded) {
    throw new Error("PUBLIC_CHOICE_OUTSIDE_COPY_DISCLOSURE_REQUIRED");
  }
  if (!Number.isInteger(input.packageVersion) || input.packageVersion < 1) {
    throw new Error("PUBLIC_CHOICE_PACKAGE_VERSION_INVALID");
  }
  const requestHash = legalEvidenceSha256(input.request);
  const document = {
    contentVersionId: input.content.id,
    bookingId: requireLegalEvidenceText(input.bookingId, "bookingId"),
    packageId: requireLegalEvidenceText(input.packageId, "packageId"),
    packageVersion: input.packageVersion,
    packageHash: requireSha256(input.packageHash, "packageHash"),
    stageSetHash: requireSha256(input.stageSetHash, "stageSetHash"),
    customerUserId: requireLegalEvidenceText(input.customerUserId, "customerUserId"),
    visibilityDecisionId: String(input.visibilityDecisionId || "").trim() || null,
    choice: input.choice,
    contentKey: input.content.contentKey,
    contentVersion: input.content.version,
    contentSnapshot: input.content.contentSnapshot,
    contentHash: input.content.contentHash,
    includesAudio: input.includesAudio,
    audioDisclosureIncluded: input.audioDisclosureIncluded,
    outsideCopyDisclosureIncluded: input.outsideCopyDisclosureIncluded,
    verificationMethod: requireLegalEvidenceText(input.verificationMethod, "verificationMethod"),
    verificationContextJson: stableLegalEvidenceJson(input.verificationContext),
    requestId: requireLegalEvidenceText(input.requestId, "requestId"),
    requestHash,
    recordedAt: input.recordedAt,
  };
  return { ...document, evidenceHash: legalEvidenceSha256(document) };
}
