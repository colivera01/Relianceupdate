export const CUSTOMER_RECORD_LIFECYCLES = {
  UPCOMING: 'UPCOMING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  UNCLASSIFIED: 'UNCLASSIFIED',
} as const;

export const CUSTOMER_RECORD_ORGANIZATION = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  LEGACY_ARCHIVED: 'LEGACY_ARCHIVED',
} as const;

export type CustomerRecordLifecycle =
  (typeof CUSTOMER_RECORD_LIFECYCLES)[keyof typeof CUSTOMER_RECORD_LIFECYCLES];
export type CustomerRecordOrganization =
  (typeof CUSTOMER_RECORD_ORGANIZATION)[keyof typeof CUSTOMER_RECORD_ORGANIZATION];
export type CustomerRecordTab =
  | 'upcoming'
  | 'completed'
  | 'needs_attention'
  | 'cancelled'
  | 'archived'
  | 'unclassified';

export type CustomerRecordOrganizationEventLike = {
  id: string;
  action: string;
  sequence: number;
  evidenceHash?: string | null;
  actedAt?: Date | string | null;
};

export type CustomerRecordConsentLike = {
  id: string;
  token?: string | null;
  lifecycleStatus?: string | null;
  status?: string | null;
  verifiedDecision?: boolean | null;
  expiresAt?: Date | string | null;
};

export type CustomerRecordCancellationLike = {
  actorLabel?: string | null;
  reason?: string | null;
  cancelledAt?: Date | string | null;
};

