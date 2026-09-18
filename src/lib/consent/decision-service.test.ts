import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));

import { permissionDecisionRetryMatches } from "./decision-service";

function fixture() {
  const record = {
    id: "consent-1",
    isCurrent: true,
    supersededAt: null,
    scopeHash: "scope-1",
  };
  const session = {
    consumedAt: new Date("2026-09-17T12:00:00.000Z"),
    verificationMethod: "email_otp",
    verifiedContactHash: "contact-1",
    verifiedUserId: "customer-1",
  };
  const evidence = {
    decision: "ALLOWED",
    requestHash: "request-1",
    scopeHash: "scope-1",
    contentHash: "content-1",
    contentVersion: "recording-permission-v3-video-only",
    claimedRole: "customer",
    authorityScope: "self_and_property",
    verificationMethod: "email_otp",
    verifiedContactHash: "contact-1",
    actorUserId: "customer-1",
  };
  return {
    record,
    session,
    evidence,
    decision: "allow" as const,
    claimedRole: "customer",
    authorityScope: "self_and_property",
    requestHash: "request-1",
    contentHash: "content-1",
    contentVersion: "recording-permission-v3-video-only",
  };
}

describe("Customer recording decision idempotency", () => {
  it("recognizes an exact authenticated retry as the same canonical decision", () => {
    expect(permissionDecisionRetryMatches(fixture())).toBe(true);
  });

  it.each([
    ["changed decision", { decision: "decline" }],
    ["changed scope", { record: { ...fixture().record, scopeHash: "scope-2" } }],
    ["changed request", { requestHash: "request-2" }],
    ["changed text", { contentHash: "content-2" }],
    ["changed role", { claimedRole: "authorized_representative" }],
    ["changed verified identity", {
      session: { ...fixture().session, verifiedContactHash: "contact-2" },
    }],
    ["superseded context", { record: { ...fixture().record, isCurrent: false } }],
  ])("fails closed for %s", (_label, override) => {
    expect(permissionDecisionRetryMatches({ ...fixture(), ...override } as any)).toBe(false);
  });
});
