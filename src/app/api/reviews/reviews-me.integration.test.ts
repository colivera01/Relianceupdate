import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './me/route';

const h = vi.hoisted(() => ({
  reviews: vi.fn(),
  records: vi.fn(),
}));

vi.mock('@/server/db', () => ({ prisma: { review: { findMany: h.reviews } } }));
vi.mock('@/lib/auth', () => ({ getUserIdFromRequest: vi.fn(async () => 'customer-1') }));
vi.mock('@/lib/account-status', () => ({
  AccountStatusError: class AccountStatusError extends Error { statusCode = 403; },
  accountStatusErrorBody: vi.fn(() => ({ success: false })),
  ensureUserAccountCanAct: vi.fn(async () => undefined),
}));
vi.mock('@/lib/customer-service-records-server', () => ({ loadCustomerServiceRecords: h.records }));

function review(index: number) {
  return {
    id: `review-${index}`,
    bookingId: `booking-${index}`,
    vendorId: 'vendor-1',
    rating: 4,
    comment: `Owner comment ${index}`,
    date: new Date(`2026-08-${String((index % 20) + 1).padStart(2, '0')}T12:00:00.000Z`),
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    moderationStatus: 'pending_review',
    visibilityStatus: 'private',
    contractVersion: 2,
    ratingValidityStatus: 'verified',
    ratingInvalidationReason: null,
    vendor: { name: 'Electro', businessName: 'Electro LLC' },
    booking: { service: { name: `Service ${index}` } },
    employeeCustomerRating: index === 1
      ? { rating: 3, employeeNameSnapshot: 'Bradley Coopers', submittedAt: new Date('2026-08-02T12:00:00.000Z') }
      : null,
  };
}

describe('GET /api/reviews/me', () => {
  beforeEach(() => {
    h.records.mockReset().mockResolvedValue({
      records: [{
        id: 'ready-booking', title: 'Outlet Installation', booking_date: '2026-08-30',
        service: { name: 'Outlet Installation' }, vendor: { id: 'vendor-1', name: 'Electro LLC' },
        customer_record: { lifecycle: 'COMPLETED', archived: true, review: { state: 'LEAVE_REVIEW' } },
      }],
    });
    h.reviews.mockReset().mockResolvedValue(Array.from({ length: 15 }, (_, index) => review(index + 1)));
  });

  it('returns full submitted counts while paginating owner history', async () => {
    const response = await GET(new Request('http://localhost/api/reviews/me?submittedPage=2&limit=5'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.counts).toMatchObject({ ready: 1, submitted: 15 });
    expect(body.submitted).toHaveLength(5);
    expect(body.pagination.submitted).toEqual({ page: 2, limit: 5, total: 15, totalPages: 3 });
  });

  it('shows the customer their submitted text and optional professional rating before public moderation', async () => {
    const response = await GET(new Request('http://localhost/api/reviews/me?limit=20'));
    const body = await response.json();
    expect(body.submitted[0]).toMatchObject({
      rating: 4,
      comment: 'Owner comment 1',
      commentStatus: 'CHECKING',
      ratingStatus: 'COUNTED',
      employeeRating: { rating: 3, employeeName: 'Bradley Coopers' },
    });
  });

  it('searches the complete review history before pagination', async () => {
    const response = await GET(new Request('http://localhost/api/reviews/me?search=Service%2014&limit=5'));
    const body = await response.json();
    expect(body.counts.submitted).toBe(1);
    expect(body.submitted[0].serviceName).toBe('Service 14');
  });
});
