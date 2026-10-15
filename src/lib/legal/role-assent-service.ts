import { randomUUID } from "node:crypto";

import {
  BETA_ROLE_ASSENT_PACKAGE,
  ROLE_ASSENT_CONTENT_KEYS,
  betaRoleAssentContent,
  isBetaRoleAssentEnabled,
  managerWorkRecordAttestationPresentation,
  roleAssentContentSet,
  roleAssentContentSetHash,
  roleAssentPresentation,
  type BetaRoleAssentContent,
} from "@/lib/legal/beta-role-assent-content";
import {
  BETA_ONBOARDING_CONTENT_KEYS,
  BETA_ONBOARDING_LEGAL_PACKAGE,
  betaOnboardingDocumentByKey,
} from "@/lib/legal/beta-onboarding-content";
import {
  buildGovernedContentVersionCandidate,
  buildRoleAssentEvidenceCandidate,
  roleAssentChainKey,
  type GovernedContentVersionLike,
} from "@/lib/legal/governed-content-evidence";
import { legalEvidenceSha256 } from "@/lib/legal/legal-evidence-core";
import {
  consumeEmployeeDecisionSession,
  EMPLOYEE_DECISION_PURPOSES,
  loadEmployeeDecisionContext,
  type EmployeeDecisionContext,
} from "@/lib/employee-decision-verification";
import { parseAssignmentMetadata, parseCustomerMetadata } from "@/lib/job-assignment";

export class VendorRoleAssentRequiredError extends Error {
  readonly code = "VENDOR_ROLE_ASSENT_REQUIRED" as const;
  readonly statusCode = 403 as const;

  constructor() {
    super("Review and agree to the current Vendor terms before using this Vendor feature.");
    this.name = "VendorRoleAssentRequiredError";
  }
}

const PRODUCT_OWNER_APPROVAL_PRINCIPAL = "product-owner:github-issue-1";
const PRODUCT_OWNER_APPROVAL_AT = new Date("2026-10-13T00:00:00.000Z");
const LEGACY_MANAGER_ATTESTATION_CONTRACT = Object.freeze({
  contentKey: "reliance.vendor-role-assent",
  version: "reliance-vendor-assent-2026-10-13-draft.3",
  contentHash: "2c1507d286a5dcef2b413d34db23efba5065327e305caabf91a2aef66fead0fe",
});

export type VendorRoleAssentContext = {
  actorPrincipalId: string;
  actorUserId: string;
  actorRole: "MANAGER";
  vendorId: string;
  vendorName: string;
  membershipId: string;
  membershipGeneration: number;
  contextType: "VENDOR_ORGANIZATION";
  contextId: string;
  context: Record<string, unknown>;
  contextHash: string;
};

export type EmployeeRoleAssentContext = {
  actorPrincipalId: string;
  actorUserId: string;
  actorRole: "EMPLOYEE";
  vendorId: string;
  membershipId: string;
  bookingId: string;
  contextType: "EMPLOYEE_SERVICE_ORDER";
  contextId: string;
  context: Record<string, unknown>;
  contextHash: string;
  decisionContext: EmployeeDecisionContext;
};

export type ManagerWorkRecordAttestationContext = {
  actorPrincipalId: string;
  actorUserId: string;
  actorRole: "MANAGER";
  vendorId: string;
  membershipId: string;
  bookingId: string;
  contextType: "MANAGER_WORK_RECORD_ATTESTATION";
  contextId: string;
  context: Record<string, unknown>;
  contextHash: string;
};

type CurrentStatus = {
  current: boolean;
  decision: "ASSENT" | "DECLINE" | null;
  decidedAt: Date | null;
  evidenceIds: string[];
};

function principalId(userId: string): string {
  return `user:${String(userId).trim()}`;
}

function assertEnabled() {
  if (!isBetaRoleAssentEnabled()) throw new Error("ROLE_ASSENT_NOT_ENABLED");
}

function exactContentRecord(
  source: BetaRoleAssentContent,
  record: any,
): GovernedContentVersionLike {
  if (
    !record ||
    record.contentKey !== source.contentKey ||
    record.version !== source.version ||
    record.contentClass !== "POLICY" ||
    record.governanceStatus !== "PRODUCT_OWNER_APPROVED" ||
    record.contentSnapshot !== source.contentSnapshot ||
    record.contentHash !== source.contentHash
  ) {
    throw new Error(`ROLE_ASSENT_CONTENT_RECORD_INVALID:${source.contentKey}`);
  }
  return record as GovernedContentVersionLike;
}

