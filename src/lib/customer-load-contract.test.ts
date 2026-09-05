import { describe, expect, it, vi } from 'vitest';
import { customerLoadMessage, customerRecordsResponseSchema, customerReviewsResponseSchema, customerFavoritesResponseSchema, customerSummarySchemas, readCustomerResponse } from './customer-load-contract';
import { customerLoadError } from './customer-load-error';

const counts = { upcoming: 0, completed: 0, needs_attention: 0, cancelled: 0, archived: 0, unclassified: 0 };
const pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
describe('customer load success/error contracts', () => {
  it('accepts authoritative zero only from a complete successful response', async () => {
    const body = { bookings: [], counts, pagination, selectedTab: 'upcoming', businesses: [], selectedBusinessId: null };
    expect(await readCustomerResponse(Response.json(body), customerRecordsResponseSchema, 'Failed')).toEqual(body);
  });
  it.each([{}, { bookings: [] }, { bookings: [], counts, pagination }, { bookings: [], counts: { ...counts, upcoming: -1 }, pagination, selectedTab: 'upcoming' }, { bookings: [{}], counts, pagination, selectedTab: 'completed' }])('rejects malformed successful records response %j', async (body) => {
    await expect(readCustomerResponse(Response.json(body), customerRecordsResponseSchema, 'Unable to load your Service Records.')).rejects.toThrow('Unable to load your Service Records.');
  });
  it('does not expose internal errors from a failed response', async () => {
    await expect(readCustomerResponse(Response.json({ message: 'Prisma SQL secret' }, { status: 500 }), customerRecordsResponseSchema, 'Safe message')).rejects.toThrow('Safe message');
  });
  it('reads safe message and correlation ID rather than only body.error', () => {
    expect(customerLoadMessage({ message: 'Unable to load your reviews.', correlationId: 'a93c0acb-e2a6-4c9b-8fa2-cd11bc2ff753' }, 'fallback')).toBe('Unable to load your reviews. Reference: a93c0acb-e2a6-4c9b-8fa2-cd11bc2ff753');
  });
  it('does not echo arbitrary error reference content', () => {
    expect(customerLoadMessage({ error: 'SQL', correlationId: 'customer-private-id' }, 'Safe')).toBe('Safe');
  });
  it('accepts complete empty Reviews without manufacturing counts', () => {
    expect(customerReviewsResponseSchema.safeParse({ ready: [], awaiting: [], submitted: [], counts: { ready: 0, awaiting: 0, submitted: 0 }, pagination: { ready: pagination, submitted: pagination } }).success).toBe(true);
    expect(customerReviewsResponseSchema.safeParse({ ready: [] }).success).toBe(false);
  });
  it('accepts complete empty Favorites without manufacturing counts', () => {
    expect(customerFavoritesResponseSchema.safeParse({ success: true, items: [], counts: { all: 0, services: 0, vendors: 0 }, pagination }).success).toBe(true);
    expect(customerFavoritesResponseSchema.safeParse({ items: [] }).success).toBe(false);
  });
  it.each(Object.values(customerSummarySchemas))('rejects missing dashboard summaries', (schema) => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ summary: {} }).success).toBe(false);
  });
  it('logs the exception with a server-generated reference and returns only safe text', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const error = new Error('private database detail');
      const response = customerLoadError(error, 'records', 'Unable to load your Service Records.');
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.code).toBe('CUSTOMER_LOAD_FAILED');
      expect(JSON.stringify(body)).not.toContain('private database detail');
      expect(log).toHaveBeenCalledWith('[records]', { correlationId: body.correlationId, error });
    } finally { log.mockRestore(); }
  });
});
