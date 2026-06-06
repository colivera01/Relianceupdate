import {
  ARCHIVE_ACTIVE,
  MODERATION_APPROVED,
  MODERATION_FLAGGED,
  MODERATION_PENDING_REVIEW,
  MODERATION_REJECTED,
  VISIBILITY_CUSTOMER_ONLY,
  VISIBILITY_PUBLIC,
  normalizeArchiveStatus,
  normalizeModerationStatus,
  normalizeVisibilityStatus,
} from '@/lib/media-visibility';
import { isCompletedStatus, normalizeBookingStatusKey } from '@/lib/my-bookings';

type LifecycleAsset = {
  mimeType?: string | null;
  moderationStatus?: string | null;
  visibilityStatus?: string | null;
  archiveStatus?: string | null;
};

type LifecycleSession = {
  vendorJobVideoStage?: string | null;
  mediaAssets?: LifecycleAsset[] | null;
};

type LifecycleReviewWindow = {
  status?: string | null;
};

export type CustomerBookingLifecycle = {
  completedWorkMarked: boolean;
  videoSubmitted: boolean;
  videoApproved: boolean;
  videoAvailableToCustomer: boolean;
  videoPendingApproval: boolean;
  reviewWindowOpen: boolean;
  reviewSubmitted: boolean;
  reviewEligible: boolean;
  reviewSubmittedWithoutEligibleVideo: boolean;
  completedStageSessionCount: number;
  completedStageVideoAssetCount: number;
  completedStageApprovedVideoCount: number;
  completedStageCustomerVisibleApprovedVideoCount: number;
  completedStagePendingVideoCount: number;
  completedStageRejectedVideoCount: number;
  videoState:
    | 'available_to_customer'
    | 'pending_approval'
    | 'approved_not_customer_visible'
    | 'rejected'
    | 'not_submitted';
};

function isVideoAsset(asset: LifecycleAsset): boolean {
  return String(asset.mimeType || '').toLowerCase().startsWith('video/');
}

function isCustomerVisibleApprovedAsset(asset: LifecycleAsset): boolean {
  return (
    normalizeModerationStatus(asset.moderationStatus) === MODERATION_APPROVED &&
    normalizeArchiveStatus(asset.archiveStatus) === ARCHIVE_ACTIVE &&
    [VISIBILITY_PUBLIC, VISIBILITY_CUSTOMER_ONLY].includes(
      normalizeVisibilityStatus(asset.visibilityStatus)
    )
  );
}

function isCompletedStage(session: LifecycleSession): boolean {
  return String(session.vendorJobVideoStage || '').trim().toUpperCase() === 'COMPLETED';
}

export function deriveCustomerBookingLifecycle(input: {
  bookingStatus: string | null | undefined;
  mediaSessions?: LifecycleSession[] | null;
  hasSubmittedReview: boolean;
  reviewWindows?: LifecycleReviewWindow[] | null;
}): CustomerBookingLifecycle {
  const completedWorkMarked = isCompletedStatus(
    normalizeBookingStatusKey(input.bookingStatus)
  );
  const completedSessions = (input.mediaSessions || []).filter(isCompletedStage);
  const completedVideoAssets = completedSessions.flatMap((session) =>
    (session.mediaAssets || []).filter(isVideoAsset)
  );

  const completedStageSessionCount = completedSessions.length;
  const completedStageVideoAssetCount = completedVideoAssets.length;
  const completedStageApprovedVideoCount = completedVideoAssets.filter(
    (asset) => normalizeModerationStatus(asset.moderationStatus) === MODERATION_APPROVED
  ).length;
  const completedStageCustomerVisibleApprovedVideoCount = completedVideoAssets.filter(
    isCustomerVisibleApprovedAsset
  ).length;
  const completedStagePendingVideoCount = completedVideoAssets.filter((asset) => {
    const status = normalizeModerationStatus(asset.moderationStatus);
    return status === MODERATION_PENDING_REVIEW || status === MODERATION_FLAGGED;
  }).length;
  const completedStageRejectedVideoCount = completedVideoAssets.filter(
    (asset) => normalizeModerationStatus(asset.moderationStatus) === MODERATION_REJECTED
  ).length;

  let videoState: CustomerBookingLifecycle['videoState'] = 'not_submitted';
  if (completedStageCustomerVisibleApprovedVideoCount > 0) {
    videoState = 'available_to_customer';
  } else if (completedStagePendingVideoCount > 0) {
    videoState = 'pending_approval';
  } else if (completedStageApprovedVideoCount > 0) {
    videoState = 'approved_not_customer_visible';
  } else if (completedStageRejectedVideoCount > 0) {
    videoState = 'rejected';
  }

  const hasActiveReviewWindow = (input.reviewWindows || []).some(
    (window) => String(window.status || '').trim().toLowerCase() === 'active'
  );
  const reviewSubmitted = input.hasSubmittedReview;
  const reviewEligible =
    completedWorkMarked && completedStageCustomerVisibleApprovedVideoCount > 0;
  const reviewWindowOpen = hasActiveReviewWindow && reviewEligible && !reviewSubmitted;

  return {
    completedWorkMarked,
    videoSubmitted: completedStageVideoAssetCount > 0,
    videoApproved: completedStageApprovedVideoCount > 0,
    videoAvailableToCustomer: completedStageCustomerVisibleApprovedVideoCount > 0,
    videoPendingApproval: completedStagePendingVideoCount > 0,
    reviewWindowOpen,
    reviewSubmitted,
    reviewEligible,
    reviewSubmittedWithoutEligibleVideo: reviewSubmitted && !reviewEligible,
    completedStageSessionCount,
    completedStageVideoAssetCount,
    completedStageApprovedVideoCount,
    completedStageCustomerVisibleApprovedVideoCount,
    completedStagePendingVideoCount,
    completedStageRejectedVideoCount,
    videoState,
  };
}
