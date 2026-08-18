export const AUTHORITY_EVIDENCE_SCHEMA_VERSION = "recording-authority-evidence-v1";

export const AUTHORITY_ROLE_SCOPES = {
  customer: "self_and_property",
  authorized_representative: "authorized_location_and_property",
  customer_business_representative: "business_location_and_property",
  guardian: "guardian_for_minor",
} as const;

export type ExpectedRecordingAuthority =
  | "customer"
  | "authorized_representative"
  | "guardian"
  | "vendor_manager";

export type ClaimedPermissionAuthority = keyof typeof AUTHORITY_ROLE_SCOPES;

export type AuthorityValidationCode =
  | "AUTHORITY_VERIFIED"
  | "EXPECTED_AUTHORITY_MISSING"
  | "CLAIMED_AUTHORITY_UNSUPPORTED"
  | "AUTHORITY_SCOPE_INVALID"
  | "AUTHORITY_MISMATCH"
  | "IDENTITY_EVIDENCE_MISSING"
  | "AUTHORITY_VERIFICATION_REQUIRED"
  | "CUSTOMER_PERMISSION_NOT_APPLICABLE";

export type PermissionAuthorityAssessment = {
  id?: string | null;
  generation?: number | null;
  authorityHolderType?: string | null;
  locationType?: string | null;
  scopeHash?: string | null;
};

export type AuthorityValidationResult = {
  ok: boolean;
  code: AuthorityValidationCode;
  expectedAuthority: ExpectedRecordingAuthority | null;
  expectedClaimedRole: ClaimedPermissionAuthority | null;
  claimedAuthority: ClaimedPermissionAuthority | null;
  authorityScope: string;
  expectedAndClaimedMatch: boolean;
  identityVerificationBasis: string | null;
  authorityVerificationBasis: string | null;
  substitutionRule: null;
};

export type StoredAuthorityEvidence = {
  schemaVersion: typeof AUTHORITY_EVIDENCE_SCHEMA_VERSION;
  assessmentId: string;
  assessmentGeneration: number;
  scopeHash: string;
  expectedAuthority: ExpectedRecordingAuthority;
  expectedClaimedRole: ClaimedPermissionAuthority;
  claimedAuthority: ClaimedPermissionAuthority;
  authorityScope: string;
  expectedAndClaimedMatch: true;
  identityVerificationBasis: string;
  authorityVerificationBasis: string;
  authorityVerified: true;
  substitutionRule: null;
};

const VERIFIED_IDENTITY_METHODS = new Set([
  "logged_in_account",
  "email_otp",
  "sms_otp",
]);

function normalizeExpectedAuthority(value: unknown): ExpectedRecordingAuthority | null {
  const normalized = String(value || "").trim().toLowerCase();
  return ["customer", "authorized_representative", "guardian", "vendor_manager"].includes(
    normalized,
  )
    ? (normalized as ExpectedRecordingAuthority)
    : null;
}

function normalizeClaimedAuthority(value: unknown): ClaimedPermissionAuthority | null {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(AUTHORITY_ROLE_SCOPES, normalized)
    ? (normalized as ClaimedPermissionAuthority)
    : null;
}

export function expectedClaimedRoleForAssessment(
  assessment: PermissionAuthorityAssessment | null | undefined,
): ClaimedPermissionAuthority | null {
  const expectedAuthority = normalizeExpectedAuthority(assessment?.authorityHolderType);
  if (expectedAuthority === "customer") return "customer";
  if (expectedAuthority === "guardian") return "guardian";
  if (expectedAuthority === "authorized_representative") {
    return String(assessment?.locationType || "").trim().toLowerCase() === "customer-business"
      ? "customer_business_representative"
      : "authorized_representative";
  }
  return null;
}

export function evaluatePermissionAuthority(input: {
  assessment: PermissionAuthorityAssessment | null | undefined;
  claimedRole: unknown;
  authorityScope: unknown;
  verificationMethod: unknown;
  verifiedContactHash: unknown;
}): AuthorityValidationResult {
  const expectedAuthority = normalizeExpectedAuthority(input.assessment?.authorityHolderType);
  const expectedClaimedRole = expectedClaimedRoleForAssessment(input.assessment);
  const claimedAuthority = normalizeClaimedAuthority(input.claimedRole);
  const authorityScope = String(input.authorityScope || "").trim().toLowerCase();
  const verificationMethod = String(input.verificationMethod || "").trim().toLowerCase();
  const verifiedContactHash = String(input.verifiedContactHash || "").trim();
  const identityVerificationBasis = VERIFIED_IDENTITY_METHODS.has(verificationMethod)
    ? verificationMethod
    : null;
  const base = {
    expectedAuthority,
    expectedClaimedRole,
    claimedAuthority,
    authorityScope,
    expectedAndClaimedMatch: Boolean(
      expectedClaimedRole && claimedAuthority === expectedClaimedRole,
    ),
    identityVerificationBasis,
    authorityVerificationBasis: null,
    substitutionRule: null,
  } as const;

  if (!expectedAuthority) return { ...base, ok: false, code: "EXPECTED_AUTHORITY_MISSING" };
  if (!claimedAuthority) return { ...base, ok: false, code: "CLAIMED_AUTHORITY_UNSUPPORTED" };
  if (AUTHORITY_ROLE_SCOPES[claimedAuthority] !== authorityScope) {
    return { ...base, ok: false, code: "AUTHORITY_SCOPE_INVALID" };
  }
  if (expectedAuthority === "vendor_manager") {
    return { ...base, ok: false, code: "CUSTOMER_PERMISSION_NOT_APPLICABLE" };
  }
  if (claimedAuthority !== expectedClaimedRole) {
    return { ...base, ok: false, code: "AUTHORITY_MISMATCH" };
  }
  if (!identityVerificationBasis || !verifiedContactHash) {
    return { ...base, ok: false, code: "IDENTITY_EVIDENCE_MISSING" };
  }

  // Version 1 can establish customer authority from the assessment's intended
  // decision-maker, a matching verified destination, and the customer's exact
  // scope declaration. It does not yet collect enough independent evidence to
  // establish representative, business-representative, or guardian authority.
  if (expectedAuthority !== "customer" || claimedAuthority !== "customer") {
    return { ...base, ok: false, code: "AUTHORITY_VERIFICATION_REQUIRED" };
  }

  return {
    ...base,
    ok: true,
    code: "AUTHORITY_VERIFIED",
    expectedAndClaimedMatch: true,
    authorityVerificationBasis:
      "assessment_expected_customer_and_verified_intended_contact_declaration",
  };
}

