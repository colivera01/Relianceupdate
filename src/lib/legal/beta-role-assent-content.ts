import generated from "@/config/beta-role-assent-content.generated.json";
import { legalEvidenceSha256 } from "@/lib/legal/legal-evidence-core";

export const BETA_ROLE_ASSENT_FLAG = "LEGAL_ROLE_ASSENT_BETA_ENABLED" as const;

export type BetaRoleAssentContent = {
  sourceFile: string;
  contentKey: string;
  contentClass: "POLICY";
  audienceRole: "ALL_USERS" | "VENDOR" | "EMPLOYEE";
  version: string;
  sourceGovernanceStatus: "DRAFT";
  sourceRuntimeEffective: false;
  sourceCounselApproved: false;
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

const bundle = generated as {
  formatVersion: number;
  packageKey: string;
  packageSha256: string;
  authorizationScope: string;
  globallyEffective: false;
  counselApproved: false;
  generatedFromCommit: string;
  entries: BetaRoleAssentContent[];
};

export const BETA_ROLE_ASSENT_PACKAGE = bundle;
export const ROLE_ASSENT_CONTENT_KEYS = {
  TERMS: "reliance.terms-of-use",
  PRIVACY: "reliance.privacy-notice",
  VENDOR: "reliance.vendor-role-assent",
  EMPLOYEE: "reliance.employee-accountless-role-assent",
  MANAGER_WORK_RECORD_ATTESTATION: "reliance.manager-work-record-attestation",
} as const;

export function isBetaRoleAssentEnabled(): boolean {
  return String(process.env[BETA_ROLE_ASSENT_FLAG] || "")
    .trim()
    .toLowerCase() === "true";
}

export function betaRoleAssentContent(contentKey: string): BetaRoleAssentContent {
  const content = bundle.entries.find((entry) => entry.contentKey === contentKey);
  if (!content) throw new Error(`ROLE_ASSENT_CONTENT_MISSING:${contentKey}`);
  if (
    content.contentClass !== "POLICY" ||
    content.sourceGovernanceStatus !== "DRAFT" ||
    content.sourceRuntimeEffective ||
    content.sourceCounselApproved ||
    legalEvidenceSha256(content.contentSnapshot) !== content.contentHash
  ) {
    throw new Error(`ROLE_ASSENT_CONTENT_INTEGRITY_INVALID:${contentKey}`);
  }
  return content;
}

export function roleAssentContentSet(role: "VENDOR" | "EMPLOYEE") {
  return [
    betaRoleAssentContent(ROLE_ASSENT_CONTENT_KEYS.TERMS),
    betaRoleAssentContent(ROLE_ASSENT_CONTENT_KEYS.PRIVACY),
    betaRoleAssentContent(
      role === "VENDOR"
        ? ROLE_ASSENT_CONTENT_KEYS.VENDOR
        : ROLE_ASSENT_CONTENT_KEYS.EMPLOYEE,
    ),
  ];
}

export function roleAssentContentSetHash(role: "VENDOR" | "EMPLOYEE"): string {
  return legalEvidenceSha256(
    roleAssentContentSet(role).map(({ contentKey, version, contentHash }) => ({
      contentKey,
      version,
      contentHash,
    })),
  );
}

export function roleAssentPresentation(role: "VENDOR" | "EMPLOYEE") {
  return {
    packageKey: bundle.packageKey,
    packageSha256: bundle.packageSha256,
    authorizationScope: bundle.authorizationScope,
    globallyEffective: false as const,
    counselApproved: false as const,
    contentSetHash: roleAssentContentSetHash(role),
    content: roleAssentContentSet(role).map(
      ({ contentKey, version, contentHash, contentSnapshot, audienceRole }) => ({
        contentKey,
        version,
        contentHash,
        contentSnapshot,
        audienceRole,
      }),
    ),
  };
}

export function managerWorkRecordAttestationPresentation() {
  const content = betaRoleAssentContent(
    ROLE_ASSENT_CONTENT_KEYS.MANAGER_WORK_RECORD_ATTESTATION,
  );
  if (!content.presentation) {
    throw new Error("MANAGER_WORK_RECORD_ATTESTATION_PRESENTATION_MISSING");
  }
  return {
    packageKey: bundle.packageKey,
    packageSha256: bundle.packageSha256,
    contentSetHash: legalEvidenceSha256([
      {
        contentKey: content.contentKey,
        version: content.version,
        contentHash: content.contentHash,
      },
    ]),
    contentKey: content.contentKey,
    version: content.version,
    contentHash: content.contentHash,
    ...content.presentation,
  };
}
