import {
  normalizeVendorJobVideoStage,
  resolveVendorJobVideoStageFromSession,
  VENDOR_JOB_VIDEO_STAGES,
  type VendorJobVideoStage,
} from "@/lib/vendor-job-video-stages";

type MediaSessionStageShape = {
  vendorJobVideoStage?: string | null;
  sessionType?: string | null;
};

/**
 * Customer/public proof policy:
 * - Non-staged media can remain visible (existing behavior).
 * - Staged job video media is surfaced for all timeline stages when already
 *   approved and customer-visible by moderation/visibility filters.
 */
export function shouldIncludeAssetForCustomerPublicProof(session: MediaSessionStageShape | null | undefined): boolean {
  const normalizedStage = normalizeVendorJobVideoStage(session?.vendorJobVideoStage);
  const sessionType = String(session?.sessionType || "").trim().toUpperCase();
  const inferredStage = resolveVendorJobVideoStageFromSession({
    vendorJobVideoStage: session?.vendorJobVideoStage,
    sessionType,
  });
  const isStagedJobVideo = Boolean(normalizedStage) || sessionType === "JOB_SERVICE_VIDEO";

  if (!isStagedJobVideo) return true;
  return inferredStage === "INTRO" || inferredStage === "IN_PROGRESS" || inferredStage === "COMPLETED";
}

export function isCompletedStageProofVideo(session: MediaSessionStageShape | null | undefined): boolean {
  const stage = resolveVendorJobVideoStageFromSession({
    vendorJobVideoStage: session?.vendorJobVideoStage,
    sessionType: session?.sessionType,
  });
  return stage === "COMPLETED";
}

type PublicProofPackageAsset = {
  id?: string | null;
  mimeType?: string | null;
  mediaSession?: (MediaSessionStageShape & {
    bookingId?: string | null;
    serviceId?: string | null;
  }) | null;
};

/**
 * Resolves one complete canonical package per Service without combining stages
 * from different work records. Callers must pass only canonical Public assets.
 */
export function groupCompletePublicProofPackagesByService<T extends PublicProofPackageAsset>(
  assets: T[]
): Map<string, T[]> {
  const groups = new Map<
    string,
    { serviceId: string; stages: Map<VendorJobVideoStage, T[]> }
  >();

  for (const asset of assets) {
    if (!String(asset?.mimeType || "").startsWith("video/")) continue;
    if (!shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)) continue;
    const serviceId = String(asset?.mediaSession?.serviceId || "").trim();
    const bookingId = String(asset?.mediaSession?.bookingId || "").trim();
    const stage = resolveVendorJobVideoStageFromSession(asset?.mediaSession || {});
    if (!serviceId || !bookingId || !VENDOR_JOB_VIDEO_STAGES.includes(stage as VendorJobVideoStage)) {
      continue;
    }

    const key = `${serviceId}:${bookingId}`;
    const group = groups.get(key) || { serviceId, stages: new Map<VendorJobVideoStage, T[]>() };
    const rows = group.stages.get(stage as VendorJobVideoStage) || [];
    rows.push(asset);
    group.stages.set(stage as VendorJobVideoStage, rows);
    groups.set(key, group);
  }

  const completeByServiceId = new Map<string, T[]>();
  groups.forEach((group) => {
    if (completeByServiceId.has(group.serviceId)) return;
    if (!VENDOR_JOB_VIDEO_STAGES.every((stage) => group.stages.get(stage)?.length === 1)) return;
    completeByServiceId.set(
      group.serviceId,
      VENDOR_JOB_VIDEO_STAGES.map((stage) => group.stages.get(stage)![0])
    );
  });
  return completeByServiceId;
}

