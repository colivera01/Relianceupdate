import { roleAssentChainKey } from "./governed-content-evidence";
import { requireLegalEvidenceText, requireSha256 } from "./legal-evidence-core";

export type RoleAssentRequirement = {
  requirementKey: string;
  actorPrincipalId: string;
  actorRole: string;
  contentVersionId: string;
  policyKey: string;
  policyVersion: string;
  contentHash: string;
  contextType: string;
  contextId: string;
  contextHash: string;
};

export type RoleAssentCoverageStatus =
  | "COVERED"
  | "DECLINED"
  | "MISSING"
  | "STALE_OR_MISMATCHED";

function normalizedRequirement(requirement: RoleAssentRequirement) {
  const actorPrincipalId = requireLegalEvidenceText(requirement.actorPrincipalId, "actorPrincipalId");
  const actorRole = requireLegalEvidenceText(requirement.actorRole, "actorRole").toUpperCase();
  const policyKey = requireLegalEvidenceText(requirement.policyKey, "policyKey");
  const contextType = requireLegalEvidenceText(requirement.contextType, "contextType").toUpperCase();
  const contextId = requireLegalEvidenceText(requirement.contextId, "contextId");
  return {
    ...requirement,
    requirementKey: requireLegalEvidenceText(requirement.requirementKey, "requirementKey"),
    actorPrincipalId,
    actorRole,
    contentVersionId: requireLegalEvidenceText(requirement.contentVersionId, "contentVersionId"),
    policyKey,
    policyVersion: requireLegalEvidenceText(requirement.policyVersion, "policyVersion"),
    contentHash: requireSha256(requirement.contentHash, "contentHash"),
    contextType,
    contextId,
    contextHash: requireSha256(requirement.contextHash, "contextHash"),
    chainKey: roleAssentChainKey({ actorPrincipalId, actorRole, contentKey: policyKey, contextType, contextId }),
  };
}

export function buildRoleAssentGapInventory(input: {
  requirements: RoleAssentRequirement[];
  evidence: any[];
}) {
  const seenRequirementKeys = new Set<string>();
  const items = input.requirements.map((raw) => {
    const requirement = normalizedRequirement(raw);
    if (seenRequirementKeys.has(requirement.requirementKey)) {
      throw new Error(`ROLE_ASSENT_REQUIREMENT_DUPLICATE:${requirement.requirementKey}`);
    }
    seenRequirementKeys.add(requirement.requirementKey);
    const chain = input.evidence
      .filter((row) => row.chainKey === requirement.chainKey)
      .sort((left, right) => Number(right.sequence || 0) - Number(left.sequence || 0));
    const latest = chain[0] || null;
    let status: RoleAssentCoverageStatus = "MISSING";
    if (latest) {
      const exact =
        latest.actorPrincipalId === requirement.actorPrincipalId &&
        String(latest.actorRole || "").toUpperCase() === requirement.actorRole &&
        latest.contentVersionId === requirement.contentVersionId &&
        latest.policyKey === requirement.policyKey &&
        latest.policyVersion === requirement.policyVersion &&
        latest.contentHash === requirement.contentHash &&
        String(latest.contextType || "").toUpperCase() === requirement.contextType &&
        latest.contextId === requirement.contextId &&
        latest.contextHash === requirement.contextHash;
      status = !exact
        ? "STALE_OR_MISMATCHED"
        : latest.decision === "ASSENT"
          ? "COVERED"
          : latest.decision === "DECLINE"
            ? "DECLINED"
            : "STALE_OR_MISMATCHED";
    }
    return {
      requirementKey: requirement.requirementKey,
      actorPrincipalId: requirement.actorPrincipalId,
      actorRole: requirement.actorRole,
      policyKey: requirement.policyKey,
      policyVersion: requirement.policyVersion,
      contextType: requirement.contextType,
      contextId: requirement.contextId,
      status,
      evidenceId: latest?.id || null,
      evidenceSequence: latest ? Number(latest.sequence) : null,
    };
  });
  const counts = items.reduce<Record<RoleAssentCoverageStatus, number>>(
    (summary, item) => ({ ...summary, [item.status]: summary[item.status] + 1 }),
    { COVERED: 0, DECLINED: 0, MISSING: 0, STALE_OR_MISMATCHED: 0 },
  );
  return { generatedAt: new Date().toISOString(), readOnly: true, counts, items };
}

export async function loadRoleAssentGapInventory(input: {
  db: any;
  requirements: RoleAssentRequirement[];
}) {
  const normalized = input.requirements.map(normalizedRequirement);
  const chainKeys = Array.from(new Set(normalized.map((item) => item.chainKey)));
  const evidence = chainKeys.length
    ? await input.db.roleAssentEvidence.findMany({
        where: { chainKey: { in: chainKeys } },
        orderBy: [{ chainKey: "asc" }, { sequence: "desc" }],
      })
    : [];
  return buildRoleAssentGapInventory({ requirements: input.requirements, evidence });
}