export async function ensureBetaRoleAssentContent(db: any) {
  assertEnabled();
  const contents = [] as GovernedContentVersionLike[];
  for (const source of BETA_ROLE_ASSENT_PACKAGE.entries) {
    const candidate = buildGovernedContentVersionCandidate({
      contentKey: source.contentKey,
      contentClass: "POLICY",
      audienceRole: source.audienceRole,
      version: source.version,
      governanceStatus: "PRODUCT_OWNER_APPROVED",
      contentSnapshot: source.contentSnapshot,
      sourceRevision: BETA_ROLE_ASSENT_PACKAGE.generatedFromCommit,
      productOwnerApprovedByPrincipalId: PRODUCT_OWNER_APPROVAL_PRINCIPAL,
      productOwnerApprovedAt: PRODUCT_OWNER_APPROVAL_AT,
    });
    const record = await db.governedContentVersion.upsert({
      where: {
        contentKey_version: {
          contentKey: source.contentKey,
          version: source.version,
        },
      },
      create: candidate,
      update: {},
    });
    contents.push(exactContentRecord(source, record));
  }
  return contents;
}

async function loadExactContents(
  db: any,
  role: "VENDOR" | "EMPLOYEE",
  ensure = false,
): Promise<GovernedContentVersionLike[]> {
  if (ensure) await ensureBetaRoleAssentContent(db);
  const source = roleAssentContentSet(role);
  const records = await db.governedContentVersion.findMany({
    where: {
      OR: source.map(({ contentKey, version }) => ({ contentKey, version })),
    },
  });
  return source.map((item) =>
    exactContentRecord(
      item,
      records.find(
        (record: any) =>
          record.contentKey === item.contentKey && record.version === item.version,
      ),
    ),
  );
}

async function loadExactContentByKey(
  db: any,
  contentKey: string,
  ensure = false,
): Promise<GovernedContentVersionLike> {
  if (ensure) await ensureBetaRoleAssentContent(db);
  const source = betaRoleAssentContent(contentKey);
  const record = await db.governedContentVersion.findUnique({
    where: {
      contentKey_version: {
        contentKey: source.contentKey,
        version: source.version,
      },
    },
  });
  return exactContentRecord(source, record);
}

export async function loadVendorRoleAssentContext(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
}): Promise<VendorRoleAssentContext> {
  const membership = await input.db.vendorMembership.findFirst({
    where: {
      id: input.membershipId,
      userId: input.userId,
      vendorId: input.vendorId,
      role: "MANAGER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      role: true,
      status: true,
      membershipGeneration: true,
      vendor: { select: { name: true, businessName: true } },
    },
  });
  if (!membership) throw new Error("VENDOR_ROLE_ASSENT_AUTHORITY_STALE");
  return vendorRoleAssentContext(membership);
}

function vendorRoleAssentContext(membership: any): VendorRoleAssentContext {
  const context = {
    version: 1,
    vendorId: membership.vendorId,
    membershipId: membership.id,
    membershipGeneration: Number(membership.membershipGeneration || 1),
    actorUserId: membership.userId,
    actorRole: "MANAGER",
    authority: "VENDOR_ORGANIZATION_MANAGER",
  };
  return {
    actorPrincipalId: principalId(membership.userId),
    actorUserId: membership.userId,
    actorRole: "MANAGER",
    vendorId: membership.vendorId,
    vendorName: String(
      membership.vendor?.businessName || membership.vendor?.name || "Vendor",
    ),
    membershipId: membership.id,
    membershipGeneration: Number(membership.membershipGeneration || 1),
    contextType: "VENDOR_ORGANIZATION",
    contextId: membership.vendorId,
    context,
    contextHash: legalEvidenceSha256(context),
  };
}

async function loadVendorRegistrationRoleAssentContext(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
}): Promise<VendorRoleAssentContext> {
  const membership = await input.db.vendorMembership.findFirst({
    where: {
      id: input.membershipId,
      userId: input.userId,
      vendorId: input.vendorId,
      role: "MANAGER",
      status: { in: ["PENDING", "ACTIVE"] },
    },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      role: true,
      status: true,
      membershipGeneration: true,
      vendor: { select: { name: true, businessName: true } },
    },
  });
  if (!membership) throw new Error("VENDOR_REGISTRATION_ASSENT_AUTHORITY_STALE");
  return vendorRoleAssentContext(membership);
}

