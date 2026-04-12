import { api } from '../lib/api';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
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

  /**
   * POST `/api/profile/toggle` expects `userId` + `targetProfileType` (`customer` | `vendor`).
   * `ProfileToggleRequest.targetProfile` is mapped to `targetProfileType`. Pass `userId` or rely on `resolveCustomerUserId`.
   */
  async toggleProfile(
    request: ProfileToggleRequest & { userId?: string }
  ): Promise<ProfileToggleResponse> {
    const userId = resolveCustomerUserId(request.userId);
    if (!userId) {
      throw new Error('toggleProfile requires a user id (pass userId or sign in)');
    }
    const targetProfileType = request.targetProfile;
    const raw = await api.post<{
      success: boolean;
      activeProfile?: string;
      message?: string;
    }>('/api/profile/toggle', { userId, targetProfileType });
    return {
      success: Boolean(raw?.success),
      currentProfile: (raw?.activeProfile || targetProfileType) as 'customer' | 'vendor',
      availableProfiles: ['customer', 'vendor'],
    };
  },

  /** GET `/api/profile/toggle?userId=` — pass auth user id or use storage fallbacks via `resolveCustomerUserId`. */
  async getAvailableProfiles(authUserIdFromCaller?: string): Promise<{
    success: boolean;
    availableProfiles: string[];
    currentProfile?: string;
    canSwitch?: boolean;
  }> {
    const userId = resolveCustomerUserId(authUserIdFromCaller);
    if (!userId) {
      throw new Error('getAvailableProfiles requires a user id (pass userId or sign in)');
    }
    return api.get('/api/profile/toggle', { userId });
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


