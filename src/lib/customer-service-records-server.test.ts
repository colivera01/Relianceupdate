import { describe, expect, it, vi } from 'vitest';
import { loadCustomerServiceRecords } from '@/lib/customer-service-records-server';

function booking(index: number, status: string, options: { service?: string; vendor?: string; vendorId?: string } = {}) {
  const date = new Date(Date.UTC(2026, 8, index + 1, 12));
  return {
    id: `booking-${String(index).padStart(2, '0')}`,
    userId: 'customer-1',
    vendorId: options.vendorId || `vendor-${index}`,
    serviceId: `service-${index}`,
    title: `Record ${index}`,
    clientName: 'Customer',
    amount: 100,
    status,
    scheduledFor: date,
    date,
    createdAt: date,
    updatedAt: date,
    customerMetadata: null,
    service: { id: `service-${index}`, name: options.service || `Service ${index}`, description: '', price: 100 },
    vendor: { id: options.vendorId || `vendor-${index}`, name: options.vendor || `Vendor ${index}`, businessName: null, phone: null, email: null, city: null, state: null },
    mediaSessions: [],
  };
}

function database(options: {
  bookings?: any[];
  organizationEvents?: any[];
  consents?: any[];
  packages?: any[];
  grants?: any[];
  reviews?: any[];
  visibility?: any[];
  outcomes?: any[];
  restrictions?: any[];
  adminDecisions?: any[];
  proposals?: any[];
} = {}) {
  return {
    booking: { findMany: vi.fn().mockResolvedValue(options.bookings || []) },
    customerServiceRecordOrganizationEvent: { findMany: vi.fn().mockResolvedValue(options.organizationEvents || []) },
    consentRecord: { findMany: vi.fn().mockResolvedValue(options.consents || []) },
    serviceVideoPackageEvidence: { findMany: vi.fn().mockResolvedValue(options.packages || []) },
    privateProofAccessGrant: { findMany: vi.fn().mockResolvedValue(options.grants || []) },
    review: { findMany: vi.fn().mockResolvedValue(options.reviews || []) },
    serviceVideoPackageVisibilityDecision: { findMany: vi.fn().mockResolvedValue(options.visibility || []) },
    vendorOperationalOutcome: { findMany: vi.fn().mockResolvedValue(options.outcomes || []) },
    mediaLifecycleRestriction: { findMany: vi.fn().mockResolvedValue(options.restrictions || []) },
    serviceVideoAdminAuditDecisionEvidence: { findMany: vi.fn().mockResolvedValue(options.adminDecisions || []) },
    serviceVideoPublicationProposal: { findMany: vi.fn().mockResolvedValue(options.proposals || []) },
  };
}