export function buildStoredAuthorityEvidence(input: {
  assessment: Required<
    Pick<PermissionAuthorityAssessment, "id" | "generation" | "scopeHash">
  > & PermissionAuthorityAssessment;
  validation: AuthorityValidationResult;
}): StoredAuthorityEvidence {
  const { assessment, validation } = input;
  if (
    !validation.ok ||
    !validation.expectedAuthority ||
    !validation.expectedClaimedRole ||
    !validation.claimedAuthority ||
    !validation.identityVerificationBasis ||
    !validation.authorityVerificationBasis
  ) {
    throw new Error("Verified authority evidence is required");
  }
  return {
    schemaVersion: AUTHORITY_EVIDENCE_SCHEMA_VERSION,
    assessmentId: String(assessment.id),
    assessmentGeneration: Number(assessment.generation),
    scopeHash: String(assessment.scopeHash),
    expectedAuthority: validation.expectedAuthority,
    expectedClaimedRole: validation.expectedClaimedRole,
    claimedAuthority: validation.claimedAuthority,
    authorityScope: validation.authorityScope,
    expectedAndClaimedMatch: true,
    identityVerificationBasis: validation.identityVerificationBasis,
    authorityVerificationBasis: validation.authorityVerificationBasis,
    authorityVerified: true,
    substitutionRule: null,
  };
}

export function parseStoredAuthorityEvidence(value: unknown): StoredAuthorityEvidence | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const authority = (parsed as any)?.authority;
    if (!authority || authority.schemaVersion !== AUTHORITY_EVIDENCE_SCHEMA_VERSION) return null;
    return authority as StoredAuthorityEvidence;
  } catch {
    return null;
  }
}

export function storedAuthorityEvidenceIsCurrent(input: {
  assessment: PermissionAuthorityAssessment | null | undefined;
  decisionEvidence: {
    claimedRole?: string | null;
    authorityScope?: string | null;
    verificationMethod?: string | null;
    verifiedContactHash?: string | null;
    scopeHash?: string | null;
    metadata?: string | null;
  } | null | undefined;
}): AuthorityValidationResult {
  const validation = evaluatePermissionAuthority({
    assessment: input.assessment,
    claimedRole: input.decisionEvidence?.claimedRole,
    authorityScope: input.decisionEvidence?.authorityScope,
    verificationMethod: input.decisionEvidence?.verificationMethod,
    verifiedContactHash: input.decisionEvidence?.verifiedContactHash,
  });
  if (!validation.ok) return validation;

  const stored = parseStoredAuthorityEvidence(input.decisionEvidence?.metadata);
  const current = Boolean(
    stored &&
      stored.authorityVerified === true &&
      stored.expectedAndClaimedMatch === true &&
      stored.substitutionRule === null &&
      stored.assessmentId === String(input.assessment?.id || "") &&
      stored.assessmentGeneration === Number(input.assessment?.generation) &&
      stored.scopeHash === String(input.assessment?.scopeHash || "") &&
      stored.scopeHash === String(input.decisionEvidence?.scopeHash || "") &&
      stored.expectedAuthority === validation.expectedAuthority &&
      stored.expectedClaimedRole === validation.expectedClaimedRole &&
      stored.claimedAuthority === validation.claimedAuthority &&
      stored.authorityScope === validation.authorityScope &&
      stored.identityVerificationBasis === validation.identityVerificationBasis &&
      stored.authorityVerificationBasis === validation.authorityVerificationBasis,
  );
  return current
    ? validation
    : { ...validation, ok: false, code: "AUTHORITY_VERIFICATION_REQUIRED" };
}

export function permissionAuthorityPresentation(
  assessment: PermissionAuthorityAssessment | null | undefined,
) {
  const expectedAuthority = normalizeExpectedAuthority(assessment?.authorityHolderType);
  const expectedClaimedRole = expectedClaimedRoleForAssessment(assessment);
  const permittedClaimedRoles: ClaimedPermissionAuthority[] =
    expectedAuthority === "customer" && expectedClaimedRole === "customer" ? ["customer"] : [];
  return {
    expectedAuthority,
    expectedClaimedRole,
    permittedClaimedRoles,
    canAuthorizeInCurrentFlow: permittedClaimedRoles.length > 0,
    explanation:
      permittedClaimedRoles.length > 0
        ? "The intended customer must verify the request and confirm customer authority."
        : expectedAuthority === "vendor_manager"
          ? "A vendor manager cannot use a customer permission request to authorize customer-controlled recording."
          : expectedAuthority
            ? "Reliance cannot verify this authority through the current beta request. Recording stays locked until the business corrects the required decision-maker or a supported authority-verification path is available."
            : "Reliance cannot confirm who has authority for this request. Recording stays locked until the business corrects the recording assessment.",
  };
}
