import { deriveCustomerReviewEligibility } from '@/lib/customer-review-eligibility';

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

export type CustomerServiceRequestLifecycleLike = {
  state?: string | null;
  requested_at?: Date | string | null;
  requested_scheduled_for?: Date | string | null;
  responded_at?: Date | string | null;
  response_reason?: string | null;
  proposed_scheduled_for?: Date | string | null;
  customer_responded_at?: Date | string | null;
  customer_response_reason?: string | null;
};

export type CustomerServiceRequestPresentation = {
  state:
    | 'REQUESTED'
    | 'ACCEPTED'
    | 'COUNTEROFFERED'
    | 'SCHEDULED'
    | 'DECLINED'
    | 'CANCELLED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'UNKNOWN';
  label: string;
  detail: string;
  needsResponse: boolean;
  responseReason: string | null;
  proposedScheduledFor: string | null;
  requestedScheduledFor: string | null;
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
    code: 'RECORDING_PERMISSION_REQUIRED' | 'COUNTEROFFER_RESPONSE_REQUIRED' | null;
    reason: string | null;
    actionLabel: string | null;
    actionHref: string | null;
  };
  recordingPermission: {
    state: 'NOT_REQUIRED' | 'ACTION_REQUIRED' | 'PENDING' | 'ALLOWED' | 'DECLINED' | 'EXPIRED' | 'DELIVERY_FAILED' | 'WRONG_RECIPIENT' | 'SUPERSEDED' | 'UNAVAILABLE';
    label: string;
    detail: string;
    actionHref: string | null;
  } | null;
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
  request: CustomerServiceRequestPresentation;
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

function recordingPermissionPresentation(
  consent: CustomerRecordConsentLike | null | undefined,
  actionRequired: boolean,
  permissionRequired: boolean | null | undefined
): CustomerServiceRecordState['recordingPermission'] {
  if (permissionRequired === false) {
    return {
      state: 'NOT_REQUIRED',
      label: 'Customer recording permission was not required',
      detail: 'The approved recording scope for this Service Order did not require a customer recording decision. Public sharing is controlled by a separate customer choice.',
      actionHref: null,
    };
  }
  if (!consent) return null;
  const status = normalize(consent.lifecycleStatus || consent.status);
  const expiresAt = asIso(consent.expiresAt);
  const expired = status === 'EXPIRED' ||
    (['PENDING', 'REQUESTED', 'DELIVERED'].includes(status) &&
      Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now()));

  if (status === 'ALLOWED' && consent.verifiedDecision === true) {
    return {
      state: 'ALLOWED',
      label: 'Recording allowed',
      detail: 'The verified customer contact allowed the approved recording scope. This does not authorize Public sharing.',
      actionHref: null,
    };
  }
  if (status === 'DECLINED') {
    return {
      state: 'DECLINED',
      label: 'Recording declined',
      detail: 'The customer declined recording for this Reliance work record. Recording remains locked.',
      actionHref: null,
    };
  }
  if (expired) {
    return {
      state: 'EXPIRED',
      label: 'Recording request expired',
      detail: 'The secure decision link expired. Contact the business to request a new link if recording is still needed.',
      actionHref: null,
    };
  }
  if (status === 'WRONG_RECIPIENT') {
    return {
      state: 'WRONG_RECIPIENT',
      label: 'Recipient correction needed',
      detail: 'This request was reported as misdirected. The business must correct the customer contact before sending another request.',
      actionHref: null,
    };
  }
  if (status === 'DELIVERY_FAILED') {
    return {
      state: 'DELIVERY_FAILED',
      label: 'Recording request not delivered',
      detail: 'The secure request could not be delivered. Contact the business to correct the customer contact.',
      actionHref: null,
    };
  }
  if (status === 'SUPERSEDED') {
    return {
      state: 'SUPERSEDED',
      label: 'Recording request replaced',
      detail: 'A newer recording request replaced this one. Use the latest secure link from the business.',
      actionHref: null,
    };
  }
  if (['PENDING', 'REQUESTED', 'DELIVERED'].includes(status)) {
    return actionRequired
      ? {
          state: 'ACTION_REQUIRED',
          label: 'Recording decision needed',
          detail: 'Review the approved recording scope and decide whether Reliance may record. Recording stays locked until the required decision is verified.',
          actionHref: `/consent/${encodeURIComponent(String(consent.token))}`,
        }
      : {
          state: 'PENDING',
          label: 'Recording request pending',
          detail: 'A secure recording decision is pending. Ask the business to confirm the current request if you need help.',
          actionHref: null,
        };
  }
  return {
    state: 'UNAVAILABLE',
    label: 'Recording status unavailable',
    detail: 'Ask the business to confirm the current recording-permission status.',
    actionHref: null,
  };
}