function employeeLegalContext(context: EmployeeDecisionContext) {
  return {
    version: 1,
    purpose: "ACCOUNTLESS_EMPLOYEE_SERVICE_ORDER_ASSENT",
    userId: context.userId,
    vendorId: context.vendorId,
    membershipId: context.membershipId,
    membershipGeneration: context.membershipGeneration,
    bookingId: context.bookingId,
    assignmentGeneration: context.assignmentGeneration,
    assessmentId: context.assessmentId,
    assessmentGeneration: context.assessmentGeneration,
    scopeHash: context.scopeHash,
    serviceOrderContextHash: context.contextHash,
    serviceOrderCurrent: context.serviceOrderCurrent === true,
  };
}

export async function loadEmployeeRoleAssentContext(input: {
  db: any;
  userId: string;
  membershipId: string;
  bookingId: string;
}): Promise<EmployeeRoleAssentContext> {
  const decisionContext = await loadEmployeeDecisionContext({
    db: input.db,
    purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT,
    userId: input.userId,
    membershipId: input.membershipId,
    bookingId: input.bookingId,
  });
  if (!decisionContext.serviceOrderCurrent) {
    throw new Error("EMPLOYEE_V2_SERVICE_ORDER_RELEASE_STALE");
  }
  const context = employeeLegalContext(decisionContext);
  return {
    actorPrincipalId: principalId(decisionContext.userId),
    actorUserId: decisionContext.userId,
    actorRole: "EMPLOYEE",
    vendorId: decisionContext.vendorId,
    membershipId: decisionContext.membershipId,
    bookingId: String(decisionContext.bookingId),
    contextType: "EMPLOYEE_SERVICE_ORDER",
    contextId: String(decisionContext.bookingId),
    context,
    contextHash: legalEvidenceSha256(context),
    decisionContext,
  };
}

async function statusForContext(input: {
  db: any;
  role: "VENDOR" | "EMPLOYEE";
  actorPrincipalId: string;
  actorRole: string;
  contextType: string;
  contextId: string;
  contextHash: string;
}): Promise<CurrentStatus> {
  let contents: GovernedContentVersionLike[];
  try {
    contents = await loadExactContents(input.db, input.role, false);
  } catch {
    return { current: false, decision: null, decidedAt: null, evidenceIds: [] };
  }
  const latest = await Promise.all(
    contents.map((content) =>
      input.db.roleAssentEvidence.findFirst({
        where: {
          chainKey: roleAssentChainKey({
            actorPrincipalId: input.actorPrincipalId,
            actorRole: input.actorRole,
            contentKey: content.contentKey,
            contextType: input.contextType,
            contextId: input.contextId,
          }),
        },
        orderBy: [{ sequence: "desc" }, { decidedAt: "desc" }],
      }),
    ),
  );
  const current = latest.every(
    (evidence, index) =>
      evidence?.decision === "ASSENT" &&
      evidence.contextHash === input.contextHash &&
      evidence.contentVersionId === contents[index].id &&
      evidence.policyVersion === contents[index].version &&
      evidence.contentHash === contents[index].contentHash,
  );
  const roleEvidence = latest[latest.length - 1];
  return {
    current,
    decision:
      roleEvidence?.decision === "ASSENT" || roleEvidence?.decision === "DECLINE"
        ? roleEvidence.decision
        : null,
    decidedAt: roleEvidence?.decidedAt || null,
    evidenceIds: latest.filter(Boolean).map((item) => String(item.id)),
  };
}

export async function getVendorRoleAssentStatus(input: {
  db: any;
  context: VendorRoleAssentContext;
}) {
  return statusForContext({
    db: input.db,
    role: "VENDOR",
    actorPrincipalId: input.context.actorPrincipalId,
    actorRole: input.context.actorRole,
    contextType: input.context.contextType,
    contextId: input.context.contextId,
    contextHash: input.context.contextHash,
  });
}

export async function getEmployeeRoleAssentStatus(input: {
  db: any;
  context: EmployeeRoleAssentContext;
}) {
  return statusForContext({
    db: input.db,
    role: "EMPLOYEE",
    actorPrincipalId: input.context.actorPrincipalId,
    actorRole: input.context.actorRole,
    contextType: input.context.contextType,
    contextId: input.context.contextId,
    contextHash: input.context.contextHash,
  });
}

