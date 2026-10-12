export type RetentionDryRunAction =
  | "NO_SCHEDULE_REQUIRES_REVIEW"
  | "WOULD_REQUIRE_SCHEDULE_RECALCULATION"
  | "WOULD_RETAIN_UNDER_ACTIVE_HOLD"
  | "EXISTING_DISPOSITION_IN_PROGRESS"
  | "WOULD_RETAIN_UNTIL_EXISTING_DATE"
  | "WOULD_BE_DUE_FOR_DISPOSITION_REVIEW"
  | "WOULD_KEEP_PUBLIC_APPROVAL_ACTIVE";

const ACTIVE_HOLD_STATUSES = new Set(["ACTIVE", "REVIEW_DUE", "EXTENDED"]);
const ACTIVE_DISPOSITION_STATUSES = new Set([
  "REQUESTED",
  "ACCESS_RESTRICTED",
  "RETENTION_REVIEW",
  "HELD",
  "QUEUED",
  "ATTEMPTING",
  "VERIFYING",
  "RETRY_REQUIRED",
]);

export function resolvePublicToPrivateRetentionDryRun(input: {
  schedule: any | null | undefined;
  activeHold?: any | null;
  activeDeletion?: any | null;
  now?: Date;
}) {
  const now = input.now || new Date();
  const schedule = input.schedule || null;
  let action: RetentionDryRunAction;
  let reason: string;
  if (!schedule) {
    action = "NO_SCHEDULE_REQUIRES_REVIEW";
    reason = "No existing retention schedule is available; no date was inferred.";
  } else if (input.activeHold && ACTIVE_HOLD_STATUSES.has(String(input.activeHold.status || "").toUpperCase())) {
    action = "WOULD_RETAIN_UNDER_ACTIVE_HOLD";
    reason = "An existing evidence hold would prevent disposition.";
  } else if (
    input.activeDeletion &&
    ACTIVE_DISPOSITION_STATUSES.has(String(input.activeDeletion.status || "").toUpperCase())
  ) {
    action = "EXISTING_DISPOSITION_IN_PROGRESS";
    reason = "An existing disposition workflow already governs this media.";
  } else if (schedule.approvalActive || String(schedule.materialClass || "").toUpperCase() === "PUBLIC_MEDIA") {
    action = "WOULD_REQUIRE_SCHEDULE_RECALCULATION";
    reason = "The existing schedule reflects Public approval; dry-run does not invent or write a replacement date.";
  } else if (!schedule.retainUntil) {
    action = "NO_SCHEDULE_REQUIRES_REVIEW";
    reason = "The existing non-Public schedule has no disposition date; no date was inferred.";
  } else if (new Date(schedule.retainUntil).getTime() > now.getTime()) {
    action = "WOULD_RETAIN_UNTIL_EXISTING_DATE";
    reason = "The existing stored retention date is still in the future.";
  } else {
    action = "WOULD_BE_DUE_FOR_DISPOSITION_REVIEW";
    reason = "The existing stored retention date is due; no deletion or queue write was performed.";
  }
  return {
    dryRun: true,
    mutating: false,
    mediaAssetId: schedule?.mediaAssetId || null,
    scheduleId: schedule?.id || null,
    action,
    reason,
    existingRetainUntil: schedule?.retainUntil || null,
    existingEvidenceRetainUntil: schedule?.evidenceRetainUntil || null,
    holdId: input.activeHold?.id || null,
    deletionRequestId: input.activeDeletion?.id || null,
  };
}

export async function loadRetentionWorkerDryRun(input: {
  db: any;
  now?: Date;
  limit?: number;
}) {
  const now = input.now || new Date();
  const limit = Math.max(1, Math.min(Number(input.limit || 25), 100));
  const schedules = await input.db.mediaRetentionSchedule.findMany({
    where: { status: "ACTIVE", approvalActive: false, retainUntil: { lte: now } },
    orderBy: { retainUntil: "asc" },
    take: limit,
  });
  const items = [];
  for (const schedule of schedules) {
    const [currentPublic, activeHold, activeDeletion] = await Promise.all([
      input.db.publicServiceVideoEligibility?.findFirst
        ? input.db.publicServiceVideoEligibility.findFirst({
            where: { mediaAssetId: schedule.mediaAssetId, status: "ACTIVE", invalidatedAt: null },
            select: { id: true },
          })
        : null,
      input.db.mediaEvidenceHold.findFirst({
        where: {
          bookingId: schedule.bookingId,
          OR: [{ mediaAssetId: schedule.mediaAssetId }, { mediaAssetId: null }],
          status: { in: Array.from(ACTIVE_HOLD_STATUSES) },
        },
        select: { id: true, status: true },
      }),
      input.db.mediaDeletionRequest.findFirst({
        where: {
          mediaAssetId: schedule.mediaAssetId,
          status: { in: Array.from(ACTIVE_DISPOSITION_STATUSES) },
        },
        orderBy: { requestedAt: "desc" },
        select: { id: true, status: true },
      }),
    ]);
    if (currentPublic) {
      items.push({
        dryRun: true,
        mutating: false,
        scheduleId: schedule.id,
        mediaAssetId: schedule.mediaAssetId,
        action: "WOULD_KEEP_PUBLIC_APPROVAL_ACTIVE" as RetentionDryRunAction,
        reason: "Canonical Public eligibility is still active; no schedule update was performed.",
        publicEligibilityId: currentPublic.id,
      });
      continue;
    }
    items.push(resolvePublicToPrivateRetentionDryRun({ schedule, activeHold, activeDeletion, now }));
  }
  const counts = items.reduce<Record<string, number>>((summary, item) => {
    summary[item.action] = (summary[item.action] || 0) + 1;
    return summary;
  }, {});
  return {
    dryRun: true,
    mutating: false,
    generatedAt: now.toISOString(),
    candidateCount: items.length,
    counts,
    items,
  };
}