export function deriveCustomerServiceRecordState(input: {
  bookingId?: string | null;
  bookingStatus: string | null | undefined;
  bookingSource?: string | null;
  scheduledFor?: Date | string | null;
  hasExplicitCompletedEvidence?: boolean;
  organizationEvents?: CustomerRecordOrganizationEventLike[] | null;
  currentConsent?: CustomerRecordConsentLike | null;
  recordingPermissionRequired?: boolean | null;
  adminAuditDecision?: string | null;
  packageStatus?: string | null;
  activePrivateProofGrant?: boolean;
  reviewSubmitted?: boolean;
  currentVisibilityDecision?: string | null;
  publicationStatus?: string | null;
  publicRestrictionActive?: boolean;
  cancellation?: CustomerRecordCancellationLike | null;
  requestLifecycle?: CustomerServiceRequestLifecycleLike | null;
}): CustomerServiceRecordState {
  const bookingStatus = normalize(input.bookingStatus);
  const requestLifecycleState = normalize(input.requestLifecycle?.state);
  const scheduledFor = asIso(input.scheduledFor);
  const vendorCreatedScheduled =
    bookingStatus === 'PENDING' &&
    requestLifecycleState === '' &&
    normalize(input.bookingSource) === 'VENDOR_CREATED_JOB' &&
    Boolean(scheduledFor);
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

  const recordingPermissionNeedsAction =
    !archived && lifecycle === CUSTOMER_RECORD_LIFECYCLES.UPCOMING &&
    permissionNeedsCustomerAction(input.currentConsent);
  const recordingPermission = recordingPermissionPresentation(
    input.currentConsent,
    recordingPermissionNeedsAction,
    input.recordingPermissionRequired
  );
  const auditPassed = normalize(input.adminAuditDecision) === 'PASS';
  const packageApproved = normalize(input.packageStatus) === 'PRIVATE_APPROVED';
  const videoReady =
    auditPassed && packageApproved && input.activePrivateProofGrant === true;
  const publicNow =
    normalize(input.currentVisibilityDecision) === 'SHARE_PUBLICLY' &&
    normalize(input.publicationStatus) === 'PUBLIC' &&
    input.publicRestrictionActive !== true;
  const reviewSubmitted = input.reviewSubmitted === true;
  const reviewEligibility = deriveCustomerReviewEligibility({
    bookingId: 'customer-record',
    ownsBooking: true,
    serviceCompleted: lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED,
    privateProofAvailable: videoReady,
    existingReviewId: reviewSubmitted ? 'submitted-review' : null,
    mediaSessionId: videoReady ? 'approved-package' : null,
  });
  const reviewAvailable = reviewEligibility.eligible;
  const archiveLifecycleEligible =
    lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED ||
    lifecycle === CUSTOMER_RECORD_LIFECYCLES.CANCELLED;

  let request: CustomerServiceRequestPresentation;
  if (requestLifecycleState === 'CANCELED' || requestLifecycleState === 'CANCELLED') {
    request = {
      state: 'CANCELLED',
      label: 'Cancelled',
      detail: 'This service request is no longer active.',
      needsResponse: false,
      responseReason: String(input.requestLifecycle?.response_reason || input.cancellation?.reason || '').trim() || null,
      proposedScheduledFor: asIso(input.requestLifecycle?.proposed_scheduled_for),
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (requestLifecycleState === 'VENDOR_DECLINED' || requestLifecycleState === 'CUSTOMER_DECLINED') {
    request = {
      state: 'DECLINED',
      label: requestLifecycleState === 'VENDOR_DECLINED' ? 'Declined by business' : 'Proposed time declined',
      detail: requestLifecycleState === 'VENDOR_DECLINED'
        ? 'The business could not accept this service request.'
        : 'You declined the proposed appointment time.',
      needsResponse: false,
      responseReason: String(
        input.requestLifecycle?.customer_response_reason || input.requestLifecycle?.response_reason || ''
      ).trim() || null,
      proposedScheduledFor: asIso(input.requestLifecycle?.proposed_scheduled_for),
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (cancelled) {
    request = {
      state: 'CANCELLED',
      label: 'Cancelled',
      detail: 'This service request is no longer active.',
      needsResponse: false,
      responseReason: String(input.requestLifecycle?.response_reason || input.cancellation?.reason || '').trim() || null,
      proposedScheduledFor: asIso(input.requestLifecycle?.proposed_scheduled_for),
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (requestLifecycleState === 'COUNTEROFFERED') {
    request = {
      state: 'COUNTEROFFERED',
      label: 'New time proposed',
      detail: 'The business proposed a different appointment time. Review it before the request can be scheduled.',
      needsResponse: true,
      responseReason: String(input.requestLifecycle?.response_reason || '').trim() || null,
      proposedScheduledFor: asIso(input.requestLifecycle?.proposed_scheduled_for),
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (requestLifecycleState === 'VENDOR_ACCEPTED') {
    request = {
      state: 'ACCEPTED',
      label: 'Accepted by business',
      detail: 'The business accepted your request. Your appointment details are now confirmed.',
      needsResponse: false,
      responseReason: String(input.requestLifecycle?.response_reason || '').trim() || null,
      proposedScheduledFor: asIso(input.requestLifecycle?.proposed_scheduled_for),
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (requestLifecycleState === 'SCHEDULED') {
    request = {
      state: 'SCHEDULED',
      label: 'Scheduled',
      detail: 'The appointment time is confirmed with the business.',
      needsResponse: false,
      responseReason: String(input.requestLifecycle?.response_reason || '').trim() || null,
      proposedScheduledFor: asIso(input.requestLifecycle?.proposed_scheduled_for),
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (vendorCreatedScheduled) {
    request = {
      state: 'SCHEDULED',
      label: 'Scheduled by business',
      detail: 'The business created this Service Record for the scheduled appointment.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: scheduledFor,
    };
  } else if (requestLifecycleState === 'REQUESTED' || bookingStatus === 'PENDING') {
    request = {
      state: 'REQUESTED',
      label: 'Awaiting business response',
      detail: 'Your request was sent. The business still needs to accept it or propose a different time.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (bookingStatus === 'CONFIRMED') {
    request = {
      state: 'ACCEPTED',
      label: 'Accepted by business',
      detail: 'The business accepted your request. Your appointment details are now confirmed.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (bookingStatus === 'IN_PROGRESS') {
    request = {
      state: 'IN_PROGRESS',
      label: 'Service in progress',
      detail: 'The business marked this service as in progress.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else if (lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED) {
    request = {
      state: 'COMPLETED',
      label: 'Completed',
      detail: 'This service is complete.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  } else {
    request = {
      state: 'UNKNOWN',
      label: legacyArchived ? 'Archived historical record' : 'Status unavailable',
      detail: 'The current service request status is unavailable.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: asIso(input.requestLifecycle?.requested_scheduled_for),
    };
  }

  const lifecycleLabel = lifecycle === CUSTOMER_RECORD_LIFECYCLES.UPCOMING
    ? request.label
    : lifecycle === CUSTOMER_RECORD_LIFECYCLES.COMPLETED
      ? 'Completed'
      : lifecycle === CUSTOMER_RECORD_LIFECYCLES.CANCELLED
        ? 'Cancelled'
        : legacyArchived
          ? 'Archived historical record'
          : 'Status unavailable';

  const attention: CustomerServiceRecordState['attention'] = recordingPermissionNeedsAction
    ? {
        required: true,
        code: 'RECORDING_PERMISSION_REQUIRED',
        reason: 'Recording permission needed',
        actionLabel: 'Review recording request',
        actionHref: recordingPermission?.actionHref || null,
      }
    : !archived && lifecycle === CUSTOMER_RECORD_LIFECYCLES.UPCOMING && request.needsResponse
      ? {
          required: true,
          code: 'COUNTEROFFER_RESPONSE_REQUIRED',
          reason: 'Your response to the proposed time is needed',
          actionLabel: 'Review proposed time',
          actionHref: input.bookingId
            ? `/my-bookings/${encodeURIComponent(input.bookingId)}#request-status-heading`
            : null,
        }
      : { required: false, code: null, reason: null, actionLabel: null, actionHref: null };

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
    attention,
    recordingPermission,
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
    request,
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