async function appendDecisionBundle(input: {
  tx: any;
  role: "VENDOR" | "EMPLOYEE";
  actorPrincipalId: string;
  actorUserId: string;
  actorRole: string;
  vendorId: string;
  membershipId: string;
  bookingId?: string | null;
  contextType: string;
  contextId: string;
  context: Record<string, unknown>;
  decision: "ASSENT" | "DECLINE";
  verificationMethod: string;
  verificationContext: Record<string, unknown>;
  requestId: string;
  request: Record<string, unknown>;
  decidedAt: Date;
}) {
  const contents = await loadExactContents(input.tx, input.role, true);
  const selected = input.decision === "ASSENT" ? contents : [contents[contents.length - 1]];
  const evidence = [] as any[];
  for (const content of selected) {
    const chainKey = roleAssentChainKey({
      actorPrincipalId: input.actorPrincipalId,
      actorRole: input.actorRole,
      contentKey: content.contentKey,
      contextType: input.contextType,
      contextId: input.contextId,
    });
    const existing = await input.tx.roleAssentEvidence.findUnique({
      where: { chainKey_requestId: { chainKey, requestId: input.requestId } },
    });
    if (existing) {
      if (
        existing.decision !== input.decision ||
        existing.contextHash !== legalEvidenceSha256(input.context) ||
        existing.contentVersionId !== content.id ||
        existing.requestHash !== legalEvidenceSha256(input.request)
      ) {
        throw new Error("ROLE_ASSENT_REQUEST_ID_CONFLICT");
      }
      evidence.push(existing);
      continue;
    }
    const previous = await input.tx.roleAssentEvidence.findFirst({
      where: { chainKey },
      orderBy: [{ sequence: "desc" }, { decidedAt: "desc" }],
    });
    const candidate = buildRoleAssentEvidenceCandidate({
      content,
      actorPrincipalId: input.actorPrincipalId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      bookingId: input.bookingId,
      contextType: input.contextType,
      contextId: input.contextId,
      context: input.context,
      decision: input.decision,
      verificationMethod: input.verificationMethod,
      verificationContext: input.verificationContext,
      sequence: Number(previous?.sequence || 0) + 1,
      supersedesEvidenceId: previous?.id || null,
      requestId: input.requestId,
      request: input.request,
      decidedAt: input.decidedAt,
    });
    evidence.push(await input.tx.roleAssentEvidence.create({ data: candidate }));
  }
  return evidence;
}

async function runSerializable<T>(db: any, operation: (tx: any) => Promise<T>): Promise<T> {
  if (typeof db.$transaction !== "function") return operation(db);
  return db.$transaction(operation, { isolationLevel: "Serializable" });
}

export async function recordVendorRoleAssent(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
  decision: "ASSENT" | "DECLINE";
  acknowledgements: {
    authority: boolean;
    terms: boolean;
    privacy: boolean;
    electronicRecords: boolean;
  };
  displayedContentSetHash: string;
  requestId?: string;
  userAgent?: string | null;
}) {
  assertEnabled();
  const expectedSetHash = roleAssentContentSetHash("VENDOR");
  if (input.displayedContentSetHash !== expectedSetHash) {
    throw new Error("ROLE_ASSENT_CONTENT_STALE");
  }
  if (
    input.decision === "ASSENT" &&
    (!input.acknowledgements.authority ||
      !input.acknowledgements.terms ||
      !input.acknowledgements.privacy ||
      !input.acknowledgements.electronicRecords)
  ) {
    throw new Error("VENDOR_ROLE_ASSENT_ACKNOWLEDGEMENTS_REQUIRED");
  }
  const requestId = String(input.requestId || randomUUID()).trim();
  const decidedAt = new Date();
  return runSerializable(input.db, async (tx) => {
    const context = await loadVendorRoleAssentContext({ ...input, db: tx });
    const evidence = await appendDecisionBundle({
      tx,
      role: "VENDOR",
      actorPrincipalId: context.actorPrincipalId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      vendorId: context.vendorId,
      membershipId: context.membershipId,
      contextType: context.contextType,
      contextId: context.contextId,
      context: context.context,
      decision: input.decision,
      verificationMethod: "AUTHENTICATED_VENDOR_MANAGER_SESSION",
      verificationContext: {
        membershipId: context.membershipId,
        membershipGeneration: context.membershipGeneration,
        actorRole: context.actorRole,
        authorityAcknowledged: input.acknowledgements.authority,
        userAgentHash: input.userAgent ? legalEvidenceSha256(input.userAgent) : null,
      },
      requestId,
      request: {
        decision: input.decision,
        acknowledgements: input.acknowledgements,
        displayedContentSetHash: input.displayedContentSetHash,
      },
      decidedAt,
    });
    return {
      decision: input.decision,
      current: input.decision === "ASSENT",
      evidenceIds: evidence.map((item) => String(item.id)),
      decidedAt,
      contentSetHash: expectedSetHash,
      contextHash: context.contextHash,
      vendorName: context.vendorName,
    };
  });
}

