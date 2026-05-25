import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesSDK } from '../sdk/services';
import type { CreateServiceDTO, UpdateServiceDTO } from '../types/api';

// Query keys
export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...serviceKeys.lists(), filters] as const,
  details: () => [...serviceKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  categories: () => [...serviceKeys.all, 'categories'] as const,
  discover: (filters: Record<string, unknown>) => [...serviceKeys.all, 'discover', filters] as const,
};

export const useListServices = (filters?: Record<string, unknown>) => {
  return useQuery({
    queryKey: serviceKeys.list(filters || {}),
    queryFn: () => servicesSDK.listServices(filters),
    staleTime: 5 * 60 * 1000,
  });
};

export const useGetService = (id: string) => {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => servicesSDK.getService(id),
    enabled: !!id,
  });
};

export const useCreateService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicesSDK.createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceDTO }) =>
      servicesSDK.updateService(id, data),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(serviceKeys.detail(id), data.service);
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicesSDK.deleteService,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: serviceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
};

export const useServiceCategories = () => {
  return useQuery({
    queryKey: serviceKeys.categories(),
    queryFn: servicesSDK.getCategories,
    staleTime: 30 * 60 * 1000,
  });
};

export const useDiscoverServices = (filters?: {
  q?: string;
  category?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'name' | 'distance';
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  zipCode?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: serviceKeys.discover(filters || {}),
    queryFn: () => servicesSDK.discoverServices(filters),
    staleTime: 2 * 60 * 1000,
  });
};
