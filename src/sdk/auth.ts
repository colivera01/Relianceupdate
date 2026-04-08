import { api } from '../lib/api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  CustomerProfile,
  VendorProfile,
  ProfileToggleRequest,
  ProfileToggleResponse
} from '../types/api';

// Authentication SDK
export const authSDK = {
  // Login user
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/login', credentials);
    
    // Store token if login successful
    if (response.success && response.token) {
      api.setAuthToken(response.token);
    }
    
    return response;
  },

  // Register new user
  async register(userData: RegisterRequest): Promise<{ success: boolean; user: any }> {
    const endpoint = userData.userType === 'vendor' 
      ? '/api/vendor/register' 
      : '/api/customer/register';
    
    return api.post<{ success: boolean; user: any }>(endpoint, userData);
  },

  // Get customer profile
  async getCustomerProfile(): Promise<{ success: boolean; profile: CustomerProfile }> {
    return api.get<{ success: boolean; profile: CustomerProfile }>('/api/customer/profile');
  },

  // Update customer profile
  async updateCustomerProfile(profileData: Partial<CustomerProfile>): Promise<{ success: boolean; profile: CustomerProfile }> {
    return api.put<{ success: boolean; profile: CustomerProfile }>('/api/customer/profile', profileData);
  },

  // Get vendor profile
  async getVendorProfile(): Promise<{ success: boolean; profile: VendorProfile }> {
    return api.get<{ success: boolean; profile: VendorProfile }>('/api/vendor/profile');
  },

  // Update vendor profile
  async updateVendorProfile(profileData: Partial<VendorProfile>): Promise<{ success: boolean; profile: VendorProfile }> {
    return api.put<{ success: boolean; profile: VendorProfile }>('/api/vendor/profile', profileData);
  },

  // Toggle between profiles
  async toggleProfile(request: ProfileToggleRequest): Promise<ProfileToggleResponse> {
    return api.post<ProfileToggleResponse>('/api/profile/toggle', request);
  },

  // Get available profiles
  async getAvailableProfiles(): Promise<{ availableProfiles: string[] }> {
    return api.get<{ availableProfiles: string[] }>('/api/profile/toggle');
  },

  // Check vendor eligibility
  async checkVendorEligibility(): Promise<{ eligible: boolean; requirements: string[] }> {
    return api.get<{ eligible: boolean; requirements: string[] }>('/api/profile/check-vendor-eligibility');
  },

  // Logout (clear token)
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }
};

// Export individual functions for convenience
export const {
  login,
  register,
  getCustomerProfile,
  updateCustomerProfile,
  getVendorProfile,
  updateVendorProfile,
  toggleProfile,
  getAvailableProfiles,
  checkVendorEligibility,
  logout
} = authSDK;