export async function recordVendorRegistrationRoleAssent(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
  acknowledgements: {
    authority: boolean;
    terms: boolean;
    privacy: boolean;
    electronicRecords: boolean;
  };
  displayedContentSetHash: string;
  emailVerificationCompleted: boolean;
  smsOptIn: boolean;
  requestId?: string;
  userAgent?: string | null;
}) {
  assertEnabled();
  const expectedSetHash = roleAssentContentSetHash("VENDOR");
  if (input.displayedContentSetHash !== expectedSetHash) {
    throw new Error("ROLE_ASSENT_CONTENT_STALE");
  }
  if (
    !input.acknowledgements.authority ||
    !input.acknowledgements.terms ||
    !input.acknowledgements.privacy ||
    !input.acknowledgements.electronicRecords
  ) {
    throw new Error("VENDOR_ROLE_ASSENT_ACKNOWLEDGEMENTS_REQUIRED");
  }
  const smsPolicy = betaOnboardingDocumentByKey(BETA_ONBOARDING_CONTENT_KEYS.SMS);
  const requestId = String(input.requestId || randomUUID()).trim();
  const decidedAt = new Date();
  return runSerializable(input.db, async (tx) => {
    const context = await loadVendorRegistrationRoleAssentContext({ ...input, db: tx });
    const verificationState = input.emailVerificationCompleted
      ? "EMAIL_VERIFIED"
      : "EMAIL_VERIFICATION_PENDING";
    const evidence = await appendDecisionBundle({
      tx,
      role: "VENDOR",
      actorPrincipalId: context.actorPrincipalId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      vendorId: context.vendorId,
      membershipId: context.membershipId,
      contextType: context.contextType,
      contextId: context.contextId,
      context: context.context,
      decision: "ASSENT",
      verificationMethod: input.emailVerificationCompleted
        ? "AUTHENTICATED_VERIFIED_VENDOR_REGISTRATION"
        : "VENDOR_REGISTRATION_PRE_EMAIL_VERIFICATION",
      verificationContext: {
        registrationContext: "VENDOR_REGISTRATION",
        membershipId: context.membershipId,
        membershipGeneration: context.membershipGeneration,
        actorRole: context.actorRole,
        authorityAcknowledged: true,
        emailVerificationCompleted: input.emailVerificationCompleted,
        verificationState,
        smsOptIn: input.smsOptIn,
        smsPolicy: {
          contentKey: smsPolicy.contentKey,
          version: smsPolicy.version,
          contentHash: smsPolicy.contentHash,
        },
        userAgentHash: input.userAgent ? legalEvidenceSha256(input.userAgent) : null,
      },
      requestId,
      request: {
        registrationContext: "VENDOR_REGISTRATION",
        decision: "ASSENT",
        acknowledgements: input.acknowledgements,
        displayedContentSetHash: input.displayedContentSetHash,
        smsOptIn: input.smsOptIn,
        smsPolicyVersion: smsPolicy.version,
        smsPolicyContentHash: smsPolicy.contentHash,
      },
      decidedAt,
    });
    return {
      decision: "ASSENT" as const,
      current: true,
      evidenceIds: evidence.map((item) => String(item.id)),
      decidedAt,
      contentSetHash: expectedSetHash,
      contextHash: context.contextHash,
      vendorName: context.vendorName,
      verificationState,
    };
  });
}

