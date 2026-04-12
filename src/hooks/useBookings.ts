import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { bookingsSDK } from '../sdk/bookings';
import type { CreateBookingDTO, UpdateBookingDTO } from '../types/api';

// Query keys
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (id: string, authUserId?: string) =>
    [...bookingKeys.details(), id, authUserId ?? ''] as const,
};

// Booking hooks
export const useListBookings = (filters?: Record<string, any>) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: bookingKeys.list({ ...(filters || {}), _authUserId: user?.id ?? '' }),
    queryFn: () => bookingsSDK.listBookings(filters, user?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGetBooking = (id: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: bookingKeys.detail(id, user?.id),
    queryFn: () => bookingsSDK.getBooking(id, user?.id),
    enabled: !!id,
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateBookingDTO & Record<string, unknown>) =>
      bookingsSDK.createBooking(data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingDTO }) =>
      bookingsSDK.updateBooking(id, data, user?.id),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(bookingKeys.detail(id, user?.id), data.booking);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useDeleteBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => bookingsSDK.deleteBooking(id, user?.id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: bookingKeys.detail(id, user?.id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => bookingsSDK.cancelBooking(id, user?.id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id, user?.id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

