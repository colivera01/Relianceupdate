import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashOpaqueSecret } from "@/lib/consent/token";
import { parseRecordingAssessmentV2 } from "@/lib/recording/assessment-v2";
import {
  EMPLOYEE_DECISION_PURPOSES,
  loadEmployeeDecisionContext,
} from "@/lib/employee-decision-verification";
import {
  ensureBetaRoleAssentContent,
  getEmployeeRoleAssentStatus,
  getManagerWorkRecordAttestationStatus,
  getVendorRoleAssentStatus,
  loadEmployeeRoleAssentContext,
  loadManagerWorkRecordAttestationContext,
  loadVendorRoleAssentContext,
  recordEmployeeRoleAssent,
  recordManagerWorkRecordAttestation,
  recordVendorRegistrationRoleAssent,
  recordVendorRoleAssent,
} from "./role-assent-service";
import {
  BETA_ROLE_ASSENT_PACKAGE,
  ROLE_ASSENT_CONTENT_KEYS,
  managerWorkRecordAttestationPresentation,
  roleAssentContentSetHash,
} from "./beta-role-assent-content";

function fixture() {
  const contents: any[] = [];
  const evidence: any[] = [];
  const canonical = parseRecordingAssessmentV2({
    contractVersion: "recording-assessment-v4-multiscope-safety-v1",
    location: { type: "VENDOR_BUSINESS", snapshotEvidenceHash: "a".repeat(64) },
    intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
    expectedPeople: ["ASSIGNED_SERVICE_PROFESSIONAL"],
    recordingFormat: "VIDEO_ONLY",
    recordingArea: { boundary: "SERVICE_AREA_ONLY" },
  });
  const manager = {
    id: "manager-membership",
    userId: "manager-user",
    vendorId: "vendor-1",
    role: "MANAGER",
    status: "ACTIVE",
    membershipGeneration: 1,
    vendor: { name: "Vendor One", businessName: "Vendor One LLC" },
  };
  const employee = {
    id: "employee-membership",
    userId: "employee-user",
    vendorId: "vendor-1",
    role: "EMPLOYEE",
    status: "ACTIVE",
    membershipGeneration: 2,
    user: { name: "Employee One", email: "employee@example.test", phone: null },
    vendor: { name: "Vendor One", businessName: "Vendor One LLC" },
  };
  const metadata: Record<string, unknown> = {
    vendor_job_assigned_membership_ids: [employee.id],
    vendor_job_assigned_employees: ["Employee One"],
    vendor_job_assignment_generation: 3,
    vendor_job_service_order_released_membership_ids: [employee.id],
    vendor_job_service_order_release_contexts: {
      [employee.id]: {
        version: 2,
        assignmentGeneration: 3,
        assessmentId: "assessment-1",
        assessmentGeneration: 2,
        scopeHash: canonical.scopeHash,
        notificationKind: "kind",
        releasedAt: "2026-10-13T12:00:00.000Z",
      },
    },
  };
  const booking = {
    id: "booking-1",
    vendorId: "vendor-1",
    status: "PENDING",
    title: "Outlet Installation",
    customerMetadata: JSON.stringify(metadata),
    service: { name: "Outlet Installation" },
  };
  const assessment = {
    id: "assessment-1",
    bookingId: booking.id,
    vendorId: booking.vendorId,
    generation: 2,
    isCurrent: true,
    status: "COMPLETE",
    contractVersion: "recording-assessment-v4-multiscope-safety-v1",
    scopeHash: canonical.scopeHash,
    scopeJson: canonical.scopeJson,
    subjectJson: canonical.subjectJson,
    propertyScope: "not_applicable",
    peopleScope: "not_applicable",
    frameControl: "not_applicable",
    audioAllowed: false,
  };
  const sessions: any[] = [];
  const db: any = {
    governedContentVersion: {
      upsert: vi.fn(async ({ where, create }) => {
        let row = contents.find(
          (item) =>
            item.contentKey === where.contentKey_version.contentKey &&
            item.version === where.contentKey_version.version,
        );
        if (!row) {
          row = { id: `content-${contents.length + 1}`, ...create };
          contents.push(row);
        }
        return row;
      }),
      findMany: vi.fn(async ({ where }) =>
        contents.filter((item) =>
          where.OR.some(
            (candidate: any) =>
              candidate.contentKey === item.contentKey && candidate.version === item.version,
          ),
        ),
      ),
      findUnique: vi.fn(async ({ where }) => {
        const key = where.contentKey_version;
        return contents.find(
          (item) => item.contentKey === key.contentKey && item.version === key.version,
        ) || null;
      }),
    },
    roleAssentEvidence: {
      findUnique: vi.fn(async ({ where }) =>
        evidence.find(
          (item) =>
            item.chainKey === where.chainKey_requestId.chainKey &&
            item.requestId === where.chainKey_requestId.requestId,
        ) || null,
      ),
      findFirst: vi.fn(async ({ where }) =>
        evidence
          .filter((item) => item.chainKey === where.chainKey)
          .sort((left, right) => right.sequence - left.sequence)[0] || null,
      ),
      create: vi.fn(async ({ data }) => {
        const row = { id: `evidence-${evidence.length + 1}`, createdAt: new Date(), ...data };
        evidence.push(row);
        return row;
      }),
    },
    vendorMembership: {
      findFirst: vi.fn(async ({ where }) => {
        const rows = [manager, employee];
        return rows.find(
          (item) =>
            item.id === where.id &&
            item.userId === where.userId &&
            item.vendorId === where.vendorId &&
            item.role === where.role &&
            (typeof where.status === "object"
              ? where.status.in.includes(item.status)
              : item.status === where.status),
        ) || null;
      }),
      findUnique: vi.fn(async ({ where }) =>
        [manager, employee].find((item) => item.id === where.id) || null,
      ),
      findMany: vi.fn(async () => [manager]),
    },
    booking: { findFirst: vi.fn(async () => booking) },
    recordingScopeAssessment: { findFirst: vi.fn(async () => assessment) },
    employeeVerifiedDecisionSession: {
      findUnique: vi.fn(async ({ where }) =>
        sessions.find((item) => item.secretHash === where.secretHash) || null,
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = sessions.find(
          (item) => item.id === where.id && !item.consumedAt && item.expiresAt > where.expiresAt.gt,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (operation) => operation(db)),
  };
  return { db, contents, evidence, sessions, manager, employee, booking, assessment, metadata };
}

beforeEach(() => {
  vi.stubEnv("LEGAL_ROLE_ASSENT_BETA_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("beta role-assent evidence service", () => {
  it("preserves an older same-body version while creating the current governed version", async () => {
    const data = fixture();
    const currentTerms = BETA_ROLE_ASSENT_PACKAGE.entries.find(
      (item) => item.contentKey === ROLE_ASSENT_CONTENT_KEYS.TERMS,
    );
    expect(currentTerms).toBeDefined();
    data.contents.push({
      id: "content-legacy-terms",
      contentKey: currentTerms!.contentKey,
      contentClass: "POLICY",
      audienceRole: currentTerms!.audienceRole,
      version: "reliance-terms-2026-10-13-draft.3",
      governanceStatus: "PRODUCT_OWNER_APPROVED",
      contentSnapshot: currentTerms!.contentSnapshot,
      contentHash: currentTerms!.contentHash,
      sourceRevision: "historical-release",
      productOwnerApprovedByPrincipalId: "product-owner:historical",
      productOwnerApprovedAt: new Date("2026-10-13T00:00:00.000Z"),
    });

    const ensured = await ensureBetaRoleAssentContent(data.db);

    expect(ensured).toHaveLength(BETA_ROLE_ASSENT_PACKAGE.entries.length);
    expect(
      data.contents.filter(
        (item) =>
          item.contentKey === currentTerms!.contentKey &&
          item.contentHash === currentTerms!.contentHash,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: "reliance-terms-2026-10-13-draft.3" }),
        expect.objectContaining({ version: currentTerms!.version }),
      ]),
    );
    expect(data.contents.find((item) => item.id === "content-legacy-terms")).toMatchObject({
      version: "reliance-terms-2026-10-13-draft.3",
      sourceRevision: "historical-release",
    });
  });

  it("records a pre-verification Vendor registration bundle that remains current after membership activation", async () => {
    const data = fixture();
    data.manager.status = "PENDING";

    const result = await recordVendorRegistrationRoleAssent({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      acknowledgements: {
        authority: true,
        terms: true,
        privacy: true,
        electronicRecords: true,
      },
      displayedContentSetHash: roleAssentContentSetHash("VENDOR"),
      emailVerificationCompleted: false,
      smsOptIn: false,
      requestId: "vendor-registration-1",
      userAgent: "registration-browser",
    });

    expect(result).toMatchObject({
      current: true,
      verificationState: "EMAIL_VERIFICATION_PENDING",
    });
    expect(data.evidence).toHaveLength(3);
    expect(data.evidence.every((item) => item.verificationMethod === "VENDOR_REGISTRATION_PRE_EMAIL_VERIFICATION")).toBe(true);
    expect(data.evidence.every((item) => item.verificationContextJson.includes('"smsOptIn":false'))).toBe(true);

    data.manager.status = "ACTIVE";
    const context = await loadVendorRoleAssentContext({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
    });
    await expect(getVendorRoleAssentStatus({ db: data.db, context })).resolves.toMatchObject({
      current: true,
      decision: "ASSENT",
    });
  });

  it("records separate exact Vendor Terms, Privacy, and authority evidence and invalidates it on authority change", async () => {
    const data = fixture();
    const result = await recordVendorRoleAssent({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      decision: "ASSENT",
      acknowledgements: { authority: true, terms: true, privacy: true, electronicRecords: true },
      displayedContentSetHash: roleAssentContentSetHash("VENDOR"),
      requestId: "vendor-request-1",
      userAgent: "test-agent",
    });
    expect(result.evidenceIds).toHaveLength(3);
    expect(data.evidence.map((item) => item.policyKey)).toEqual([
      "reliance.terms-of-use",
      "reliance.privacy-notice",
      "reliance.vendor-role-assent",
    ]);
    expect(data.evidence.every((item) => item.contentHash.length === 64)).toBe(true);
    expect(
      JSON.stringify(
        data.evidence.map((item) => ({
          verificationContextJson: item.verificationContextJson,
          requestHash: item.requestHash,
        })),
      ),
    ).not.toMatch(/password|rawOtp|bearerToken|signedUrl/i);

    const context = await loadVendorRoleAssentContext({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
    });
    await expect(getVendorRoleAssentStatus({ db: data.db, context })).resolves.toMatchObject({ current: true, decision: "ASSENT" });
    data.manager.membershipGeneration = 2;
    const changed = await loadVendorRoleAssentContext({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
    });
    await expect(getVendorRoleAssentStatus({ db: data.db, context: changed })).resolves.toMatchObject({ current: false });
  });

  it("records Vendor decline without fabricating Terms or Privacy assent and rejects proxy authority", async () => {
    const data = fixture();
    await recordVendorRoleAssent({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      decision: "DECLINE",
      acknowledgements: { authority: false, terms: false, privacy: false, electronicRecords: false },
      displayedContentSetHash: roleAssentContentSetHash("VENDOR"),
      requestId: "vendor-decline-1",
    });
    expect(data.evidence).toHaveLength(1);
    expect(data.evidence[0]).toMatchObject({ policyKey: "reliance.vendor-role-assent", decision: "DECLINE" });
    await expect(loadVendorRoleAssentContext({
      db: data.db,
      userId: "another-user",
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
    })).rejects.toThrow("VENDOR_ROLE_ASSENT_AUTHORITY_STALE");
  });

  it("makes exact retries idempotent and rejects request-id reuse for a different decision", async () => {
    const data = fixture();
    const input = {
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      decision: "ASSENT" as const,
      acknowledgements: { authority: true, terms: true, privacy: true, electronicRecords: true },
      displayedContentSetHash: roleAssentContentSetHash("VENDOR"),
      requestId: "same-request",
    };
    const first = await recordVendorRoleAssent(input);
    const second = await recordVendorRoleAssent(input);
    expect(second.evidenceIds).toEqual(first.evidenceIds);
    expect(data.evidence).toHaveLength(3);

    await expect(recordVendorRoleAssent({
      ...input,
      decision: "DECLINE",
      acknowledgements: { authority: false, terms: false, privacy: false, electronicRecords: false },
    })).rejects.toThrow("ROLE_ASSENT_REQUEST_ID_CONFLICT");
  });

  it("rejects a materially stale content set without writing evidence", async () => {
    const data = fixture();
    await expect(recordVendorRoleAssent({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      decision: "ASSENT",
      acknowledgements: { authority: true, terms: true, privacy: true, electronicRecords: true },
      displayedContentSetHash: "stale-content-set",
      requestId: "stale-request",
    })).rejects.toThrow("ROLE_ASSENT_CONTENT_STALE");
    expect(data.evidence).toHaveLength(0);
  });

  it("binds Manager attestation to the exact Work Record assignment and recording scope", async () => {
    const data = fixture();
    await recordVendorRoleAssent({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      decision: "ASSENT",
      acknowledgements: { authority: true, terms: true, privacy: true, electronicRecords: true },
      displayedContentSetHash: roleAssentContentSetHash("VENDOR"),
      requestId: "vendor-request-1",
    });
    const context = await loadManagerWorkRecordAttestationContext({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      bookingId: data.booking.id,
    });
    await recordManagerWorkRecordAttestation({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      bookingId: data.booking.id,
      displayedContextHash: context.contextHash,
      displayedContentSetHash: managerWorkRecordAttestationPresentation().contentSetHash,
      authorityConfirmed: true,
      requestId: "attestation-1",
    });
    await expect(getManagerWorkRecordAttestationStatus({ db: data.db, context })).resolves.toMatchObject({ current: true });
    expect(data.evidence.at(-1)?.policyKey).toBe(
      ROLE_ASSENT_CONTENT_KEYS.MANAGER_WORK_RECORD_ATTESTATION,
    );
    data.metadata.vendor_job_assignment_generation = 4;
    data.booking.customerMetadata = JSON.stringify(data.metadata);
    const replaced = await loadManagerWorkRecordAttestationContext({
      db: data.db,
      userId: data.manager.userId,
      vendorId: data.manager.vendorId,
      membershipId: data.manager.id,
      bookingId: data.booking.id,
    });
    await expect(getManagerWorkRecordAttestationStatus({ db: data.db, context: replaced })).resolves.toMatchObject({ current: false });
  });

  it("uses a purpose-bound verified Employee session and keeps legal assent separate from recording participation", async () => {
    const data = fixture();
    const decisionContext = await loadEmployeeDecisionContext({
      db: data.db,
      purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT,
      userId: data.employee.userId,
      membershipId: data.employee.id,
      bookingId: data.booking.id,
    });
    const secret = "verified-session-secret";
    data.sessions.push({
      id: "verified-session-1",
      secretHash: hashOpaqueSecret(secret),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT,
      contextHash: decisionContext.contextHash,
      userId: data.employee.userId,
      vendorId: data.employee.vendorId,
      membershipId: data.employee.id,
      membershipGeneration: data.employee.membershipGeneration,
      verifiedChannel: "email",
      verifiedContactHash: "d".repeat(64),
    });
    const result = await recordEmployeeRoleAssent({
      db: data.db,
      userId: data.employee.userId,
      membershipId: data.employee.id,
      bookingId: data.booking.id,
      decision: "ASSENT",
      sessionSecret: secret,
      expectedServiceOrderContextHash: decisionContext.contextHash,
      acknowledgements: { identity: true, terms: true, privacy: true, electronicRecords: true },
      displayedContentSetHash: roleAssentContentSetHash("EMPLOYEE"),
      requestId: "employee-assent-1",
    });
    expect(result.evidenceIds).toHaveLength(3);
    expect(data.sessions[0]).toMatchObject({ consumedByType: "ROLE_ASSENT_BUNDLE", consumedById: "employee-assent-1" });
    expect(data.evidence.every((item) => item.actorRole === "EMPLOYEE")).toBe(true);
    expect(data.evidence.some((item) => item.policyKey.includes("recording-participation"))).toBe(false);
    const context = await loadEmployeeRoleAssentContext({
      db: data.db,
      userId: data.employee.userId,
      membershipId: data.employee.id,
      bookingId: data.booking.id,
    });
    await expect(getEmployeeRoleAssentStatus({ db: data.db, context })).resolves.toMatchObject({ current: true, decision: "ASSENT" });
  });

  it("rejects another principal and preserves decline as legal evidence only", async () => {
    const data = fixture();
    await expect(loadEmployeeRoleAssentContext({
      db: data.db,
      userId: "another-user",
      membershipId: data.employee.id,
      bookingId: data.booking.id,
    })).rejects.toThrow("EMPLOYEE_DECISION_CONTEXT_FORBIDDEN");

    const context = await loadEmployeeDecisionContext({
      db: data.db,
      purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT,
      userId: data.employee.userId,
      membershipId: data.employee.id,
      bookingId: data.booking.id,
    });
    const secret = "verified-decline-session";
    data.sessions.push({
      id: "verified-decline-session",
      secretHash: hashOpaqueSecret(secret),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT,
      contextHash: context.contextHash,
      userId: data.employee.userId,
      vendorId: data.employee.vendorId,
      membershipId: data.employee.id,
      membershipGeneration: data.employee.membershipGeneration,
      verifiedChannel: "email",
      verifiedContactHash: "e".repeat(64),
    });
    await recordEmployeeRoleAssent({
      db: data.db,
      userId: data.employee.userId,
      membershipId: data.employee.id,
      bookingId: data.booking.id,
      decision: "DECLINE",
      sessionSecret: secret,
      expectedServiceOrderContextHash: context.contextHash,
      acknowledgements: { identity: false, terms: false, privacy: false, electronicRecords: false },
      displayedContentSetHash: roleAssentContentSetHash("EMPLOYEE"),
      requestId: "employee-decline",
    });
    expect(data.evidence).toHaveLength(1);
    expect(data.evidence[0]).toMatchObject({
      actorRole: "EMPLOYEE",
      policyKey: "reliance.employee-accountless-role-assent",
      decision: "DECLINE",
    });
    expect(data.evidence[0].policyKey).not.toContain("recording-participation");
  });
});
