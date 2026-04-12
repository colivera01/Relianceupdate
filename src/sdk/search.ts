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
    const response = await api.get<any>('/api/search', { q: query, type: 'service', ...params });
    return {
      results: response?.services || [],
      total: response?.pagination?.total || 0,
      page: response?.pagination?.page || 1,
      limit: response?.pagination?.limit || 20,
    };
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
    const response = await api.get<any>('/api/search', { q: query, type: 'vendor', ...params });
    return {
      results: response?.vendors || [],
      total: response?.pagination?.total || 0,
      page: response?.pagination?.page || 1,
      limit: response?.pagination?.limit || 20,
    };
  },

  // Get search suggestions (`GET /api/search` requires `q`, `category`, or `location`)
  async getSearchSuggestions(query: string, limit?: number): Promise<{ suggestions: string[] }> {
    const q = String(query || '').trim();
    if (!q) {
      return { suggestions: [] };
    }
    const response = await api.get<any>('/api/search', { q, limit });
    return { suggestions: response?.suggestions || [] };
  },

  // Get popular searches
  async getPopularSearches(limit?: number): Promise<{ searches: string[] }> {
    // Deferred specialized endpoint; use base search suggestions as fallback.
    const response = await api.get<any>('/api/search', { q: 'popular', limit });
    return { searches: response?.suggestions || [] };
  },

  // Get trending searches
  async getTrendingSearches(limit?: number): Promise<{ searches: string[] }> {
    // Deferred specialized endpoint; use base search suggestions as fallback.
    const response = await api.get<any>('/api/search', { q: 'trending', limit });
    return { searches: response?.suggestions || [] };
  },

  // Get search filters
  async getSearchFilters(): Promise<{
    categories: string[];
    priceRanges: Array<{ min: number; max: number; label: string }>;
    locations: string[];
    ratings: number[];
  }> {
    const response = await api.get<any>('/api/search', { q: 'filters' });
    const categories = (response?.filters?.categories || []).map((c: any) => String(c?.name || '')).filter(Boolean);
    const priceRanges = response?.filters?.price_ranges || [];
    const ratings = (response?.filters?.ratings || []).map((r: any) => Number(r?.rating)).filter((r: number) => Number.isFinite(r));
    return {
      categories,
      priceRanges,
      locations: [],
      ratings,
    };
  },

  // Save search query (for analytics)
  async saveSearchQuery(query: string, filters?: Record<string, any>): Promise<{ success: boolean }> {
    // Deferred analytics endpoint; no-op success keeps active UI stable.
    void query;
    void filters;
    return { success: true };
  },

  // Get search history for user
  async getSearchHistory(limit?: number): Promise<{ searches: Array<{ query: string; timestamp: string; filters?: Record<string, any> }> }> {
    void limit;
    // Deferred user-history endpoint; return empty history for now.
    return { searches: [] };
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


