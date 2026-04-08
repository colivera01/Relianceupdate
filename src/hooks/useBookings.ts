import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsSDK } from '../sdk/bookings';
import type { CreateBookingDTO, UpdateBookingDTO } from '../types/api';

// Query keys
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
  user: (userId: string) => [...bookingKeys.all, 'user', userId] as const,
  vendor: (vendorId: string) => [...bookingKeys.all, 'vendor', vendorId] as const,
};

// Booking hooks
export const useListBookings = (filters?: Record<string, any>) => {
  return useQuery({
    queryKey: bookingKeys.list(filters || {}),
    queryFn: () => bookingsSDK.listBookings(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGetBooking = (id: string) => {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => bookingsSDK.getBooking(id),
    enabled: !!id,
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsSDK.createBooking,
    onSuccess: () => {
      // Invalidate booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingDTO }) =>
      bookingsSDK.updateBooking(id, data),
    onSuccess: (data, { id }) => {
      // Update booking in cache
      queryClient.setQueryData(bookingKeys.detail(id), data.booking);
      
      // Invalidate booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useDeleteBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsSDK.deleteBooking,
    onSuccess: (_, id) => {
      // Remove booking from cache
      queryClient.removeQueries({ queryKey: bookingKeys.detail(id) });
      
      // Invalidate booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsSDK.cancelBooking,
    onSuccess: (_, id) => {
      // Update booking status in cache
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      
      // Invalidate booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useConfirmBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsSDK.confirmBooking,
    onSuccess: (_, id) => {
      // Update booking status in cache
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      
      // Invalidate booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useCompleteBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsSDK.completeBooking,
    onSuccess: (_, id) => {
      // Update booking status in cache
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      
      // Invalidate booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useUserBookings = (userId: string, filters?: Record<string, any>) => {
  return useQuery({
    queryKey: [...bookingKeys.user(userId), filters],
    queryFn: () => bookingsSDK.getUserBookings(userId, filters),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useVendorBookings = (vendorId: string, filters?: Record<string, any>) => {
  return useQuery({
    queryKey: [...bookingKeys.vendor(vendorId), filters],
    queryFn: () => bookingsSDK.getVendorBookings(vendorId, filters),
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};


