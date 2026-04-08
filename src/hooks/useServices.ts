import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesSDK } from '../sdk/services';
import type { CreateServiceDTO, UpdateServiceDTO } from '../types/api';

// Query keys
export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...serviceKeys.lists(), filters] as const,
  details: () => [...serviceKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  popular: () => [...serviceKeys.all, 'popular'] as const,
  categories: () => [...serviceKeys.all, 'categories'] as const,
  category: (category: string) => [...serviceKeys.all, 'category', category] as const,
  vendor: (vendorId: string) => [...serviceKeys.all, 'vendor', vendorId] as const,
  search: (query: string) => [...serviceKeys.all, 'search', query] as const,
};

// Service hooks
export const useListServices = (filters?: Record<string, any>) => {
  return useQuery({
    queryKey: serviceKeys.list(filters || {}),
    queryFn: () => servicesSDK.listServices(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      // Invalidate service lists
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
      // Update service in cache
      queryClient.setQueryData(serviceKeys.detail(id), data.service);
      
      // Invalidate service lists
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesSDK.deleteService,
    onSuccess: (_, id) => {
      // Remove service from cache
      queryClient.removeQueries({ queryKey: serviceKeys.detail(id) });
      
      // Invalidate service lists
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
};

export const usePopularServices = (limit?: number) => {
  return useQuery({
    queryKey: serviceKeys.popular(),
    queryFn: () => servicesSDK.getPopularServices(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useServiceCategories = () => {
  return useQuery({
    queryKey: serviceKeys.categories(),
    queryFn: servicesSDK.getCategories,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useServicesByCategory = (category: string, filters?: Record<string, any>) => {
  return useQuery({
    queryKey: serviceKeys.category(category),
    queryFn: () => servicesSDK.getServicesByCategory(category, filters),
    enabled: !!category,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useServicesByVendor = (vendorId: string, filters?: Record<string, any>) => {
  return useQuery({
    queryKey: serviceKeys.vendor(vendorId),
    queryFn: () => servicesSDK.getServicesByVendor(vendorId, filters),
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useSearchServices = (query: string, filters?: Record<string, any>) => {
  return useQuery({
    queryKey: serviceKeys.search(query),
    queryFn: () => servicesSDK.searchServices(query, filters),
    enabled: !!query,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useUploadServiceMedia = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ serviceId, file }: { serviceId: string; file: File }) =>
      servicesSDK.uploadServiceMedia(serviceId, file),
    onSuccess: (_, { serviceId }) => {
      // Invalidate service details
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
    },
  });
};

export const useDeleteServiceMedia = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ serviceId, mediaId }: { serviceId: string; mediaId: string }) =>
      servicesSDK.deleteServiceMedia(serviceId, mediaId),
    onSuccess: (_, { serviceId }) => {
      // Invalidate service details
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
    },
  });
};


