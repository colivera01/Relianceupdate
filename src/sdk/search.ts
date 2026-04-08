import { api } from '../lib/api';
import type {
  SearchParams,
  SearchResponse,
  SearchResult
} from '../types/api';

// Search SDK
export const searchSDK = {
  // General search
  async search(params: SearchParams): Promise<SearchResponse> {
    return api.get<SearchResponse>('/api/search', params);
  },

  // Search services
  async searchServices(query: string, params?: {
    category?: string;
    location?: string;
    priceRange?: { min: number; max: number };
    rating?: number;
    availability?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ results: SearchResult[]; total: number; page: number; limit: number }> {
    return api.get<{ results: SearchResult[]; total: number; page: number; limit: number }>(
      '/api/search/services',
      { q: query, ...params }
    );
  },

  // Search vendors
  async searchVendors(query: string, params?: {
    category?: string;
    location?: string;
    rating?: number;
    verified?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ results: SearchResult[]; total: number; page: number; limit: number }> {
    return api.get<{ results: SearchResult[]; total: number; page: number; limit: number }>(
      '/api/search/vendors',
      { q: query, ...params }
    );
  },

  // Get search suggestions
  async getSearchSuggestions(query: string, limit?: number): Promise<{ suggestions: string[] }> {
    return api.get<{ suggestions: string[] }>('/api/search/suggestions', { q: query, limit });
  },

  // Get popular searches
  async getPopularSearches(limit?: number): Promise<{ searches: string[] }> {
    return api.get<{ searches: string[] }>('/api/search/popular', { limit });
  },

  // Get trending searches
  async getTrendingSearches(limit?: number): Promise<{ searches: string[] }> {
    return api.get<{ searches: string[] }>('/api/search/trending', { limit });
  },

  // Get search filters
  async getSearchFilters(): Promise<{
    categories: string[];
    priceRanges: Array<{ min: number; max: number; label: string }>;
    locations: string[];
    ratings: number[];
  }> {
    return api.get<{
      categories: string[];
      priceRanges: Array<{ min: number; max: number; label: string }>;
      locations: string[];
      ratings: number[];
    }>('/api/search/filters');
  },

  // Save search query (for analytics)
  async saveSearchQuery(query: string, filters?: Record<string, any>): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>('/api/search/analytics', { query, filters });
  },

  // Get search history for user
  async getSearchHistory(limit?: number): Promise<{ searches: Array<{ query: string; timestamp: string; filters?: Record<string, any> }> }> {
    return api.get<{ searches: Array<{ query: string; timestamp: string; filters?: Record<string, any> }> }>(
      '/api/search/history',
      { limit }
    );
  }
};

// Export individual functions for convenience
export const {
  search,
  searchServices,
  searchVendors,
  getSearchSuggestions,
  getPopularSearches,
  getTrendingSearches,
  getSearchFilters,
  saveSearchQuery,
  getSearchHistory
} = searchSDK;


