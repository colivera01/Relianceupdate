export function buildEmployeeDecisionSubmission(input: {
  membershipId: string;
  decision: "ALLOW" | "DECLINE" | "DENY";
  contextHash?: string | null;
}) {
  return {
    membershipId: input.membershipId,
    decision: input.decision,
    ...(input.contextHash ? { contextHash: input.contextHash } : {}),
  };
}
