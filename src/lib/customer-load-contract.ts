import { z } from 'zod';

const count = z.number().int().nonnegative();
export const paginationSchema = z.object({ page: count.min(1), limit: count.min(1), total: count, totalPages: count });
export const customerRecordCountsSchema = z.object({
  upcoming: count, completed: count, needs_attention: count, cancelled: count, archived: count, unclassified: count,
});
const recordState = z.object({
  lifecycle: z.string(), lifecycleLabel: z.string(), archived: z.boolean(),
  attention: z.object({ required: z.boolean() }).passthrough(),
  video: z.object({ state: z.string(), label: z.string() }).passthrough(),
  review: z.object({ state: z.string(), label: z.string() }).passthrough(),
  visibility: z.object({ label: z.string() }).passthrough(),
}).passthrough();
export const customerRecordsResponseSchema = z.object({
  bookings: z.array(z.object({ id: z.string().min(1), customer_record: recordState }).passthrough()),
  counts: customerRecordCountsSchema,
  selectedTab: z.enum(['upcoming', 'completed', 'needs_attention', 'cancelled', 'archived', 'unclassified']),
  pagination: paginationSchema,
});
const readyReview = z.object({ bookingId: z.string(), serviceName: z.string(), vendorName: z.string() }).passthrough();
export const customerReviewsResponseSchema = z.object({
  ready: z.array(readyReview),
  awaiting: z.array(readyReview.extend({ statusMessage: z.string() })),
  submitted: z.array(z.object({ reviewId: z.string(), rating: count.min(1).max(5), commentStatus: z.string() }).passthrough()),
  counts: z.object({ ready: count, awaiting: count, submitted: count }),
  pagination: z.object({ ready: paginationSchema, submitted: paginationSchema }),
});
export const customerFavoritesResponseSchema = z.object({
  success: z.literal(true),
  items: z.array(z.discriminatedUnion('entityType', [
    z.object({ entityType: z.literal('vendor'), favoriteId: z.string(), vendorId: z.string(), vendorName: z.string() }).passthrough(),
    z.object({ entityType: z.literal('service'), favoriteId: z.string(), serviceId: z.string(), serviceName: z.string(), publicListing: z.object({ serviceEligible: z.boolean() }).passthrough() }).passthrough(),
  ])),
  counts: z.object({ all: count, services: count, vendors: count }), pagination: paginationSchema,
});
export const customerSummarySchemas = {
  bookings: z.object({ summary: z.object({ activeTotal: count }) }),
  favorites: z.object({ summary: z.object({ total: count, uniqueVendorCount: count }) }),
  reviews: z.object({ summary: z.object({ submittedTotal: count }) }),
};

const safeMessages = new Set([
  'Unable to load your Service Records.', 'Unable to load your reviews.',
  'Unable to load Favorites.', 'Unable to load this Service Record.',
]);
export function customerLoadMessage(body: unknown, fallback: string): string {
  const value = body as { message?: unknown; error?: unknown; correlationId?: unknown } | null;
  const message = value?.message ?? value?.error;
  const safe = typeof message === 'string' && safeMessages.has(message) ? message : fallback;
  const reference = typeof value?.correlationId === 'string' && /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(value.correlationId)
    ? ` Reference: ${value.correlationId}` : '';
  return safe + reference;
}

export async function readCustomerResponse<T>(response: Response, parser: { parse: (body: unknown) => T }, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw new Error(customerLoadMessage(body, fallback));
  try { return parser.parse(body); } catch { throw new Error(fallback); }
}
