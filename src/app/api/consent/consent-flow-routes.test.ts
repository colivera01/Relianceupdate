import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashOpaqueSecret } from "@/lib/consent/token";
import { GET as getPermission } from "./[token]/route";
import { POST as allowPermission } from "./accept/route";
import { POST as declinePermission } from "./decline/route";

const hoisted = vi.hoisted(() => {
  const consentRequestLinkFindUnique = vi.fn();
  const consentRequestLinkUpdate = vi.fn();
  const consentRequestLinkUpdateMany = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const consentRecordUpdate = vi.fn();
  const consentEventCreate = vi.fn();
  const consentDecisionSessionFindUnique = vi.fn();
  const consentDecisionSessionUpdateMany = vi.fn();
  const consentDecisionEvidenceCreate = vi.fn();
  const bookingUpdate = vi.fn();
  const recordingScopeAssessmentFindFirst = vi.fn();
  const recordingAuthorityRequirementUpdateMany = vi.fn();
  const sendDecision = vi.fn();
  const getUserId = vi.fn();
  const prisma: any = {
    consentRequestLink: {
      findUnique: consentRequestLinkFindUnique,
      update: consentRequestLinkUpdate,
      updateMany: consentRequestLinkUpdateMany,
    },
    consentRecord: { findFirst: consentRecordFindFirst, update: consentRecordUpdate },
    consentEvent: { create: consentEventCreate },
    consentDecisionSession: {
      findUnique: consentDecisionSessionFindUnique,
      updateMany: consentDecisionSessionUpdateMany,
    },
    consentDecisionEvidence: { create: consentDecisionEvidenceCreate },
    booking: { update: bookingUpdate },
    recordingScopeAssessment: { findFirst: recordingScopeAssessmentFindFirst },
    recordingAuthorityRequirement: { updateMany: recordingAuthorityRequirementUpdateMany },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  return {
    prisma,
    consentRequestLinkFindUnique,
    consentRequestLinkUpdate,
    consentRequestLinkUpdateMany,
    consentRecordFindFirst,
    consentRecordUpdate,
    consentEventCreate,
    consentDecisionSessionFindUnique,
    consentDecisionSessionUpdateMany,
    consentDecisionEvidenceCreate,
    bookingUpdate,
    recordingScopeAssessmentFindFirst,
    recordingAuthorityRequirementUpdateMany,
    sendDecision,
    getUserId,
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: hoisted.getUserId }));
vi.mock("@/lib/notifications/send-consent-decision", () => ({
  sendConsentDecisionNotifications: hoisted.sendDecision,
}));

const ACTION_SECRET = "permission-action-secret";
const DECISION_SECRET = "permission-decision-secret";

function buildLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "link-1",
    consentRecordId: "permission-1",
    secretHash: hashOpaqueSecret(ACTION_SECRET),
    generation: 1,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    consentRecord: {
      id: "permission-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      generation: 1,
      status: "requested",
      lifecycleStatus: "DELIVERED",
      verifiedDecision: false,
      decisionEvidence: null,
      scopeHash: "scope-hash",
      recipientName: "Customer One",
      recipientEmailHash: "email-hash",
      recipientPhoneHash: null,
      recipientEmailMasked: "c***@example.com",
      recipientPhoneMasked: null,
      contentVersion: {
        version: "recording-permission-v1",
        contentHash: "content-hash",
        contentJson: JSON.stringify({ purpose: "Record proof of service" }),
      },
      vendor: { id: "vendor-1", name: "Vendor", businessName: "Vendor Co" },
      booking: {
        id: "booking-1",
        title: "Outlet Installation",
        scheduledFor: new Date("2026-07-31T14:00:00.000Z"),
        date: null,
        customerMetadata: JSON.stringify({ vendor_job_recording_location: "residence" }),
        service: { id: "service-1", name: "Outlet Installation" },
        user: null,
      },
    },
    ...overrides,
  };
}

function decisionRequest(path: string, body: Record<string, unknown>, withCookie = true) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withCookie ? { cookie: `reliance_permission_decision=${DECISION_SECRET}` } : {}),
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest-permission-flow",
    },
    body: JSON.stringify(body),
  });
}

