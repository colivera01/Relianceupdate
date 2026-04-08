import { api } from '../lib/api';
import type {
  Review,
  CreateReviewDTO,
  UpdateReviewDTO,
  Pagination
} from '../types/api';

// Reviews SDK
export const reviewsSDK = {
  // Get all reviews with filters
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

  // Get review by ID
  async getReview(id: string): Promise<Review> {
    return api.get<Review>(`/api/reviews/${id}`);
  },

  // Create new review
  async createReview(reviewData: CreateReviewDTO): Promise<{ success: boolean; review: Review }> {
    return api.post<{ success: boolean; review: Review }>('/api/reviews', reviewData);
  },

  // Update review
  async updateReview(id: string, reviewData: UpdateReviewDTO): Promise<{ success: boolean; review: Review }> {
    return api.put<{ success: boolean; review: Review }>(`/api/reviews/${id}`, reviewData);
  },

  // Delete review
  async deleteReview(id: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/reviews/${id}`);
  },

  // Mark review as helpful
  async markReviewHelpful(id: string): Promise<{ success: boolean; helpfulCount: number }> {
    return api.post<{ success: boolean; helpfulCount: number }>(`/api/reviews/${id}/helpful`);
  },

  // Add vendor response to review
  async addReviewResponse(id: string, response: string): Promise<{ success: boolean; review: Review }> {
    return api.post<{ success: boolean; review: Review }>(`/api/reviews/${id}/reply`, { response });
  },

  // Get reviews by service
  async getServiceReviews(serviceId: string, params?: {
    page?: number;
    limit?: number;
    rating?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ reviews: Review[]; pagination: Pagination }> {
    return api.get<{ reviews: Review[]; pagination: Pagination }>(`/api/reviews/service/${serviceId}`, params);
  },

  // Get reviews by vendor
  async getVendorReviews(vendorId: string, params?: {
    page?: number;
    limit?: number;
    rating?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ reviews: Review[]; pagination: Pagination }> {
    return api.get<{ reviews: Review[]; pagination: Pagination }>(`/api/reviews/vendor/${vendorId}`, params);
  },

  // Get user reviews
  async getUserReviews(userId: string, params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ reviews: Review[]; pagination: Pagination }> {
    return api.get<{ reviews: Review[]; pagination: Pagination }>(`/api/reviews/user/${userId}`, params);
  },

  // Get review statistics
  async getReviewStats(params?: {
    serviceId?: string;
    vendorId?: string;
  }): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: Record<string, number>;
    recentReviews: Review[];
  }> {
    return api.get<{
      totalReviews: number;
      averageRating: number;
      ratingDistribution: Record<string, number>;
      recentReviews: Review[];
    }>('/api/reviews/stats', params);
  }
};

// Export individual functions for convenience
export const {
  listReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  markReviewHelpful,
  addReviewResponse,
  getServiceReviews,
  getVendorReviews,
  getUserReviews,
  getReviewStats
} = reviewsSDK;