describe('customer Service Records server loader', () => {
  it('uses all owned records for canonical counts and tab-specific pagination', async () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, index) => booking(index + 1, 'PENDING')),
      ...Array.from({ length: 3 }, (_, index) => booking(index + 20, 'COMPLETED')),
      ...Array.from({ length: 2 }, (_, index) => booking(index + 30, 'CANCELLED')),
    ];
    const db = database({
      bookings: rows,
      organizationEvents: [{ id: 'archive-1', bookingId: 'booking-20', action: 'ARCHIVE', sequence: 1, evidenceHash: 'hash', actedAt: new Date() }],
      consents: [{
        id: 'consent-1', bookingId: 'booking-12', token: 'token-12', lifecycleStatus: 'PENDING', status: 'PENDING', verifiedDecision: false, expiresAt: new Date('2099-01-01'),
      }],
    });

    const first = await loadCustomerServiceRecords({ db, customerUserId: 'customer-1', requestedTab: 'upcoming', page: 1, limit: 5 });
    const second = await loadCustomerServiceRecords({ db, customerUserId: 'customer-1', requestedTab: 'upcoming', page: 2, limit: 5 });

    expect(first.counts).toEqual({ upcoming: 12, completed: 2, needs_attention: 1, cancelled: 2, archived: 1, unclassified: 0 });
    expect(first.pagination).toEqual({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(second.pagination.page).toBe(2);
    const ids = [...first.records, ...second.records].map((record) => record.id);
    expect(new Set(ids).size).toBe(10);
    expect(first.records.every((record) => record.customer_record.lifecycle === 'UPCOMING')).toBe(true);
    expect(db.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'customer-1' } }));
  });

  it('searches beyond the first page within the selected tab', async () => {
    const rows = Array.from({ length: 15 }, (_, index) => booking(
      index + 1,
      index === 14 ? 'COMPLETED' : 'PENDING',
      { service: index === 14 ? 'Needle in history' : `Common ${index}` }
    ));
    const db = database({ bookings: rows });
    const result = await loadCustomerServiceRecords({
      db,
      customerUserId: 'customer-1',
      requestedTab: 'completed',
      search: 'needle',
      page: 1,
      limit: 10,
    });
    expect(result.records.map((record) => record.id)).toEqual(['booking-15']);
    expect(result.pagination.total).toBe(1);
    expect(result.counts.upcoming).toBe(14);
  });

  it('scopes lifecycle counts, search, and pagination to a validated customer-owned business', async () => {
    const rows = [
      booking(1, 'PENDING', { vendorId: 'business-b', vendor: 'Bravo Plumbing', service: 'Pipe Repair' }),
      booking(2, 'COMPLETED', { vendorId: 'business-a', vendor: 'Electro LLC', service: 'Breaker Replacement' }),
      booking(3, 'COMPLETED', { vendorId: 'business-a', vendor: 'Electro LLC', service: 'Outlet Installation' }),
      booking(4, 'CANCELLED', { vendorId: 'business-a', vendor: 'Electro LLC', service: 'Panel Repair' }),
    ];
    const db = database({
      bookings: rows,
      organizationEvents: [{ id: 'archive-1', bookingId: 'booking-03', action: 'ARCHIVE', sequence: 1, evidenceHash: 'hash', actedAt: new Date() }],
    });

    const result = await loadCustomerServiceRecords({
      db,
      customerUserId: 'customer-1',
      businessId: 'business-a',
      requestedTab: 'completed',
      search: 'breaker',
      page: 1,
      limit: 1,
    });

    expect(result.businesses).toEqual([
      { id: 'business-b', name: 'Bravo Plumbing' },
      { id: 'business-a', name: 'Electro LLC' },
    ]);
    expect(result.selectedBusinessId).toBe('business-a');
    expect(result.counts).toEqual({ upcoming: 0, completed: 1, needs_attention: 0, cancelled: 1, archived: 1, unclassified: 0 });
    expect(result.records.map((record) => record.id)).toEqual(['booking-02']);
    expect(result.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
  });

  it('ignores a foreign business filter without revealing or excluding owned records', async () => {
    const db = database({ bookings: [booking(1, 'PENDING', { vendorId: 'owned-business', vendor: 'Owned Business' })] });
    const result = await loadCustomerServiceRecords({
      db,
      customerUserId: 'customer-1',
      businessId: 'foreign-business',
      requestedTab: 'upcoming',
    });

    expect(result.selectedBusinessId).toBeNull();
    expect(result.businesses).toEqual([{ id: 'owned-business', name: 'Owned Business' }]);
    expect(result.counts.upcoming).toBe(1);
    expect(result.records.map((record) => record.id)).toEqual(['booking-01']);
  });

  it('selects a useful default without forcing Needs Attention', async () => {
    const db = database({
      bookings: [booking(1, 'CONFIRMED')],
      consents: [{
        id: 'consent-1', bookingId: 'booking-01', token: 'token', lifecycleStatus: 'PENDING', status: 'PENDING', verifiedDecision: false, expiresAt: new Date('2099-01-01'),
      }],
    });
    const result = await loadCustomerServiceRecords({ db, customerUserId: 'customer-1' });
    expect(result.selectedTab).toBe('upcoming');
    expect(result.counts.needs_attention).toBe(1);
    expect(result.records[0].customer_record.attention.actionHref).toBe('/consent/token');
  });

  it('keeps unknown current states accessible only through the neutral fallback', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = database({ bookings: [booking(1, 'FUTURE_UNKNOWN')] });
    const result = await loadCustomerServiceRecords({ db, customerUserId: 'customer-1' });
    expect(result.selectedTab).toBe('unclassified');
    expect(result.counts).toMatchObject({ upcoming: 0, completed: 0, cancelled: 0, unclassified: 1 });
    expect(result.records[0].customer_record.lifecycleLabel).toBe('Status unavailable');
    expect(warn).toHaveBeenCalledWith('[customer-service-records] unsupported customer lifecycle status', expect.any(Object));
    warn.mockRestore();
  });

  it('derives video, review, and visibility independently from exact evidence', async () => {
    const row = booking(1, 'COMPLETED');
    const db = database({
      bookings: [row],
      packages: [{ id: 'package-1', bookingId: row.id, status: 'PRIVATE_APPROVED', adminAuditDecisionId: 'audit-1', customerAccessGrantId: 'grant-1' }],
      grants: [{ id: 'grant-1', bookingId: row.id, packageId: 'package-1', adminAuditDecisionId: 'audit-1' }],
      reviews: [{ id: 'review-1', bookingId: row.id, createdAt: new Date() }],
      visibility: [{ id: 'visibility-1', bookingId: row.id, decision: 'SHARE_PUBLICLY', publicationProposalId: 'proposal-1' }],
      adminDecisions: [{ id: 'audit-1', bookingId: row.id, packageId: 'package-1', decision: 'PASS' }],
      proposals: [{ id: 'proposal-1', bookingId: row.id, status: 'PUBLIC' }],
    });
    const result = await loadCustomerServiceRecords({ db, customerUserId: 'customer-1', requestedTab: 'completed' });
    expect(result.records[0].customer_record).toMatchObject({
      lifecycle: 'COMPLETED',
      video: { state: 'READY' },
      review: { state: 'REVIEWED' },
      visibility: { state: 'PUBLIC' },
    });
  });

  it('presents supported customer cancellation actor, reason, and time without inventing missing history', async () => {
    const row = {
      ...booking(1, 'CANCELED'),
      customerMetadata: JSON.stringify({
        vendor_job_cancellation: {
          source: 'CUSTOMER_CANCELLATION',
          canceled_by_user_id: 'customer-1',
          reason: 'Schedule changed',
          canceled_at: '2026-09-02T12:00:00.000Z',
        },
      }),
    };
    const db = database({ bookings: [row] });
    const result = await loadCustomerServiceRecords({ db, customerUserId: 'customer-1', requestedTab: 'cancelled' });
    expect(result.records[0].customer_record.cancellation).toEqual({
      actorLabel: 'Customer',
      reason: 'Schedule changed',
      cancelledAt: '2026-09-02T12:00:00.000Z',
    });
  });
});
