export const REQUIRED_MEDIA_MODERATION_STAGE_KEYS = [
  "INTRO",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type RequiredMediaModerationStageKey =
  (typeof REQUIRED_MEDIA_MODERATION_STAGE_KEYS)[number];

export type MediaModerationQueueItem = {
  title?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  bookingId?: string | null;
  jobTitle?: string | null;
  bookingStatus?: string | null;
  clientName?: string | null;
  serviceName?: string | null;
  uploadedByMembershipId?: string | null;
  vendorJobVideoStageKey?: string | null;
  moderationStatus?: string | null;
  visibilityStatus?: string | null;
  createdAt?: Date | string | null;
};

export type MediaModerationPackage<TVideo extends MediaModerationQueueItem> = {
  packageId: string;
  bookingId: string;
  jobTitle: string;
  bookingStatus: string | null;
  vendorId: string;
  vendorName: string | null;
  clientName: string | null;
  serviceName: string | null;
  createdAt: Date | string | null;
  uploadedByMembershipIds: string[];
  moderationStatuses: string[];
  visibilityStatuses: string[];
  packageReadiness:
    | "READY_FOR_ADMIN_REVIEW"
    | "APPROVED"
    | "REJECTED_OR_FLAGGED";
  videosByStage: Record<RequiredMediaModerationStageKey, TVideo>;
};

type WorkingPackage<TVideo extends MediaModerationQueueItem> = {
  packageId: string;
  bookingId: string;
  jobTitle: string;
  bookingStatus: string | null;
  vendorId: string;
  vendorName: string | null;
  clientName: string | null;
  serviceName: string | null;
  createdAt: Date | string | null;
  uploadedByMembershipIds: Set<string>;
  stages: Partial<Record<RequiredMediaModerationStageKey, TVideo>>;
};

function createdAtTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizeLifecycleState(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function buildCompleteMediaModerationPackages<
  TVideo extends MediaModerationQueueItem,
>(items: TVideo[]): MediaModerationPackage<TVideo>[] {
  const grouped = new Map<string, WorkingPackage<TVideo>>();

  for (const item of items) {
    const bookingId = String(item.bookingId || "");
    if (!bookingId) continue;

    const stageKey = String(item.vendorJobVideoStageKey || "");
    if (
      !REQUIRED_MEDIA_MODERATION_STAGE_KEYS.includes(
        stageKey as RequiredMediaModerationStageKey
      )
    ) {
      continue;
    }

    if (!grouped.has(bookingId)) {
      grouped.set(bookingId, {
        packageId: bookingId,
        bookingId,
        jobTitle: item.jobTitle || item.title || "Untitled Job",
        bookingStatus: item.bookingStatus || null,
        vendorId: String(item.vendorId || ""),
        vendorName: item.vendorName || null,
        clientName: item.clientName || null,
        serviceName: item.serviceName || null,
        createdAt: item.createdAt || null,
        uploadedByMembershipIds: new Set<string>(),
        stages: {},
      });
    }

    const pack = grouped.get(bookingId)!;
    if (item.vendorName) pack.vendorName = item.vendorName;
    if (item.clientName) pack.clientName = item.clientName;
    if (item.serviceName) pack.serviceName = item.serviceName;
    if (item.bookingStatus) pack.bookingStatus = item.bookingStatus;
    if (item.uploadedByMembershipId) {
      pack.uploadedByMembershipIds.add(String(item.uploadedByMembershipId));
    }

    const typedStageKey = stageKey as RequiredMediaModerationStageKey;
    const current = pack.stages[typedStageKey];
    if (!current || createdAtTime(item.createdAt) > createdAtTime(current.createdAt)) {
      pack.stages[typedStageKey] = item;
    }

    if (createdAtTime(item.createdAt) > createdAtTime(pack.createdAt)) {
      pack.createdAt = item.createdAt || null;
    }
  }

  return Array.from(grouped.values())
    .filter((pack) =>
      REQUIRED_MEDIA_MODERATION_STAGE_KEYS.every((key) => Boolean(pack.stages[key]))
    )
    .map((pack) => {
      const videos = REQUIRED_MEDIA_MODERATION_STAGE_KEYS.map(
        (key) => pack.stages[key]!
      );
      const moderationStatuses = Array.from(
        new Set(
          videos.map((video) => String(video.moderationStatus || "pending_review"))
        )
      );
      const normalizedModerationStates = moderationStatuses.map((status) =>
        normalizeLifecycleState(status)
      );
      const allApproved = normalizedModerationStates.every(
        (status) => status === "approved"
      );
      const hasRejectedOrFlagged = normalizedModerationStates.some(
        (status) => status === "rejected" || status === "flagged"
      );

      return {
        packageId: pack.packageId,
        bookingId: pack.bookingId,
        jobTitle: pack.jobTitle,
        bookingStatus: pack.bookingStatus,
        vendorId: pack.vendorId,
        vendorName: pack.vendorName,
        clientName: pack.clientName,
        serviceName: pack.serviceName,
        createdAt: pack.createdAt,
        uploadedByMembershipIds: Array.from(pack.uploadedByMembershipIds),
        moderationStatuses,
        visibilityStatuses: Array.from(
          new Set(videos.map((video) => String(video.visibilityStatus || "private")))
        ),
        packageReadiness: allApproved
          ? ("APPROVED" as const)
          : hasRejectedOrFlagged
          ? ("REJECTED_OR_FLAGGED" as const)
          : ("READY_FOR_ADMIN_REVIEW" as const),
        videosByStage: {
          INTRO: pack.stages.INTRO!,
          IN_PROGRESS: pack.stages.IN_PROGRESS!,
          COMPLETED: pack.stages.COMPLETED!,
        },
      };
    });
}

export function isPendingMediaModerationPackage(
  pack: Pick<MediaModerationPackage<MediaModerationQueueItem>, "moderationStatuses">
): boolean {
  return pack.moderationStatuses.some(
    (status) => String(status || "").trim().toLowerCase() === "pending_review"
  );
}

export function countPendingMediaModerationPackages(
  packages: Array<Pick<MediaModerationPackage<MediaModerationQueueItem>, "moderationStatuses">>
): number {
  return packages.filter(isPendingMediaModerationPackage).length;
}