export type CustomerServiceRecordState = {
  lifecycle: CustomerRecordLifecycle;
  lifecycleLabel: string;
  organization: CustomerRecordOrganization;
  archived: boolean;
  archiveEligible: boolean;
  restoreEligible: boolean;
  legacyRestoreBlocked: boolean;
  attention: {
    required: boolean;
    code: 'RECORDING_PERMISSION_REQUIRED' | null;
    reason: string | null;
    actionLabel: string | null;
    actionHref: string | null;
  };
  video: {
    state: 'PREPARING' | 'READY';
    label: 'Preparing' | 'Ready';
  };
  review: {
    state: 'LEAVE_REVIEW' | 'REVIEWED' | 'UNAVAILABLE';
    label: 'Leave a Review' | 'Reviewed' | 'Not Available Yet';
  };
  visibility: {
    state: 'PRIVATE' | 'PUBLIC';
    label: 'Private' | 'Public';
  };
  cancellation: {
    actorLabel: string | null;
    reason: string | null;
    cancelledAt: string | null;
  } | null;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function latestOrganizationEvent(
  events: CustomerRecordOrganizationEventLike[] | null | undefined
): CustomerRecordOrganizationEventLike | null {
  return [...(events || [])].sort((a, b) => {
    if (Number(a.sequence) !== Number(b.sequence)) return Number(b.sequence) - Number(a.sequence);
    return (asIso(b.actedAt) || '').localeCompare(asIso(a.actedAt) || '');
  })[0] || null;
}

function permissionNeedsCustomerAction(consent: CustomerRecordConsentLike | null | undefined): boolean {
  if (!consent?.token || consent.verifiedDecision === true) return false;
  if (!['PENDING', 'REQUESTED', 'DELIVERED'].includes(normalize(consent.lifecycleStatus || consent.status))) {
    return false;
  }
  const expiresAt = asIso(consent.expiresAt);
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

export function deriveCustomerServiceRecordState(input: {
  bookingStatus: string | null | undefined;
  hasExplicitCompletedEvidence?: boolean;
  organizationEvents?: CustomerRecordOrganizationEventLike[] | null;
  currentConsent?: CustomerRecordConsentLike | null;
  adminAuditDecision?: string | null;
  packageStatus?: string | null;
  activePrivateProofGrant?: boolean;
  legacyCustomerVisibleVideo?: boolean;
  reviewSubmitted?: boolean;
  currentVisibilityDecision?: string | null;
  publicationStatus?: string | null;
  publicRestrictionActive?: boolean;
  cancellation?: CustomerRecordCancellationLike | null;
}): CustomerServiceRecordState {
  const bookingStatus = normalize(input.bookingStatus);
  const legacyArchived = bookingStatus === 'ARCHIVED';
  const completedEvidence = input.hasExplicitCompletedEvidence === true;
  const cancelled = bookingStatus === 'CANCELED' || bookingStatus === 'CANCELLED';
  const explicitlyCompleted = bookingStatus === 'COMPLETED' || bookingStatus === 'COMPLETE';
  const packageCompleted =
    completedEvidence &&
    ['AWAITING_REVIEW', 'AWAITING_MANAGER_REVIEW', 'REJECTED', 'ADMIN_REJECTED'].includes(bookingStatus);

  let lifecycle: CustomerRecordLifecycle;
  if (cancelled) {
    lifecycle = CUSTOMER_RECORD_LIFECYCLES.CANCELLED;
  } else if (explicitlyCompleted || packageCompleted) {
    lifecycle = CUSTOMER_RECORD_LIFECYCLES.COMPLETED;
  } else if (legacyArchived) {
    lifecycle = input.cancellation
      ? CUSTOMER_RECORD_LIFECYCLES.CANCELLED
      : completedEvidence
        ? CUSTOMER_RECORD_LIFECYCLES.COMPLETED
        : CUSTOMER_RECORD_LIFECYCLES.UNCLASSIFIED;
  } else if (['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(bookingStatus)) {
    lifecycle = CUSTOMER_RECORD_LIFECYCLES.UPCOMING;
  } else {
    lifecycle = CUSTOMER_RECORD_LIFECYCLES.UNCLASSIFIED;
  }

  const latestEvent = latestOrganizationEvent(input.organizationEvents);
  const organization = legacyArchived
    ? CUSTOMER_RECORD_ORGANIZATION.LEGACY_ARCHIVED
    : normalize(latestEvent?.action) === 'ARCHIVE'
      ? CUSTOMER_RECORD_ORGANIZATION.ARCHIVED
      : CUSTOMER_RECORD_ORGANIZATION.ACTIVE;
  const archived = organization !== CUSTOMER_RECORD_ORGANIZATION.ACTIVE;

  const attentionRequired = !archived && permissionNeedsCustomerAction(input.currentConsent);
  const auditPassed = normalize(input.adminAuditDecision) === 'PASS';
  const packageApproved = normalize(input.packageStatus) === 'PRIVATE_APPROVED';
  const videoReady =
    (auditPassed && packageApproved && input.activePrivateProofGrant === true) ||
    input.legacyCustomerVisibleVideo === true;
  const publicNow =
    normalize(input.currentVisibilityDecision) === 'SHARE_PUBLICLY' &&
    normalize(input.publicationStatus) === 'PUBLIC' &&
    input.publicRestrictionActive !== true;
  const reviewSubmitted = input.reviewSubmitted === true;
  const reviewAvailable = lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED && videoReady;
  const archiveLifecycleEligible =
    lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED ||
    lifecycle === CUSTOMER_RECORD_LIFECYCLES.CANCELLED;

  const lifecycleLabel = lifecycle === CUSTOMER_RECORD_LIFECYCLES.UPCOMING
    ? 'Upcoming'
    : lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED
      ? 'Completed'
      : lifecycle === CUSTOMER_RECORD_LIFECYCLES.CANCELLED
        ? 'Cancelled'
        : 'Status unavailable';

  return {
    lifecycle,
    lifecycleLabel,
    organization,
    archived,
    archiveEligible: !archived && archiveLifecycleEligible,
    restoreEligible:
      organization === CUSTOMER_RECORD_ORGANIZATION.ARCHIVED &&
      archiveLifecycleEligible,
    legacyRestoreBlocked: organization === CUSTOMER_RECORD_ORGANIZATION.LEGACY_ARCHIVED,
    attention: attentionRequired
      ? {
          required: true,
          code: 'RECORDING_PERMISSION_REQUIRED',
          reason: 'Recording permission needed',
          actionLabel: 'Review recording request',
          actionHref: `/consent/${encodeURIComponent(String(input.currentConsent?.token || ''))}`,
        }
      : { required: false, code: null, reason: null, actionLabel: null, actionHref: null },
    video: videoReady
      ? { state: 'READY', label: 'Ready' }
      : { state: 'PREPARING', label: 'Preparing' },
    review: reviewSubmitted
      ? { state: 'REVIEWED', label: 'Reviewed' }
      : reviewAvailable
        ? { state: 'LEAVE_REVIEW', label: 'Leave a Review' }
        : { state: 'UNAVAILABLE', label: 'Not Available Yet' },
    visibility: publicNow
      ? { state: 'PUBLIC', label: 'Public' }
      : { state: 'PRIVATE', label: 'Private' },
    cancellation: lifecycle === CUSTOMER_RECORD_LIFECYCLES.CANCELLED
      ? {
          actorLabel: input.cancellation?.actorLabel || null,
          reason: input.cancellation?.reason || null,
          cancelledAt: asIso(input.cancellation?.cancelledAt),
        }
      : null,
  };
}

export function customerRecordMatchesTab(
  state: CustomerServiceRecordState,
  tab: CustomerRecordTab
): boolean {
  if (tab === 'archived') return state.archived;
  if (state.archived) return false;
  if (tab === 'needs_attention') return state.attention.required;
  if (tab === 'upcoming') return state.lifecycle === CUSTOMER_RECORD_LIFECYCLES.UPCOMING;
  if (tab === 'completed') return state.lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED;
  if (tab === 'cancelled') return state.lifecycle === CUSTOMER_RECORD_LIFECYCLES.CANCELLED;
  return state.lifecycle === CUSTOMER_RECORD_LIFECYCLES.UNCLASSIFIED;
}
