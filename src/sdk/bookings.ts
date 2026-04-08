import { api } from '../lib/api';
import type {
  Booking,
  CreateBookingDTO,
  UpdateBookingDTO,
  Pagination
} from '../types/api';

// Bookings SDK
export const bookingsSDK = {
  // Get all bookings with filters
  async listBookings(params?: {
    userId?: string;
    vendorId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bookings: Booking[]; pagination: Pagination }> {
    return api.get<{ bookings: Booking[]; pagination: Pagination }>('/api/bookings', params);
  },

  // Get booking by ID
  async getBooking(id: string): Promise<Booking> {
    return api.get<Booking>(`/api/bookings/${id}`);
  },

  // Create new booking
  async createBooking(bookingData: CreateBookingDTO): Promise<{ success: boolean; booking: Booking }> {
    return api.post<{ success: boolean; booking: Booking }>('/api/bookings', bookingData);
  },

  // Update booking
  async updateBooking(id: string, bookingData: UpdateBookingDTO): Promise<{ success: boolean; booking: Booking }> {
    return api.put<{ success: boolean; booking: Booking }>(`/api/bookings/${id}`, bookingData);
  },

  // Delete booking
  async deleteBooking(id: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/bookings/${id}`);
  },

  // Cancel booking
  async cancelBooking(id: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`/api/bookings/${id}/cancel`);
  },

  // Confirm booking
  async confirmBooking(id: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`/api/bookings/${id}/confirm`);
  },

  // Complete booking
  async completeBooking(id: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`/api/bookings/${id}/complete`);
  },

  // Get user bookings
  async getUserBookings(userId: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bookings: Booking[]; pagination: Pagination }> {
    return api.get<{ bookings: Booking[]; pagination: Pagination }>(`/api/bookings/user/${userId}`, params);
  },

  // Get vendor bookings
  async getVendorBookings(vendorId: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bookings: Booking[]; pagination: Pagination }> {
    return api.get<{ bookings: Booking[]; pagination: Pagination }>(`/api/bookings/vendor/${vendorId}`, params);
  }
};

// Export individual functions for convenience
export const {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  cancelBooking,
  confirmBooking,
  completeBooking,
  getUserBookings,
  getVendorBookings
} = bookingsSDK;


