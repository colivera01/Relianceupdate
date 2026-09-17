export function membershipActivationData(input: {
  currentStatus: string | null | undefined;
  currentGeneration: number | null | undefined;
  approvedByUserId?: string | null;
  now?: Date;
}) {
  const now = input.now || new Date();
  const status = String(input.currentStatus || "").trim().toUpperCase();
  const reactivation = ["DENIED", "REVOKED", "REMOVED", "INACTIVE"].includes(status);
  return {
    status: "ACTIVE",
    approvedAt: now,
    approvedByUserId: input.approvedByUserId || undefined,
    ...(reactivation
      ? {
          membershipGeneration: {
            increment: 1,
          },
        }
      : {}),
  };
}
