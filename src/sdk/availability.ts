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

  /**
   * POST /api/availability/check — matches `availability/check/route.ts`.
   * Accepts `booking_date` / `booking_time` or legacy aliases `date` / `time`.
   * `message` is populated from `reason` when absent, for older callers.
   */
  async checkAvailability(params: {
    vendorId: string;
    booking_date?: string;
    booking_time?: string;
    /** @deprecated alias for `booking_date` */
    date?: string;
    /** @deprecated alias for `booking_time` */
    time?: string;
    serviceId?: string;
    /** Not used by the API; accepted so existing call sites keep compiling */
    duration?: number;
  }): Promise<{
    available: boolean;
    reason?: string;
    message?: string;
    alternatives?: string[];
  }> {
    const booking_date = String(params.booking_date || params.date || '').trim();
    let booking_time = String(params.booking_time || params.time || '').trim();
    if (booking_time.includes('T')) {
      booking_time = booking_time.slice(11, 16);
    } else if (booking_time.length >= 8 && booking_time.includes(':')) {
      booking_time = booking_time.slice(0, 5);
    }

    const body: {
      vendorId: string;
      booking_date: string;
      booking_time: string;
      serviceId?: string;
    } = {
      vendorId: String(params.vendorId),
      booking_date,
      booking_time,
    };
    if (params.serviceId) {
      body.serviceId = String(params.serviceId);
    }

    const result = await api.post<{ available: boolean; reason?: string }>(
      '/api/availability/check',
      body
    );
    const reason = typeof result.reason === 'string' ? result.reason : undefined;
    return {
      available: Boolean(result.available),
      ...(reason ? { reason } : {}),
      message: reason,
      alternatives: undefined,
    };
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


