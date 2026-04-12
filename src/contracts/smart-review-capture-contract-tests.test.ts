import { describe, expect, it } from 'vitest';
import {
  assertAdminReviewAuditShape,
  assertConsentMutationResponse,
  assertPromptEventResponse,
  assertQuickReviewCreateResponse,
  assertReviewWindowStartResponse,
  assertSentimentResponse,
  assertWindowExpireResponse,
  smartReviewCaptureExamples,
} from './smart-review-capture-contract-tests';

describe('smart review capture contract shapes', () => {
  it('assertReviewWindowStartResponse', () => {
    expect(assertReviewWindowStartResponse(smartReviewCaptureExamples.start)).toBe(true);
    expect(assertReviewWindowStartResponse({ success: false, error: 'x' })).toBe(true);
  });

  it('assertPromptEventResponse', () => {
    expect(assertPromptEventResponse(smartReviewCaptureExamples.prompt)).toBe(true);
  });

  it('assertSentimentResponse', () => {
    expect(assertSentimentResponse(smartReviewCaptureExamples.sentiment)).toBe(true);
  });

  it('assertQuickReviewCreateResponse', () => {
    expect(assertQuickReviewCreateResponse(smartReviewCaptureExamples.reviewCreate)).toBe(true);
  });

  it('assertWindowExpireResponse', () => {
    expect(assertWindowExpireResponse(smartReviewCaptureExamples.expire)).toBe(true);
  });

  it('assertConsentMutationResponse', () => {
    expect(assertConsentMutationResponse(smartReviewCaptureExamples.consent)).toBe(true);
  });

  it('assertAdminReviewAuditShape', () => {
    expect(assertAdminReviewAuditShape(smartReviewCaptureExamples.audit)).toBe(true);
  });
});