describe("verified recording permission routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.consentRequestLinkFindUnique.mockResolvedValue(buildLink());
    hoisted.consentRequestLinkUpdate.mockResolvedValue({ id: "link-1" });
    hoisted.consentDecisionSessionFindUnique.mockResolvedValue({
      id: "session-1",
      consentRecordId: "permission-1",
      verificationMethod: "email_otp",
      verifiedContactHash: "email-hash",
      verifiedUserId: null,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    });
    hoisted.consentDecisionSessionUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "permission-1",
      scopeHash: "scope-hash",
      decisionEvidence: null,
    });
    hoisted.recordingScopeAssessmentFindFirst.mockResolvedValue({
      id: "assessment-1",
      generation: 1,
      authorityHolderType: "customer",
      locationType: "residence",
      scopeHash: "scope-hash",
      propertyScope: "customer_owned",
      peopleScope: "none",
      frameControl: "controlled",
      subjectJson: "{}",
      scopeJson: JSON.stringify({ authorityHolderType: "customer" }),
      serviceCanContinueWithoutRecording: true,
      essentialPrivateRecording: false,
    });
    hoisted.recordingAuthorityRequirementUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.consentDecisionEvidenceCreate.mockResolvedValue({ id: "evidence-1", actorUserId: null });
    hoisted.consentRecordUpdate.mockResolvedValue({ id: "permission-1", lifecycleStatus: "ALLOWED" });
    hoisted.consentRequestLinkUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.bookingUpdate.mockResolvedValue({ id: "booking-1" });
    hoisted.consentEventCreate.mockResolvedValue({ id: "event-1" });
    hoisted.sendDecision.mockResolvedValue({ notifications: [] });
    hoisted.getUserId.mockResolvedValue(null);
  });

  it("returns only identity-safe request details and never echoes the action secret", async () => {
    const response = await getPermission(new Request(`http://localhost/api/consent/${ACTION_SECRET}`), {
      params: Promise.resolve({ token: ACTION_SECRET }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.permission).toMatchObject({
      id: "permission-1",
      vendorName: "Vendor Co",
      serviceName: "Outlet Installation",
      initialAudience: "private",
      audioEnabled: false,
      canDecide: true,
      authorityRequirement: {
        expectedAuthority: "customer",
        permittedClaimedRoles: ["customer"],
        canAuthorizeInCurrentFlow: true,
      },
    });
    expect(JSON.stringify(json)).not.toContain(ACTION_SECRET);
    expect(JSON.stringify(json)).not.toContain("customer@example.com");
  });

  it("requires verified identity before allowing recording", async () => {
    const response = await allowPermission(
      decisionRequest(
        "/api/consent/accept",
        { token: ACTION_SECRET, claimedRole: "customer", authorityScope: "self_and_property" },
        false
      ) as any
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "IDENTITY_VERIFICATION_REQUIRED" });
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it("rejects a role paired with an inconsistent authority scope", async () => {
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", {
        token: ACTION_SECRET,
        claimedRole: "customer",
        authorityScope: "business_location_and_property",
      }) as any
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTHORITY_REQUIRED" });
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it("records one durable allow decision with Private initial audience and audio off", async () => {
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", {
        token: ACTION_SECRET,
        claimedRole: "customer",
        authorityScope: "self_and_property",
      }) as any
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.permission).toEqual({ state: "allowed", initialAudience: "private", audioEnabled: false });
    expect(hoisted.consentDecisionEvidenceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentRecordId: "permission-1",
        decision: "ALLOWED",
        claimedRole: "customer",
        authorityScope: "self_and_property",
        contentHash: "content-hash",
        scopeHash: "scope-hash",
      }),
    });
    const evidenceMetadata = JSON.parse(
      hoisted.consentDecisionEvidenceCreate.mock.calls[0][0].data.metadata,
    );
    expect(evidenceMetadata.authority).toMatchObject({
      schemaVersion: "recording-authority-evidence-v1",
      assessmentId: "assessment-1",
      assessmentGeneration: 1,
      expectedAuthority: "customer",
      claimedAuthority: "customer",
      expectedAndClaimedMatch: true,
      authorityVerified: true,
      substitutionRule: null,
    });
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: {
        customerMetadata: expect.stringContaining('"vendor_job_customer_visibility_choice":"private"'),
      },
    });
  });

  it("records a verified decline without creating a public or review outcome", async () => {
    const response = await declinePermission(
      decisionRequest("/api/consent/decline", {
        token: ACTION_SECRET,
        claimedRole: "customer",
        authorityScope: "self_and_property",
      }) as any
    );

    expect(response.status).toBe(200);
    expect(hoisted.consentDecisionEvidenceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ decision: "DECLINED" }),
    });
    const persisted = hoisted.bookingUpdate.mock.calls[0][0].data.customerMetadata;
    expect(persisted).toContain('"vendor_job_consent_accepted":false');
    expect(persisted).not.toContain("review");
    expect(persisted).not.toContain("public");
  });

  it.each([
    ["authorized_representative", "authorized_location_and_property"],
    ["guardian", "guardian_for_minor"],
    ["customer_business_representative", "business_location_and_property"],
  ])("rejects mismatched self-asserted %s authority before consuming verification", async (claimedRole, authorityScope) => {
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", { token: ACTION_SECRET, claimedRole, authorityScope }) as any,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTHORITY_MISMATCH" });
    expect(hoisted.consentDecisionSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the current assessment is missing or ambiguous", async () => {
    hoisted.recordingScopeAssessmentFindFirst.mockResolvedValue(null);
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", {
        token: ACTION_SECRET,
        claimedRole: "customer",
        authorityScope: "self_and_property",
      }) as any,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTHORITY_VERIFICATION_REQUIRED" });
    expect(hoisted.consentDecisionSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["authorized_representative", "residence", "authorized_representative", "authorized_location_and_property"],
    ["authorized_representative", "customer-business", "customer_business_representative", "business_location_and_property"],
    ["guardian", "residence", "guardian", "guardian_for_minor"],
  ])("requires independent evidence for expected %s authority", async (authorityHolderType, locationType, claimedRole, authorityScope) => {
    hoisted.recordingScopeAssessmentFindFirst.mockResolvedValue({
      id: "assessment-1",
      generation: 1,
      authorityHolderType,
      locationType,
      scopeHash: "scope-hash",
    });
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", { token: ACTION_SECRET, claimedRole, authorityScope }) as any,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTHORITY_VERIFICATION_REQUIRED" });
    expect(hoisted.consentDecisionSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it("describes unsupported expected authority without presenting it as approvable", async () => {
    hoisted.recordingScopeAssessmentFindFirst.mockResolvedValue({
      id: "assessment-guardian",
      generation: 1,
      authorityHolderType: "guardian",
      locationType: "residence",
      scopeHash: "scope-hash",
      propertyScope: "customer_owned",
      peopleScope: "customer",
      frameControl: "controlled",
      subjectJson: "{}",
      scopeJson: JSON.stringify({ authorityHolderType: "guardian" }),
      serviceCanContinueWithoutRecording: true,
      essentialPrivateRecording: false,
    });
    const response = await getPermission(new Request(`http://localhost/api/consent/${ACTION_SECRET}`), {
      params: Promise.resolve({ token: ACTION_SECRET }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.permission.authorityRequirement).toMatchObject({
      expectedAuthority: "guardian",
      permittedClaimedRoles: [],
      canAuthorizeInCurrentFlow: false,
    });
  });

  it("keeps expired action links locked", async () => {
    hoisted.consentRequestLinkFindUnique.mockResolvedValue(
      buildLink({ expiresAt: new Date(Date.now() - 1000) })
    );
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", {
        token: ACTION_SECRET,
        claimedRole: "customer",
        authorityScope: "self_and_property",
      }) as any
    );

    expect(response.status).toBe(409);
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });

  it("rejects a second decision when the verification session was already consumed", async () => {
    hoisted.consentDecisionSessionUpdateMany.mockResolvedValue({ count: 0 });
    const response = await allowPermission(
      decisionRequest("/api/consent/accept", {
        token: ACTION_SECRET,
        claimedRole: "customer",
        authorityScope: "self_and_property",
      }) as any
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "DECISION_SESSION_USED" });
    expect(hoisted.consentDecisionEvidenceCreate).not.toHaveBeenCalled();
  });
});
