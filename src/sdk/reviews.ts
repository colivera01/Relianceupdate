import { api } from '../lib/api';
import type { Pagination } from '../types/api';

export type GenericReview = {
  id: string;
  reviewId: string;
  userId: string;
  vendorId: string;
  bookingId: string | null;
  mediaSessionId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  vendorName: string | null;
  reviewerDisplayName: string;
  rating: number;
  comment: string;
  source: string;
  submittedVia: string;
  moderationStatus: string;
  visibilityStatus: string;
  submittedAt: string;
  createdAt: string;
};

/**
 * Reviews SDK — read-only helper for the generic persisted review lookup.
 * Customer review hubs use `/api/reviews/me`; proof-based submission uses
 * `/api/reviews/window/start` and `/api/reviews/create` directly from the app.
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
  }): Promise<{ success: boolean; reviews: GenericReview[]; pagination: Pagination }> {
    return api.get<{ success: boolean; reviews: GenericReview[]; pagination: Pagination }>('/api/reviews', params);
  },
};

export const { listReviews } = reviewsSDK;