export async function recordEmployeeRoleAssent(input: {
  db: any;
  userId: string;
  membershipId: string;
  bookingId: string;
  decision: "ASSENT" | "DECLINE";
  sessionSecret: string;
  expectedServiceOrderContextHash: string;
  acknowledgements: {
    identity: boolean;
    terms: boolean;
    privacy: boolean;
    electronicRecords: boolean;
  };
  displayedContentSetHash: string;
  requestId?: string;
  userAgent?: string | null;
}) {
  assertEnabled();
  const expectedSetHash = roleAssentContentSetHash("EMPLOYEE");
  if (input.displayedContentSetHash !== expectedSetHash) {
    throw new Error("ROLE_ASSENT_CONTENT_STALE");
  }
  if (
    input.decision === "ASSENT" &&
    (!input.acknowledgements.identity ||
      !input.acknowledgements.terms ||
      !input.acknowledgements.privacy ||
      !input.acknowledgements.electronicRecords)
  ) {
    throw new Error("EMPLOYEE_ROLE_ASSENT_ACKNOWLEDGEMENTS_REQUIRED");
  }
  const requestId = String(input.requestId || randomUUID()).trim();
  const decidedAt = new Date();
  return runSerializable(input.db, async (tx) => {
    const context = await loadEmployeeRoleAssentContext({ ...input, db: tx });
    if (context.decisionContext.contextHash !== input.expectedServiceOrderContextHash) {
      throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_CONTEXT_STALE");
    }
    const verifiedSession = await consumeEmployeeDecisionSession({
      tx,
      secret: input.sessionSecret,
      context: context.decisionContext,
      consumedByType: "ROLE_ASSENT_BUNDLE",
      consumedById: requestId,
      now: decidedAt,
    });
    const evidence = await appendDecisionBundle({
      tx,
      role: "EMPLOYEE",
      actorPrincipalId: context.actorPrincipalId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      vendorId: context.vendorId,
      membershipId: context.membershipId,
      bookingId: context.bookingId,
      contextType: context.contextType,
      contextId: context.contextId,
      context: context.context,
      decision: input.decision,
      verificationMethod: "VERIFIED_EMPLOYEE_SERVICE_ORDER_OTP_SESSION",
      verificationContext: {
        verifiedSessionId: verifiedSession.id,
        verifiedChannel: verifiedSession.verifiedChannel,
        verifiedContactHash: verifiedSession.verifiedContactHash,
        membershipGeneration: context.decisionContext.membershipGeneration,
        assignmentGeneration: context.decisionContext.assignmentGeneration,
        serviceOrderEntry: true,
        actingOnlyForSelf: input.acknowledgements.identity,
        userAgentHash: input.userAgent ? legalEvidenceSha256(input.userAgent) : null,
      },
      requestId,
      request: {
        decision: input.decision,
        acknowledgements: input.acknowledgements,
        displayedContentSetHash: input.displayedContentSetHash,
        displayedServiceOrderContextHash: input.expectedServiceOrderContextHash,
      },
      decidedAt,
    });
    return {
      decision: input.decision,
      current: input.decision === "ASSENT",
      evidenceIds: evidence.map((item) => String(item.id)),
      decidedAt,
      contentSetHash: expectedSetHash,
      contextHash: context.contextHash,
    };
  });
}

export async function assertCurrentVendorRoleAssent(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
}) {
  if (!isBetaRoleAssentEnabled()) return;
  const context = await loadVendorRoleAssentContext(input);
  const status = await getVendorRoleAssentStatus({ db: input.db, context });
  if (!status.current) {
    throw new VendorRoleAssentRequiredError();
  }
}

export async function assertCurrentEmployeeRoleAssent(input: {
  db: any;
  userId: string;
  membershipId: string;
  bookingId: string;
}) {
  if (!isBetaRoleAssentEnabled()) return;
  const context = await loadEmployeeRoleAssentContext(input);
  const status = await getEmployeeRoleAssentStatus({ db: input.db, context });
  if (!status.current) throw new Error("EMPLOYEE_ROLE_ASSENT_REQUIRED");
}

