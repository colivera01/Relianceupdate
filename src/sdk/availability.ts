import { api } from '../lib/api';
import type {
  VendorAvailability,
  UpdateAvailabilityDTO
} from '../types/api';

// Availability SDK
export const availabilitySDK = {
  // Get vendor availability
  async getVendorAvailability(vendorId: string): Promise<VendorAvailability> {
    return api.get<VendorAvailability>(`/api/availability/vendor/${vendorId}`);
  },

  // Update vendor availability
  async updateVendorAvailability(
    vendorId: string, 
    availabilityData: UpdateAvailabilityDTO
  ): Promise<{ success: boolean; availability: VendorAvailability }> {
    return api.put<{ success: boolean; availability: VendorAvailability }>(
      `/api/availability/vendor/${vendorId}`,
      availabilityData
    );
  },

  // Check availability for a specific date/time
  async checkAvailability(params: {
    vendorId: string;
    date: string;
    time: string;
    duration?: number;
  }): Promise<{ available: boolean; message?: string; alternatives?: string[] }> {
    return api.get<{ available: boolean; message?: string; alternatives?: string[] }>(
      '/api/availability/check',
      params
    );
  },

  // Get vendor schedule for a date range
  async getVendorSchedule(vendorId: string, params: {
    startDate: string;
    endDate: string;
  }): Promise<{ schedule: VendorAvailability['schedule']; exceptions: VendorAvailability['exceptions'] }> {
    return api.get<{ schedule: VendorAvailability['schedule']; exceptions: VendorAvailability['exceptions'] }>(
      `/api/availability/vendor/${vendorId}/schedule`,
      params
    );
  },

  // Set emergency availability
  async setEmergencyAvailability(vendorId: string, available: boolean): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(
      `/api/availability/vendor/${vendorId}/emergency`,
      { emergencyAvailable: available }
    );
  },

  // Get vendor response time
  async getVendorResponseTime(vendorId: string): Promise<{ responseTime: string }> {
    return api.get<{ responseTime: string }>(`/api/availability/vendor/${vendorId}/response-time`);
  },

  // Update vendor response time
  async updateVendorResponseTime(vendorId: string, responseTime: string): Promise<{ success: boolean }> {
    return api.put<{ success: boolean }>(
      `/api/availability/vendor/${vendorId}/response-time`,
      { responseTime }
    );
  }
};

// Export individual functions for convenience
export const {
  getVendorAvailability,
  updateVendorAvailability,
  checkAvailability,
  getVendorSchedule,
  setEmergencyAvailability,
  getVendorResponseTime,
  updateVendorResponseTime
} = availabilitySDK;


