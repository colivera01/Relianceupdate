import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth as useAuthSession } from '@/contexts/AuthContext';
import { authSDK } from '../sdk/auth';
import type { LoginRequest, RegisterRequest, ProfileToggleRequest } from '../types/api';

// Query keys
export const authKeys = {
  all: ['auth'] as const,
  profile: (type: 'customer' | 'vendor') => [...authKeys.all, 'profile', type] as const,
  availableProfiles: () => [...authKeys.all, 'availableProfiles'] as const,
  eligibility: () => [...authKeys.all, 'eligibility'] as const,
};

// Authentication hooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authSDK.login,
    onSuccess: (data) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: authKeys.all });
      
      // Store user data in query cache
      if (data.user) {
        queryClient.setQueryData(['user'], data.user);
      }
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authSDK.register,
    onSuccess: () => {
      // Invalidate auth queries
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      authSDK.logout();
    },
    onSuccess: () => {
      // Clear all queries and user data
      queryClient.clear();
    },
  });
};

// Profile hooks
export const useCustomerProfile = () => {
  return useQuery({
    queryKey: authKeys.profile('customer'),
    queryFn: authSDK.getCustomerProfile,
    enabled: false, // Don't auto-fetch, call manually when needed
  });
};

export const useVendorProfile = () => {
  return useQuery({
    queryKey: authKeys.profile('vendor'),
    queryFn: authSDK.getVendorProfile,
    enabled: false, // Don't auto-fetch, call manually when needed
  });
};

export const useUpdateCustomerProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authSDK.updateCustomerProfile,
    onSuccess: (data) => {
      // Update profile in cache
      queryClient.setQueryData(authKeys.profile('customer'), data);
    },
  });
};

export const useUpdateVendorProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authSDK.updateVendorProfile,
    onSuccess: (data) => {
      // Update profile in cache
      queryClient.setQueryData(authKeys.profile('vendor'), data);
    },
  });
};

// Profile toggle hooks
export const useAvailableProfiles = () => {
  const { user } = useAuthSession();
  return useQuery({
    queryKey: [...authKeys.availableProfiles(), user?.id ?? ''],
    queryFn: () => authSDK.getAvailableProfiles(user?.id),
    enabled: false, // Don't auto-fetch, call manually when needed
  });
};

export const useToggleProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (request: ProfileToggleRequest) =>
      authSDK.toggleProfile({ ...request, userId: user?.id }),
    onSuccess: () => {
      // Invalidate profile queries
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
};

export const useCheckVendorEligibility = () => {
  return useQuery({
    queryKey: authKeys.eligibility(),
    queryFn: authSDK.checkVendorEligibility,
    enabled: false, // Don't auto-fetch, call manually when needed
  });
};