export async function loadManagerWorkRecordAttestationContext(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
  bookingId: string;
}): Promise<ManagerWorkRecordAttestationContext> {
  const manager = await loadVendorRoleAssentContext(input);
  const booking = await input.db.booking.findFirst({
    where: { id: input.bookingId, vendorId: input.vendorId },
    select: { id: true, vendorId: true, status: true, customerMetadata: true },
  });
  if (!booking) throw new Error("MANAGER_WORK_RECORD_NOT_FOUND");
  const assignment = parseAssignmentMetadata(booking.customerMetadata);
  const metadata = parseCustomerMetadata(booking.customerMetadata);
  const assessment = await input.db.recordingScopeAssessment.findFirst({
    where: {
      bookingId: booking.id,
      vendorId: booking.vendorId,
      isCurrent: true,
      status: "COMPLETE",
    },
    orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
  });
  if (!assessment) throw new Error("MANAGER_WORK_RECORD_ATTESTATION_CONTEXT_REQUIRED");
  const assignmentGeneration = Number(metadata.vendor_job_assignment_generation || 1);
  const assignedMembershipIds = [...assignment.assignedMembershipIds].sort();
  const context = {
    version: 1,
    bookingId: booking.id,
    vendorId: booking.vendorId,
    bookingStatus: booking.status,
    managerMembershipId: manager.membershipId,
    managerMembershipGeneration: manager.membershipGeneration,
    assignmentGeneration,
    assignedMembershipIds,
    assessmentId: assessment.id,
    assessmentGeneration: Number(assessment.generation),
    assessmentContractVersion: assessment.contractVersion,
    scopeHash: assessment.scopeHash,
  };
  return {
    actorPrincipalId: manager.actorPrincipalId,
    actorUserId: manager.actorUserId,
    actorRole: "MANAGER",
    vendorId: manager.vendorId,
    membershipId: manager.membershipId,
    bookingId: booking.id,
    contextType: "MANAGER_WORK_RECORD_ATTESTATION",
    contextId: booking.id,
    context,
    contextHash: legalEvidenceSha256(context),
  };
}

export async function getManagerWorkRecordAttestationStatus(input: {
  db: any;
  context: ManagerWorkRecordAttestationContext;
}) {
  let content: GovernedContentVersionLike | null = null;
  try {
    content = await loadExactContentByKey(
      input.db,
      ROLE_ASSENT_CONTENT_KEYS.MANAGER_WORK_RECORD_ATTESTATION,
      false,
    );
  } catch {
    content = null;
  }
  const currentChainKey = content
    ? roleAssentChainKey({
        actorPrincipalId: input.context.actorPrincipalId,
        actorRole: input.context.actorRole,
        contentKey: content.contentKey,
        contextType: input.context.contextType,
        contextId: input.context.contextId,
      })
    : null;
  const evidence = currentChainKey
    ? await input.db.roleAssentEvidence.findFirst({
        where: { chainKey: currentChainKey },
        orderBy: [{ sequence: "desc" }, { decidedAt: "desc" }],
      })
    : null;
  const current = Boolean(
    content &&
      evidence?.decision === "ASSENT" &&
      evidence.contextHash === input.context.contextHash &&
      evidence.contentVersionId === content.id &&
      evidence.policyVersion === content.version &&
      evidence.contentHash === content.contentHash,
  );
  if (current) {
    return {
      current: true,
      decision: "ASSENT" as const,
      decidedAt: evidence.decidedAt,
      evidenceIds: [String(evidence.id)],
      historicalContract: false,
    };
  }

  // Draft.3 embedded this exact attestation in the Vendor document. Preserve
  // that accepted historical contract without using it for new writes.
  const legacyChainKey = roleAssentChainKey({
    actorPrincipalId: input.context.actorPrincipalId,
    actorRole: input.context.actorRole,
    contentKey: LEGACY_MANAGER_ATTESTATION_CONTRACT.contentKey,
    contextType: input.context.contextType,
    contextId: input.context.contextId,
  });
  const legacyEvidence = await input.db.roleAssentEvidence.findFirst({
    where: { chainKey: legacyChainKey },
    orderBy: [{ sequence: "desc" }, { decidedAt: "desc" }],
  });
  const legacyCurrent = Boolean(
    legacyEvidence?.decision === "ASSENT" &&
      legacyEvidence.contextHash === input.context.contextHash &&
      legacyEvidence.policyKey === LEGACY_MANAGER_ATTESTATION_CONTRACT.contentKey &&
      legacyEvidence.policyVersion === LEGACY_MANAGER_ATTESTATION_CONTRACT.version &&
      legacyEvidence.contentHash === LEGACY_MANAGER_ATTESTATION_CONTRACT.contentHash,
  );
  return {
    current: legacyCurrent,
    decision:
      legacyEvidence?.decision === "ASSENT" || legacyEvidence?.decision === "DECLINE"
        ? legacyEvidence.decision
        : null,
    decidedAt: legacyEvidence?.decidedAt || null,
    evidenceIds: legacyEvidence ? [String(legacyEvidence.id)] : [],
    historicalContract: legacyCurrent,
  };
}

