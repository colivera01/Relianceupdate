import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { favoritesSDK } from "@/sdk/favorites";

export const favoriteKeys = {
  all: ["favorites"] as const,
  list: (params: Record<string, unknown>) => [...favoriteKeys.all, "list", params] as const,
};

export const useFavorites = (params?: { page?: number; limit?: number }) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: favoriteKeys.list({ ...(params || {}), _authUserId: user?.id ?? "" }),
    queryFn: () => favoritesSDK.listFavorites(params, user?.id),
    staleTime: 60 * 1000,
    retry: false,
  });
};

export const useFavoritesOptional = (params?: { page?: number; limit?: number }) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...favoriteKeys.list({ ...(params || {}), _authUserId: user?.id ?? "" }), "optional"] as const,
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
