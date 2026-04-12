import { api } from '../lib/api';
import type { Review, Pagination } from '../types/api';

/**
 * Reviews SDK — only methods backed by implemented App Router routes.
 * Smart review capture and moderation use `POST /api/reviews/create`, `window/*`, etc. via app `fetch`, not this module.
 */
export const reviewsSDK = {
  async listReviews(params?: {
    serviceId?: string;
    vendorId?: string;
    userId?: string;
    rating?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ reviews: Review[]; pagination: Pagination }> {
    return api.get<{ reviews: Review[]; pagination: Pagination }>('/api/reviews', params);
  },
};

export const { listReviews } = reviewsSDK;
