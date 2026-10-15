import generated from "@/config/beta-onboarding-legal-content.generated.json";
import { legalEvidenceSha256 } from "@/lib/legal/legal-evidence-core";

export type BetaOnboardingDocumentId =
  | "terms"
  | "privacy"
  | "sms"
  | "vendor-organization"
  | "employee-service-order"
  | "manager-work-record-attestation";

export type BetaOnboardingContent = {
  documentId: BetaOnboardingDocumentId;
  sourceFile: string;
  predecessorVersion: string;
  predecessorContentHash: string;
  contentKey: string;
  contentClass: "POLICY";
  audienceRole: "ALL_USERS" | "VENDOR" | "EMPLOYEE";
  version: string;
  governanceStatus: "PRODUCT_OWNER_APPROVED";
  globallyEffective: false;
  counselApproved: false;
  authorizationReference: string;
  contentSnapshot: string;
  contentHash: string;
  presentation?: {
    title: string;
    attestationText: string;
    confirmationText: string;
    disclaimerText: string;
    actionLabel: string;
  };
};

type ContentSet = {
  documentIds: BetaOnboardingDocumentId[];
  contentSetHash: string;
};

const bundle = generated as {
  formatVersion: number;
  packageKey: string;
  packageSha256: string;
  authorizationReference: string;
  authorizationScope: string;
  globallyEffective: false;
  counselApproved: false;
  canonicalSupportEmail: string;
  vendorAcknowledgements: Array<{ key: string; label: string }>;
  contentSets: {
    customer: ContentSet;
    vendor: ContentSet;
    employee: ContentSet;
  };
  entries: BetaOnboardingContent[];
};

export const BETA_ONBOARDING_LEGAL_PACKAGE = bundle;
export const BETA_ONBOARDING_CONTENT_KEYS = {
  TERMS: "reliance.terms-of-use",
  PRIVACY: "reliance.privacy-notice",
  SMS: "reliance.transactional-sms-notice",
  VENDOR: "reliance.vendor-role-assent",
  EMPLOYEE: "reliance.employee-accountless-role-assent",
} as const;

export const BETA_ONBOARDING_DOCUMENT_LABELS: Record<BetaOnboardingDocumentId, string> = {
  terms: "Reliance Terms of Use",
  privacy: "Reliance Privacy Notice",
  sms: "Reliance Transactional SMS Notice",
  "vendor-organization": "Vendor Organization Agreement",
  "employee-service-order": "Accountless Employee Service Order Notice",
  "manager-work-record-attestation": "Manager Work Record Attestation",
};

export function betaOnboardingDocument(documentId: string): BetaOnboardingContent {
  const entry = bundle.entries.find((candidate) => candidate.documentId === documentId);
  if (
    !entry ||
    entry.contentClass !== "POLICY" ||
    entry.governanceStatus !== "PRODUCT_OWNER_APPROVED" ||
    entry.globallyEffective ||
    entry.counselApproved ||
    legalEvidenceSha256(entry.contentSnapshot) !== entry.contentHash
  ) {
    throw new Error(`BETA_ONBOARDING_CONTENT_INVALID:${documentId}`);
  }
  return entry;
}

export function betaOnboardingDocumentByKey(contentKey: string): BetaOnboardingContent {
  const entry = bundle.entries.find((candidate) => candidate.contentKey === contentKey);
  if (!entry) throw new Error(`BETA_ONBOARDING_CONTENT_MISSING:${contentKey}`);
  return betaOnboardingDocument(entry.documentId);
}

export function betaOnboardingContentSet(role: "customer" | "vendor" | "employee") {
  return bundle.contentSets[role];
}