export async function recordManagerWorkRecordAttestation(input: {
  db: any;
  userId: string;
  vendorId: string;
  membershipId: string;
  bookingId: string;
  displayedContextHash: string;
  displayedContentSetHash: string;
  authorityConfirmed: boolean;
  requestId?: string;
  userAgent?: string | null;
}) {
  assertEnabled();
  if (!input.authorityConfirmed) {
    throw new Error("MANAGER_WORK_RECORD_ATTESTATION_REQUIRED");
  }
  const managerPresentation = managerWorkRecordAttestationPresentation();
  if (input.displayedContentSetHash !== managerPresentation.contentSetHash) {
    throw new Error("ROLE_ASSENT_CONTENT_STALE");
  }
  await assertCurrentVendorRoleAssent(input);
  const requestId = String(input.requestId || randomUUID()).trim();
  const decidedAt = new Date();
  return runSerializable(input.db, async (tx) => {
    const context = await loadManagerWorkRecordAttestationContext({ ...input, db: tx });
    if (context.contextHash !== input.displayedContextHash) {
      throw new Error("MANAGER_WORK_RECORD_ATTESTATION_STALE");
    }
    const content = await loadExactContentByKey(
      tx,
      ROLE_ASSENT_CONTENT_KEYS.MANAGER_WORK_RECORD_ATTESTATION,
      true,
    );
    const chainKey = roleAssentChainKey({
      actorPrincipalId: context.actorPrincipalId,
      actorRole: context.actorRole,
      contentKey: content.contentKey,
      contextType: context.contextType,
      contextId: context.contextId,
    });
    const existing = await tx.roleAssentEvidence.findUnique({
      where: { chainKey_requestId: { chainKey, requestId } },
    });
    if (existing) return { current: true, idempotent: true, evidenceId: existing.id };
    const previous = await tx.roleAssentEvidence.findFirst({
      where: { chainKey },
      orderBy: [{ sequence: "desc" }, { decidedAt: "desc" }],
    });
    const candidate = buildRoleAssentEvidenceCandidate({
      content,
      actorPrincipalId: context.actorPrincipalId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      vendorId: context.vendorId,
      membershipId: context.membershipId,
      bookingId: context.bookingId,
      contextType: context.contextType,
      contextId: context.contextId,
      context: context.context,
      decision: "ASSENT",
      verificationMethod: "AUTHENTICATED_VENDOR_MANAGER_SESSION",
      verificationContext: {
        managerMembershipId: context.membershipId,
        authorityConfirmed: true,
        userAgentHash: input.userAgent ? legalEvidenceSha256(input.userAgent) : null,
      },
      sequence: Number(previous?.sequence || 0) + 1,
      supersedesEvidenceId: previous?.id || null,
      requestId,
      request: {
        authorityConfirmed: true,
        displayedContextHash: input.displayedContextHash,
        displayedContentSetHash: input.displayedContentSetHash,
      },
      decidedAt,
    });
    const evidence = await tx.roleAssentEvidence.create({ data: candidate });
    return {
      current: true,
      idempotent: false,
      evidenceId: evidence.id,
      contextHash: context.contextHash,
      decidedAt,
    };
  });
}

export async function hasCurrentManagerWorkRecordAttestation(input: {
  db: any;
  bookingId: string;
  vendorId: string;
}): Promise<boolean> {
  if (!isBetaRoleAssentEnabled()) return true;
  const managers = await input.db.vendorMembership.findMany({
    where: { vendorId: input.vendorId, role: "MANAGER", status: "ACTIVE" },
    select: { id: true, userId: true },
  });
  for (const manager of managers) {
    try {
      const vendorContext = await loadVendorRoleAssentContext({
        db: input.db,
        userId: manager.userId,
        vendorId: input.vendorId,
        membershipId: manager.id,
      });
      const vendorStatus = await getVendorRoleAssentStatus({
        db: input.db,
        context: vendorContext,
      });
      if (!vendorStatus.current) continue;
      const context = await loadManagerWorkRecordAttestationContext({
        db: input.db,
        userId: manager.userId,
        vendorId: input.vendorId,
        membershipId: manager.id,
        bookingId: input.bookingId,
      });
      const status = await getManagerWorkRecordAttestationStatus({ db: input.db, context });
      if (status.current) return true;
    } catch {
      // A stale manager or incomplete context cannot authorize release.
    }
  }
  return false;
}

export function betaRoleAssentApiPresentation(role: "VENDOR" | "EMPLOYEE") {
  assertEnabled();
  return {
    ...roleAssentPresentation(role),
    ...(role === "VENDOR"
      ? { vendorAcknowledgements: BETA_ONBOARDING_LEGAL_PACKAGE.vendorAcknowledgements }
      : {}),
  };
}
