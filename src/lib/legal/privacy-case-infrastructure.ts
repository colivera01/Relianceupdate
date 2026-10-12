import { randomUUID } from "crypto";

import {
  assertNoProtectedCredentialMaterial,
  legalEvidenceSha256,
  requireLegalEvidenceText,
  requireSha256,
  stableLegalEvidenceJson,
} from "./legal-evidence-core";

export const NEUTRAL_PRIVACY_CASE_EVENTS = [
  "CASE_CREATED",
  "CONTACT_RECEIVED",
  "IDENTITY_CONTEXT_RECORDED",
  "CORRESPONDENCE_RECORDED",
  "INTERNAL_NOTE_RECORDED",
  "REFERENCE_LINKED",
] as const;

export type NeutralPrivacyCaseEvent = (typeof NEUTRAL_PRIVACY_CASE_EVENTS)[number];

const DEFERRED_LEGAL_KEYS = [
  "appealdeadline",
  "approval",
  "approved",
  "denial",
  "denied",
  "entitlement",
  "jurisdiction",
  "legalldeadline",
  "legaldeadline",
  "statutorydeadline",
  "statutoryright",
];

function assertNeutralMetadata(value: unknown, path = "metadata"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNeutralMetadata(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (DEFERRED_LEGAL_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      throw new Error(`PRIVACY_CASE_SUBSTANTIVE_LEGAL_FIELD_DEFERRED:${path}.${key}`);
    }
    assertNeutralMetadata(item, `${path}.${key}`);
  }
}

export function createPrivacyCaseReferenceCode(): string {
  return `PRIV-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export function buildPrivacyCaseReferenceCandidate(input: {
  referenceCode?: string;
  intakeChannel: string;
  requesterPrincipalId?: string | null;
  requesterPrincipalHash?: string | null;
  requesterRole?: string | null;
  subjectPrincipalId?: string | null;
  intakeContext: Record<string, unknown>;
}) {
  assertNoProtectedCredentialMaterial(input.intakeContext, "intakeContext");
  assertNeutralMetadata(input.intakeContext, "intakeContext");
  return {
    referenceCode: String(input.referenceCode || createPrivacyCaseReferenceCode()).trim(),
    intakeChannel: requireLegalEvidenceText(input.intakeChannel, "intakeChannel").toUpperCase(),
    requesterPrincipalId: String(input.requesterPrincipalId || "").trim() || null,
    requesterPrincipalHash: input.requesterPrincipalHash
      ? requireSha256(input.requesterPrincipalHash, "requesterPrincipalHash")
      : null,
    requesterRole: String(input.requesterRole || "").trim().toUpperCase() || null,
    subjectPrincipalId: String(input.subjectPrincipalId || "").trim() || null,
    intakeContextHash: legalEvidenceSha256(input.intakeContext),
  };
}

export function buildPrivacyCaseEventCandidate(input: {
  caseId: string;
  eventType: NeutralPrivacyCaseEvent;
  actorPrincipalId?: string | null;
  actorRole?: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}) {
  if (!NEUTRAL_PRIVACY_CASE_EVENTS.includes(input.eventType)) {
    throw new Error("PRIVACY_CASE_EVENT_REQUIRES_FUTURE_POLICY_AUTHORIZATION");
  }
  assertNoProtectedCredentialMaterial(input.metadata, "metadata");
  assertNeutralMetadata(input.metadata, "metadata");
  const document = {
    caseId: requireLegalEvidenceText(input.caseId, "caseId"),
    eventType: input.eventType,
    actorPrincipalId: String(input.actorPrincipalId || "").trim() || null,
    actorRole: String(input.actorRole || "").trim().toUpperCase() || null,
    metadataJson: stableLegalEvidenceJson(input.metadata),
    occurredAt: input.occurredAt,
  };
  return { ...document, evidenceHash: legalEvidenceSha256(document) };
}
