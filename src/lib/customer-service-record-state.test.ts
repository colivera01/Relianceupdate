import { describe, expect, it } from 'vitest';
import {
  customerRecordMatchesTab,
  deriveCustomerServiceRecordState,
} from '@/lib/customer-service-record-state';

function resolve(overrides: Partial<Parameters<typeof deriveCustomerServiceRecordState>[0]> = {}) {
  return deriveCustomerServiceRecordState({ ...overrides, bookingStatus: overrides.bookingStatus ?? 'PENDING' });
}

describe('customer Service Record canonical state', () => {
  it.each(['PENDING', 'CONFIRMED', 'IN_PROGRESS'])('classifies recognized active %s as Upcoming', (bookingStatus) => {
    expect(resolve({ bookingStatus }).lifecycle).toBe('UPCOMING');
  });

  it.each(['COMPLETED', 'COMPLETE'])('requires explicit completed status for %s', (bookingStatus) => {
    expect(resolve({ bookingStatus }).lifecycle).toBe('COMPLETED');
  });

  it.each(['CANCELED', 'CANCELLED'])('classifies canonical cancellation %s', (bookingStatus) => {
    expect(resolve({ bookingStatus }).lifecycle).toBe('CANCELLED');
  });

  it('does not silently classify unknown or internal wait states', () => {
    expect(resolve({ bookingStatus: 'SOMETHING_NEW' }).lifecycle).toBe('UNCLASSIFIED');
    expect(resolve({ bookingStatus: 'AWAITING_REVIEW' }).lifecycle).toBe('UNCLASSIFIED');
    expect(resolve({ bookingStatus: 'AWAITING_REVIEW', hasExplicitCompletedEvidence: true }).lifecycle).toBe('COMPLETED');
  });

  it('does not use dates, video, review, or visibility to change lifecycle', () => {
    const state = resolve({
      bookingStatus: 'PENDING',
      adminAuditDecision: 'PASS',
      packageStatus: 'PRIVATE_APPROVED',
      activePrivateProofGrant: true,
      reviewSubmitted: true,
      currentVisibilityDecision: 'SHARE_PUBLICLY',
      publicationStatus: 'PUBLIC',
    });
    expect(state.lifecycle).toBe('UPCOMING');
    expect(state.video.state).toBe('READY');
    expect(state.review.state).toBe('REVIEWED');
    expect(state.visibility.state).toBe('PUBLIC');
  });

  it('distinguishes request states without collapsing them into Upcoming', () => {
    expect(resolve({ bookingStatus: 'PENDING', requestLifecycle: { state: 'REQUESTED' } }).request).toMatchObject({
      state: 'REQUESTED',
      label: 'Awaiting business response',
      needsResponse: false,
    });
    expect(resolve({ bookingStatus: 'CONFIRMED', requestLifecycle: { state: 'VENDOR_ACCEPTED' } }).request).toMatchObject({
      state: 'ACCEPTED',
      label: 'Accepted by business',
    });
    expect(resolve({
      bookingStatus: 'PENDING',
      bookingId: 'booking-counteroffer',
      requestLifecycle: {
        state: 'COUNTEROFFERED',
        proposed_scheduled_for: '2026-11-03T15:00:00.000Z',
        response_reason: 'The morning is already booked',
      },
    }).request).toMatchObject({
      state: 'COUNTEROFFERED',
      label: 'New time proposed',
      needsResponse: true,
      proposedScheduledFor: '2026-11-03T15:00:00.000Z',
      responseReason: 'The morning is already booked',
    });
    const counteroffer = resolve({
      bookingId: 'booking-counteroffer',
      bookingStatus: 'PENDING',
      requestLifecycle: { state: 'COUNTEROFFERED', proposed_scheduled_for: '2026-11-03T15:00:00.000Z' },
    });
    expect(counteroffer.attention).toEqual({
      required: true,
      code: 'COUNTEROFFER_RESPONSE_REQUIRED',
      reason: 'Your response to the proposed time is needed',
      actionLabel: 'Review proposed time',
      actionHref: '/my-bookings/booking-counteroffer#request-status-heading',
    });
    expect(customerRecordMatchesTab(counteroffer, 'needs_attention')).toBe(true);
    expect(resolve({ bookingStatus: 'CANCELLED', requestLifecycle: { state: 'VENDOR_DECLINED' } }).request).toMatchObject({
      state: 'DECLINED',
      label: 'Declined by business',
    });
    expect(resolve({ bookingStatus: 'CANCELLED', requestLifecycle: { state: 'VENDOR_ACCEPTED' } }).request).toMatchObject({
      state: 'CANCELLED',
      label: 'Cancelled',
    });
  });

  it('presents a vendor-created pending appointment as scheduled instead of a customer request awaiting acceptance', () => {
    const state = resolve({
      bookingStatus: 'PENDING',
      bookingSource: 'vendor_created_job',
      scheduledFor: '2026-11-03T16:00:00.000Z',
      requestLifecycle: null,
    });

    expect(state.request).toEqual({
      state: 'SCHEDULED',
      label: 'Scheduled by business',
      detail: 'The business created this Service Record for the scheduled appointment.',
      needsResponse: false,
      responseReason: null,
      proposedScheduledFor: null,
      requestedScheduledFor: '2026-11-03T16:00:00.000Z',
    });
    expect(state.lifecycle).toBe('UPCOMING');
    expect(state.lifecycleLabel).toBe('Scheduled by business');
  });

  it('does not infer vendor-created scheduling without both authoritative source and appointment evidence', () => {
    expect(resolve({
      bookingStatus: 'PENDING',
      bookingSource: 'vendor_created_job',
      scheduledFor: null,
      requestLifecycle: null,
    }).request.state).toBe('REQUESTED');
    expect(resolve({
      bookingStatus: 'PENDING',
      bookingSource: 'customer_booking',
      scheduledFor: '2026-11-03T16:00:00.000Z',
      requestLifecycle: null,
    }).request.state).toBe('REQUESTED');
  });

  it('marks an actionable current recording request as Needs Attention', () => {
    const state = resolve({
      bookingStatus: 'CONFIRMED',
      currentConsent: {
        id: 'consent-1',
        token: 'real-token',
        lifecycleStatus: 'PENDING',
        verifiedDecision: false,
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    });
    expect(state.attention).toEqual({
      required: true,
      code: 'RECORDING_PERMISSION_REQUIRED',
      reason: 'Recording permission needed',
      actionLabel: 'Review recording request',
      actionHref: '/consent/real-token',
    });
    expect(customerRecordMatchesTab(state, 'upcoming')).toBe(true);
    expect(customerRecordMatchesTab(state, 'needs_attention')).toBe(true);
    expect(state.recordingPermission).toMatchObject({
      state: 'ACTION_REQUIRED',
      label: 'Recording decision needed',
      actionHref: '/consent/real-token',
    });
  });

  it('shows a verified recording decision on Service Record detail without offering the secure action again', () => {
    const allowed = resolve({
      bookingStatus: 'CONFIRMED',
      recordingPermissionRequired: true,
      currentConsent: { id: 'consent-allowed', lifecycleStatus: 'ALLOWED', verifiedDecision: true, token: 'used-token' },
    });
    expect(allowed.recordingPermission).toMatchObject({ state: 'ALLOWED', label: 'Recording allowed', actionHref: null });
    expect(allowed.attention.required).toBe(false);

    const declined = resolve({
      bookingStatus: 'CANCELED',
      currentConsent: { id: 'consent-declined', lifecycleStatus: 'DECLINED', verifiedDecision: true, token: 'used-token' },
    });
    expect(declined.recordingPermission).toMatchObject({ state: 'DECLINED', label: 'Recording declined', actionHref: null });
    expect(declined.attention.required).toBe(false);
  });

  it('shows that customer recording permission was not required only from explicit canonical evidence', () => {
    const notRequired = resolve({
      bookingStatus: 'COMPLETED',
      recordingPermissionRequired: false,
      currentConsent: null,
    });

    expect(notRequired.recordingPermission).toEqual({
      state: 'NOT_REQUIRED',
      label: 'Customer recording permission was not required',
      detail: 'The approved recording scope for this Service Order did not require a customer recording decision. Public sharing is controlled by a separate customer choice.',
      actionHref: null,
    });
    expect(notRequired.attention.required).toBe(false);
  });

  it('does not infer that recording permission was unnecessary when the assessment is absent', () => {
    expect(resolve({
      bookingStatus: 'COMPLETED',
      currentConsent: null,
    }).recordingPermission).toBeNull();
  });

  it('keeps expired or cancelled permission requests out of Needs Attention', () => {
    const expired = resolve({
      bookingStatus: 'CONFIRMED',
      currentConsent: { id: 'consent-expired', lifecycleStatus: 'DELIVERED', token: 'old-token', expiresAt: '2020-01-01T00:00:00.000Z' },
    });
    expect(expired.recordingPermission).toMatchObject({ state: 'EXPIRED', actionHref: null });
    expect(expired.attention.required).toBe(false);

    const cancelled = resolve({
      bookingStatus: 'CANCELED',
      currentConsent: { id: 'consent-pending', lifecycleStatus: 'DELIVERED', token: 'token', expiresAt: '2099-01-01T00:00:00.000Z' },
    });
    expect(cancelled.attention.required).toBe(false);
    expect(cancelled.recordingPermission?.actionHref).toBeNull();
  });

  it('keeps both customer actions visible when a counteroffer and recording request coexist', () => {
    const state = resolve({
      bookingId: 'booking-both',
      bookingStatus: 'PENDING',
      requestLifecycle: { state: 'COUNTEROFFERED', proposed_scheduled_for: '2026-11-03T15:00:00.000Z' },
      currentConsent: {
        id: 'consent-both',
        lifecycleStatus: 'DELIVERED',
        token: 'secure-link',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    });

    expect(state.attention.code).toBe('RECORDING_PERMISSION_REQUIRED');
    expect(state.request.needsResponse).toBe(true);
    expect(state.recordingPermission?.actionHref).toBe('/consent/secure-link');
    expect(customerRecordMatchesTab(state, 'needs_attention')).toBe(true);
  });

  it.each([
    { lifecycleStatus: 'ALLOWED', verifiedDecision: true },
    { lifecycleStatus: 'WRONG_RECIPIENT', verifiedDecision: true },
    { lifecycleStatus: 'SUPERSEDED', verifiedDecision: false },
  ])('does not invent customer action for non-pending permission evidence', (consent) => {
    expect(resolve({ bookingStatus: 'CONFIRMED', currentConsent: { id: 'c', token: 't', ...consent } }).attention.required).toBe(false);
  });

  it('does not treat optional review, public sharing, or internal package waits as Needs Attention', () => {
    const state = resolve({
      bookingStatus: 'COMPLETED',
      hasExplicitCompletedEvidence: true,
      packageStatus: 'AWAITING_ADMIN_REVIEW',
      reviewSubmitted: false,
      currentVisibilityDecision: null,
    });
    expect(state.attention.required).toBe(false);
    expect(state.video.state).toBe('PREPARING');
    expect(state.review.state).toBe('UNAVAILABLE');
    expect(state.visibility.state).toBe('PRIVATE');
  });

  it('treats Admin rejection as completed evidence, not cancellation', () => {
    const state = resolve({
      bookingStatus: 'COMPLETED',
      hasExplicitCompletedEvidence: true,
      packageStatus: 'ADMIN_REJECTED',
      adminAuditDecision: 'REJECT',
    });
    expect(state.lifecycle).toBe('COMPLETED');
    expect(state.cancellation).toBeNull();
  });

  it('requires the exact approved proof chain before showing video Ready', () => {
    expect(resolve({ bookingStatus: 'COMPLETED', packageStatus: 'PRIVATE_APPROVED', activePrivateProofGrant: true }).video.state).toBe('PREPARING');
    expect(resolve({ bookingStatus: 'COMPLETED', packageStatus: 'PRIVATE_APPROVED', adminAuditDecision: 'PASS' }).video.state).toBe('PREPARING');
    expect(resolve({ bookingStatus: 'COMPLETED', packageStatus: 'PRIVATE_APPROVED', adminAuditDecision: 'PASS', activePrivateProofGrant: true }).video.state).toBe('READY');
  });

  it('does not advertise legacy visible media without a current private access grant', () => {
    const legacyInput = {
      bookingStatus: 'COMPLETED',
      legacyCustomerVisibleVideo: true,
      packageStatus: 'PRIVATE_APPROVED',
      adminAuditDecision: 'PASS',
      activePrivateProofGrant: false,
    };
    const state = resolve(legacyInput);
    expect(state.video.state).toBe('PREPARING');
    expect(state.review.state).toBe('UNAVAILABLE');
  });

  it('keeps organization independent from completed lifecycle and proof dimensions', () => {
    const state = resolve({
      bookingStatus: 'COMPLETED',
      organizationEvents: [{ id: 'event-1', action: 'ARCHIVE', sequence: 1 }],
      packageStatus: 'PRIVATE_APPROVED',
      adminAuditDecision: 'PASS',
      activePrivateProofGrant: true,
      reviewSubmitted: true,
      currentVisibilityDecision: 'SHARE_PUBLICLY',
      publicationStatus: 'PUBLIC',
    });
    expect(state.lifecycle).toBe('COMPLETED');
    expect(state.archived).toBe(true);
    expect(state.video.state).toBe('READY');
    expect(state.review.state).toBe('REVIEWED');
    expect(state.visibility.state).toBe('PUBLIC');
    expect(customerRecordMatchesTab(state, 'completed')).toBe(false);
    expect(customerRecordMatchesTab(state, 'archived')).toBe(true);
  });

  it('uses the latest append-only organization event', () => {
    const restored = resolve({
      bookingStatus: 'CANCELLED',
      organizationEvents: [
        { id: 'restore', action: 'RESTORE', sequence: 2 },
        { id: 'archive', action: 'ARCHIVE', sequence: 1 },
      ],
    });
    expect(restored.archived).toBe(false);
    expect(restored.lifecycle).toBe('CANCELLED');
    expect(restored.archiveEligible).toBe(true);
  });

  it('keeps legacy ARCHIVED readable and blocks an unsafe restore', () => {
    const unknown = resolve({ bookingStatus: 'ARCHIVED' });
    expect(unknown.archived).toBe(true);
    expect(unknown.lifecycle).toBe('UNCLASSIFIED');
    expect(unknown.lifecycleLabel).toBe('Archived historical record');
    expect(unknown.legacyRestoreBlocked).toBe(true);
    expect(unknown.restoreEligible).toBe(false);

    const provenCompleted = resolve({ bookingStatus: 'ARCHIVED', hasExplicitCompletedEvidence: true });
    expect(provenCompleted.lifecycle).toBe('COMPLETED');
    expect(provenCompleted.legacyRestoreBlocked).toBe(true);
  });

  it('presents cancellation provenance only when cancellation is canonical', () => {
    const state = resolve({
      bookingStatus: 'CANCELED',
      cancellation: { actorLabel: 'Customer', reason: 'Schedule changed', cancelledAt: '2026-09-02T12:00:00.000Z' },
    });
    expect(state.cancellation).toEqual({
      actorLabel: 'Customer',
      reason: 'Schedule changed',
      cancelledAt: '2026-09-02T12:00:00.000Z',
    });
  });
});
