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

  it('marks only an actionable current recording request as Needs Attention', () => {
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
