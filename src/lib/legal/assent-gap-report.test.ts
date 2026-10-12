import { describe, expect, it, vi } from "vitest";

import { legalEvidenceSha256 } from "./legal-evidence-core";
import { roleAssentChainKey } from "./governed-content-evidence";
import {
  buildRoleAssentGapInventory,
  loadRoleAssentGapInventory,
  type RoleAssentRequirement,
} from "./assent-gap-report";

function requirement(overrides: Partial<RoleAssentRequirement> = {}): RoleAssentRequirement {
  return {
    requirementKey: "vendor-terms:principal-1",
    actorPrincipalId: "principal-1",
    actorRole: "VENDOR_MANAGER",
    contentVersionId: "content-1",
    policyKey: "VENDOR_TERMS",
    policyVersion: "draft-1",
    contentHash: legalEvidenceSha256("snapshot"),
    contextType: "VENDOR_MEMBERSHIP",
    contextId: "membership-1",
    contextHash: legalEvidenceSha256({ vendorId: "vendor-1", membershipGeneration: 1 }),
    ...overrides,
  };
}

function evidenceFor(req: RoleAssentRequirement, overrides: Record<string, unknown> = {}) {
  return {
    id: "evidence-1",
    actorPrincipalId: req.actorPrincipalId,
    actorRole: req.actorRole,
    contentVersionId: req.contentVersionId,
    policyKey: req.policyKey,
    policyVersion: req.policyVersion,
    contentHash: req.contentHash,
    contextType: req.contextType,
    contextId: req.contextId,
    contextHash: req.contextHash,
    chainKey: roleAssentChainKey({
      actorPrincipalId: req.actorPrincipalId,
      actorRole: req.actorRole,
      contentKey: req.policyKey,
      contextType: req.contextType,
      contextId: req.contextId,
    }),
    sequence: 1,
    decision: "ASSENT",
    ...overrides,
  };
}

describe("read-only role assent gap inventory", () => {
  it("reports exact current coverage without inferring from other evidence", () => {
    const covered = requirement();
    const missing = requirement({
      requirementKey: "employee-terms:principal-2",
      actorPrincipalId: "principal-2",
      actorRole: "EMPLOYEE",
      contextId: "membership-2",
    });
    const result = buildRoleAssentGapInventory({
      requirements: [covered, missing],
      evidence: [evidenceFor(covered)],
    });
    expect(result.counts).toEqual({ COVERED: 1, DECLINED: 0, MISSING: 1, STALE_OR_MISMATCHED: 0 });
    expect(result.items.map((item) => [item.requirementKey, item.status])).toEqual([
      [covered.requirementKey, "COVERED"],
      [missing.requirementKey, "MISSING"],
    ]);
  });

  it("uses the latest append-only decision and reports decline", () => {
    const req = requirement();
    const result = buildRoleAssentGapInventory({
      requirements: [req],
      evidence: [
        evidenceFor(req, { id: "allow-1", sequence: 1, decision: "ASSENT" }),
        evidenceFor(req, { id: "decline-2", sequence: 2, decision: "DECLINE" }),
      ],
    });
    expect(result.items[0]).toMatchObject({ status: "DECLINED", evidenceId: "decline-2", evidenceSequence: 2 });
  });

  it("does not treat stale policy or context evidence as coverage", () => {
    const req = requirement();
    const result = buildRoleAssentGapInventory({
      requirements: [req],
      evidence: [evidenceFor(req, { contentVersionId: "older-content" })],
    });
    expect(result.items[0].status).toBe("STALE_OR_MISMATCHED");
  });

  it("loads only matching chains and never invokes a write delegate", async () => {
    const req = requirement();
    const findMany = vi.fn().mockResolvedValue([evidenceFor(req)]);
    const write = vi.fn(() => { throw new Error("write not allowed"); });
    const db = {
      roleAssentEvidence: { findMany, create: write, update: write, updateMany: write, delete: write },
    };
    const result = await loadRoleAssentGapInventory({ db, requirements: [req] });
    expect(result.items[0].status).toBe("COVERED");
    expect(findMany).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects duplicate requirement keys instead of collapsing gaps", () => {
    const req = requirement();
    expect(() => buildRoleAssentGapInventory({ requirements: [req, req], evidence: [] }))
      .toThrow(`ROLE_ASSENT_REQUIREMENT_DUPLICATE:${req.requirementKey}`);
  });
});
