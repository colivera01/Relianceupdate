import { api } from '../lib/api';
import type {
  User,
  CustomerProfile,
  VendorProfile,
  Favorite,
  CreateFavoriteDTO
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
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  // Get user favorites
  async listFavorites(params?: {
    type?: 'service' | 'vendor';
    page?: number;
    limit?: number;
  }): Promise<{ favorites: Favorite[]; total: number }> {
    return api.get<{ favorites: Favorite[]; total: number }>('/api/favorites', params);
  },

  // Add favorite
  async addFavorite(favoriteData: CreateFavoriteDTO): Promise<{ success: boolean; favorite: Favorite }> {
    return api.post<{ success: boolean; favorite: Favorite }>('/api/favorites', favoriteData);
  },

  // Remove favorite
  async removeFavorite(favoriteId: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/favorites/${favoriteId}`);
  },

  // Update favorite notes
  async updateFavoriteNotes(favoriteId: string, notes: string): Promise<{ success: boolean; favorite: Favorite }> {
    return api.put<{ success: boolean; favorite: Favorite }>(`/api/favorites/${favoriteId}/notes`, { notes });
  },

  // Check if item is favorited
  async checkFavorite(params: {
    serviceId?: string;
    vendorId?: string;
    type: 'service' | 'vendor';
  }): Promise<{ isFavorited: boolean; favoriteId?: string }> {
    return api.get<{ isFavorited: boolean; favoriteId?: string }>('/api/favorites/check', params);
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
  updateFavoriteNotes,
  checkFavorite,
  getUserActivity
} = usersSDK;


