// Focused contract checks for smart review capture active path.

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

export function assertReviewWindowStartResponse(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.success === 'boolean' &&
    (value.success === false ||
      (isObject(value.reviewWindow) &&
        typeof value.reviewWindow.id === 'string' &&
        (value.created === undefined || typeof value.created === 'boolean')))
  );
}

export function assertPromptEventResponse(value: unknown): boolean {
  return isObject(value) && typeof value.success === 'boolean' && (value.success === false || isObject(value.event));
}

export function assertSentimentResponse(value: unknown): boolean {
  return isObject(value) && typeof value.success === 'boolean' && (value.success === false || isObject(value.sentiment));
}

export function assertQuickReviewCreateResponse(value: unknown): boolean {
  if (!isObject(value) || typeof value.success !== 'boolean') return false;
  if (value.success === false) return true;
  if (!isObject(value.review) || typeof value.reviewWindowId !== 'string') return false;
  if (!isObject(value.links)) return false;
  return (
    typeof (value.links as any).bookingId === 'string' &&
    typeof (value.links as any).vendorId === 'string' &&
    typeof (value.links as any).mediaSessionId === 'string'
  );
}

export function assertWindowExpireResponse(value: unknown): boolean {
  if (!isObject(value) || typeof value.success !== 'boolean') return false;
  if (value.success === false) return true;
  return (
    isObject(value.reviewWindow) &&
    typeof value.reviewOpportunityStillAvailable === 'boolean' &&
    value.reviewCreated === false
  );
}

export function assertConsentMutationResponse(value: unknown): boolean {
  return isObject(value) && typeof value.success === 'boolean' && (value.success === false || isObject(value.consent));
}

export function assertAdminReviewAuditShape(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.success === 'boolean' &&
    Array.isArray(value.rows) &&
    isObject(value.pagination)
  );
}

export const smartReviewCaptureExamples = {
  start: { success: true, created: true, reviewWindow: { id: 'rw_1', status: 'active' } },
  prompt: { success: true, event: { id: 'ev_1', eventType: 'soft_prompt_shown' } },
  sentiment: { success: true, sentiment: { id: 'st_1', sentiment: 'positive' } },
  reviewCreate: {
    success: true,
    reviewWindowId: 'rw_1',
    review: { id: 'rv_1', source: 'customer', submittedVia: 'video_overlay' },
    links: { bookingId: 'b1', vendorId: 'v1', mediaSessionId: 'm1' },
  },
  expire: {
    success: true,
    reviewWindow: { id: 'rw_1', status: 'active' },
    reviewOpportunityStillAvailable: true,
    reviewCreated: false,
  },
  consent: { success: true, consent: { id: 'cn_1', status: 'accepted' } },
  audit: { success: true, rows: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } },
};
