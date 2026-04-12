/**
 * Users SDK — profile + favorites paths aligned to Next routes where implemented.
 * Admin-style helpers (`getUserById`, `getUserPreferences`, …) still call URLs with **no** matching `src/app/api` handlers and will 404 until routes exist.
 */
import { api } from '../lib/api';
import type {
  User,
  CustomerProfile,
  VendorProfile,
  CreateFavoriteDTO,
  FavoritesListResponse,
} from '../types/api';

// Users SDK
export const usersSDK = {
  // Get user profile
  async getUserProfile(): Promise<{ success: boolean; profile: CustomerProfile | VendorProfile }> {
    // Try to get customer profile first, then vendor profile
    try {
      const customerProfile = await api.get<{ success: boolean; profile: CustomerProfile }>('/api/customer/profile');
      if (customerProfile.success) {
        return customerProfile;
      }
    } catch {
      // Customer profile not found, try vendor profile
    }

    try {
      const vendorProfile = await api.get<{ success: boolean; profile: VendorProfile }>('/api/vendor/profile');
      if (vendorProfile.success) {
        return vendorProfile;
      }
    } catch {
      // Vendor profile not found
    }

    throw new Error('User profile not found');
  },

  // Update user profile
  async updateUserProfile(profileData: Partial<CustomerProfile | VendorProfile>): Promise<{ success: boolean; profile: CustomerProfile | VendorProfile }> {
    // Determine profile type and update accordingly
    if ('businessName' in profileData) {
      // Vendor profile
      return api.put<{ success: boolean; profile: VendorProfile }>('/api/vendor/profile', profileData);
    } else {
      // Customer profile
      return api.put<{ success: boolean; profile: CustomerProfile }>('/api/customer/profile', profileData);
    }
  },

  // Get user by ID (admin function)
  async getUserById(userId: string): Promise<User> {
    return api.get<User>(`/api/users/${userId}`);
  },

  // Update user by ID (admin function)
  async updateUserById(userId: string, userData: Partial<User>): Promise<{ success: boolean; user: User }> {
    return api.put<{ success: boolean; user: User }>(`/api/users/${userId}`, userData);
  },

  // Delete user by ID (admin function)
  async deleteUserById(userId: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/users/${userId}`);
  },

  // Get user preferences
  async getUserPreferences(): Promise<{ preferences: Record<string, any> }> {
    return api.get<{ preferences: Record<string, any> }>('/api/users/preferences');
  },

  // Update user preferences
  async updateUserPreferences(preferences: Record<string, any>): Promise<{ success: boolean; preferences: Record<string, any> }> {
    return api.put<{ success: boolean; preferences: Record<string, any> }>('/api/users/preferences', preferences);
  },

  // Upload user photo
  async uploadUserPhoto(photoFile: File): Promise<{ success: boolean; photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', photoFile);
    
    return api.post<{ success: boolean; photoUrl: string }>(
      '/api/users/upload-photo',
      formData
    );
  },

  /**
   * Lists favorites for the authenticated user (`GET /api/users/favorites`).
   * Prefer `@/sdk/favorites` + `favoritesSDK` when you need `x-user-id` / storage fallbacks.
   * `type` is accepted for call-site compatibility but is not sent (API is service-favorites only).
   */
  async listFavorites(params?: {
    type?: 'service' | 'vendor';
    page?: number;
    limit?: number;
  }): Promise<FavoritesListResponse> {
    const { page, limit } = params || {};
    const query: Record<string, string | number> = {};
    if (page != null) query.page = page;
    if (limit != null) query.limit = limit;
    return api.get<FavoritesListResponse>('/api/users/favorites', query);
  },

  /**
   * Adds a service favorite (`POST /api/users/favorites`).
   * Prefer `@/sdk/favorites` when you need explicit customer id resolution.
   */
  async addFavorite(favoriteData: CreateFavoriteDTO): Promise<{
    success: boolean;
    favorite: { favoriteId: string; serviceId: string; favoritedAt: string };
    message: string;
  }> {
    const serviceId = String(favoriteData.serviceId || '').trim();
    if (!serviceId) {
      throw new Error('usersSDK.addFavorite requires serviceId (vendor-only favorites are not supported by the API)');
    }
    return api.post('/api/users/favorites', { serviceId });
  },

  /** Removes a favorite by favorite id or service id (`DELETE /api/users/favorites/[id]`). */
  async removeFavorite(favoriteOrServiceId: string): Promise<{
    success: boolean;
    removed: { favoriteId: string; serviceId: string };
    message: string;
  }> {
    return api.delete(`/api/users/favorites/${encodeURIComponent(favoriteOrServiceId)}`);
  },

  // Get user activity
  async getUserActivity(params?: {
    page?: number;
    limit?: number;
    type?: 'bookings' | 'reviews' | 'favorites' | 'searches';
  }): Promise<{ activities: Array<{ type: string; data: any; timestamp: string }>; total: number }> {
    return api.get<{ activities: Array<{ type: string; data: any; timestamp: string }>; total: number }>(
      '/api/users/activity',
      params
    );
  }
};

// Export individual functions for convenience
export const {
  getUserProfile,
  updateUserProfile,
  getUserById,
  updateUserById,
  deleteUserById,
  getUserPreferences,
  updateUserPreferences,
  uploadUserPhoto,
  listFavorites,
  addFavorite,
  removeFavorite,
  getUserActivity
} = usersSDK;


