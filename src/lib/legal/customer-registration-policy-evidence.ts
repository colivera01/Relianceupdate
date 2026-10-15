import { prisma } from "@/server/db";
import {
  BETA_ONBOARDING_CONTENT_KEYS,
  BETA_ONBOARDING_LEGAL_PACKAGE,
  betaOnboardingContentSet,
  betaOnboardingDocumentByKey,
} from "@/lib/legal/beta-onboarding-content";

type PolicyDefinition = {
  id: string;
  policyId: "TERMS" | "PRIVACY" | "SMS";
  version: string;
  effectiveAt: Date;
  contentSnapshot: string;
  contentHash: string;
  sourceRevision: string;
};

const POLICY_EFFECTIVE_AT = new Date("2026-10-14T00:00:00.000Z");

function policyId(value: string) {
  return `policy_${value.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}`;
}

function definePolicy(
  kind: PolicyDefinition["policyId"],
  contentKey: string,
): PolicyDefinition {
  const entry = betaOnboardingDocumentByKey(contentKey);
  return Object.freeze({
    id: policyId(entry.version),
    policyId: kind,
    version: entry.version,
    effectiveAt: POLICY_EFFECTIVE_AT,
    contentSnapshot: entry.contentSnapshot,
    contentHash: entry.contentHash,
    sourceRevision: BETA_ONBOARDING_LEGAL_PACKAGE.packageKey,
  });
}

export const CUSTOMER_REGISTRATION_POLICIES = Object.freeze({
  terms: definePolicy("TERMS", BETA_ONBOARDING_CONTENT_KEYS.TERMS),
  privacy: definePolicy("PRIVACY", BETA_ONBOARDING_CONTENT_KEYS.PRIVACY),
  sms: definePolicy("SMS", BETA_ONBOARDING_CONTENT_KEYS.SMS),
});

export const CUSTOMER_REGISTRATION_CONTENT_SET_HASH =
  betaOnboardingContentSet("customer").contentSetHash;

export function parseRegistrationBoolean(value: unknown) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

export function assertCurrentCustomerRegistrationContentSet(value: unknown) {
  if (String(value || "").trim() !== CUSTOMER_REGISTRATION_CONTENT_SET_HASH) {
    throw new Error("CUSTOMER_REGISTRATION_CONTENT_STALE");
  }
}

function getRequestIp(request: Request) {
  return String(
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
  )
    .split(",")[0]
    .trim()
    .slice(0, 255) || null;
}

async function ensurePolicyVersion(db: any, definition: PolicyDefinition) {
  const policy = await db.policyDocumentVersion.upsert({
    where: {
      policyId_version: {
        policyId: definition.policyId,
        version: definition.version,
      },
    },
    create: definition,
    update: {},
    select: { id: true, contentHash: true },
  });

  if (policy.contentHash !== definition.contentHash) {
    throw new Error(`POLICY_VERSION_HASH_MISMATCH:${definition.policyId}`);
  }
  return policy.id as string;
}

export async function recordCustomerRegistrationEvidence(input: {
  request: Request;
  userId: string;
  actorEmail: string;
  smsOptIn: boolean;
  displayedContentSetHash: string;
  registeredAt?: Date;
  db?: any;
}) {
  assertCurrentCustomerRegistrationContentSet(input.displayedContentSetHash);
  const registeredAt = input.registeredAt || new Date();
  const actorEmail = String(input.actorEmail || "").trim().toLowerCase();
  if (!input.userId || !actorEmail) {
    throw new Error("CUSTOMER_REGISTRATION_EVIDENCE_IDENTITY_REQUIRED");
  }

  const writeEvidence = async (tx: any) => {
    const [termsPolicyVersionId, privacyPolicyVersionId, smsPolicyVersionId] =
      await Promise.all([
        ensurePolicyVersion(tx, CUSTOMER_REGISTRATION_POLICIES.terms),
        ensurePolicyVersion(tx, CUSTOMER_REGISTRATION_POLICIES.privacy),
        ensurePolicyVersion(tx, CUSTOMER_REGISTRATION_POLICIES.sms),
      ]);

    return tx.customerRegistrationEvidence.create({
      data: {
        userId: input.userId,
        actorEmail,
        actorRole: "CUSTOMER",
        registeredAt,
        termsPolicyVersionId,
        privacyPolicyVersionId,
        smsPolicyVersionId,
        termsAcceptedAt: registeredAt,
        privacyAcknowledgedAt: registeredAt,
        smsOptIn: input.smsOptIn,
        smsDecisionAt: registeredAt,
        registrationIp: getRequestIp(input.request),
        userAgent:
          String(input.request.headers.get("user-agent") || "").slice(0, 1024) || null,
        verificationMethod: "EMAIL_VERIFICATION_LINK",
      },
    });
  };

  return input.db
    ? writeEvidence(input.db)
    : (prisma as any).$transaction(writeEvidence);
}

export async function markCustomerRegistrationEvidenceVerified(
  db: any,
  userId: string,
  verifiedAt: Date,
) {
  if (!db?.customerRegistrationEvidence?.updateMany || !userId) return;

  await db.customerRegistrationEvidence.updateMany({
    where: {
      userId,
      verificationMethod: "EMAIL_VERIFICATION_LINK",
      verificationCompletedAt: null,
    },
    data: { verificationCompletedAt: verifiedAt },
  });
}
