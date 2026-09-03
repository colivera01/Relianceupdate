import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { favoritesSDK } from "@/sdk/favorites";

export const favoriteKeys = {
  all: ["favorites"] as const,
  list: (params: Record<string, unknown>) => [...favoriteKeys.all, "list", params] as const,
};

export const useFavorites = (params?: { page?: number; limit?: number; type?: 'service'; search?: string; serviceId?: string }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  return useQuery({
    queryKey: favoriteKeys.list({
      ...(params || {}),
      _authUserId: user?.id ?? "",
      _authReady: !isLoading,
      _authenticated: isAuthenticated,
    }),
    queryFn: () => favoritesSDK.listFavorites(params, user?.id),
    enabled: !isLoading && isAuthenticated,
    staleTime: 60 * 1000,
    retry: false,
  });
};

export const useFavoritesOptional = (params?: { page?: number; limit?: number; type?: 'service'; search?: string; serviceId?: string }) => {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: [
      ...favoriteKeys.list({
        ...(params || {}),
        _authUserId: user?.id ?? "",
        _authReady: !isLoading,
      }),
      "optional",
    ] as const,
    queryFn: async () => {
      try {
        return await favoritesSDK.listFavorites(params, user?.id);
      } catch (error: unknown) {
        const status = (error as { status?: number })?.status;
        if (status === 401) {
          return {
            success: true,
            favorites: [],
            pagination: { page: params?.page || 1, limit: params?.limit || 0, total: 0, totalPages: 0 },
          };
        }
        throw error;
      }
    },
    enabled: !isLoading,
    staleTime: 60 * 1000,
    retry: false,
  });
};

export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (serviceId: string) => favoritesSDK.addFavorite(serviceId, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => favoritesSDK.removeFavorite(id, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
};

export const useAllFavorites = (params?: { page?: number; limit?: number; type?: 'all' | 'service' | 'vendor'; search?: string }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  return useQuery({
    queryKey: favoriteKeys.list({ ...(params || {}), scope: 'all-supported', _authUserId: user?.id ?? '' }),
    queryFn: () => favoritesSDK.listAllFavorites(params, user?.id),
    enabled: !isLoading && isAuthenticated,
    staleTime: 60 * 1000,
    retry: false,
  });
};

export const useVendorFavorite = (vendorId: string) => {
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAuth();
  const query = useQuery({
    queryKey: [...favoriteKeys.all, 'vendor', vendorId, user?.id || ''],
    queryFn: () => favoritesSDK.getVendorFavorite(vendorId, user?.id),
    enabled: Boolean(vendorId) && !isLoading && isAuthenticated,
    staleTime: 60 * 1000,
    retry: false,
  });
  const add = useMutation({
    mutationFn: () => favoritesSDK.addVendorFavorite(vendorId, user?.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: favoriteKeys.all }),
  });
  const remove = useMutation({
    mutationFn: (favoriteId: string) => favoritesSDK.removeVendorFavorite(favoriteId, user?.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: favoriteKeys.all }),
  });
  return { ...query, add, remove, isAuthenticated };
};
