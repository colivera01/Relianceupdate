import {
  normalizeVendorJobVideoStage,
  resolveVendorJobVideoStageFromSession,
} from "@/lib/vendor-job-video-stages";

type MediaSessionStageShape = {
  vendorJobVideoStage?: string | null;
  sessionType?: string | null;
};

/**
 * Customer/public proof policy:
 * - Non-staged media can remain visible (existing behavior).
 * - Staged job video media is only surfaced when it is COMPLETED.
 * - INTRO / IN_PROGRESS do not become customer/public proof defaults.
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
  return inferredStage === "COMPLETED";
}

export function isCompletedStageProofVideo(session: MediaSessionStageShape | null | undefined): boolean {
  const stage = resolveVendorJobVideoStageFromSession({
    vendorJobVideoStage: session?.vendorJobVideoStage,
    sessionType: session?.sessionType,
  });
  return stage === "COMPLETED";
}

