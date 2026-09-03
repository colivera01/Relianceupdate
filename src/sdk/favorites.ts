import type { FavoriteListItem, FavoritesListResponse, Pagination } from "../types/api";
import { getClientAuthHeaders } from "@/lib/client-session";

type FavoritesHttpError = Error & { status?: number };

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  authUserIdFromCaller?: string
): Promise<T> {
  void authUserIdFromCaller;
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getClientAuthHeaders(),
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.details ? ` (${String(payload.details)})` : "";
    const err = new Error(
      `${payload?.error || payload?.message || `HTTP ${response.status}`}${detail}`
    ) as FavoritesHttpError;
    err.status = response.status;
    throw err;
  }

  return response.json() as Promise<T>;
}

export const favoritesSDK = {
  async listFavorites(
    params?: { page?: number; limit?: number; type?: 'service'; search?: string; serviceId?: string },
    authUserIdFromCaller?: string
  ): Promise<FavoritesListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.type) searchParams.set("type", params.type);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.serviceId) searchParams.set("serviceId", params.serviceId);
    const query = searchParams.toString();
    return requestJson<FavoritesListResponse>(
      `/api/users/favorites${query ? `?${query}` : ""}`,
      {
        method: "GET",
      },
      authUserIdFromCaller
    );
  },

  async listAllFavorites(
    params?: { page?: number; limit?: number; type?: 'all' | 'service' | 'vendor'; search?: string },
    authUserIdFromCaller?: string
  ): Promise<{ success: boolean; items: FavoriteListItem[]; counts: { all: number; services: number; vendors: number }; pagination: Pagination }> {
    const searchParams = new URLSearchParams();
    searchParams.set('type', params?.type || 'all');
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    return requestJson(`/api/users/favorites?${searchParams.toString()}`, { method: 'GET' }, authUserIdFromCaller);
  },

  async getVendorFavorite(vendorId: string, authUserIdFromCaller?: string): Promise<FavoriteListItem | null> {
    const searchParams = new URLSearchParams({ type: 'vendor', vendorId, limit: '1' });
    const response = await requestJson<{ items?: FavoriteListItem[] }>(
      `/api/users/favorites?${searchParams.toString()}`,
      { method: 'GET' },
      authUserIdFromCaller
    );
    return response.items?.[0] || null;
  },

  async addFavorite(
    serviceId: string,
    authUserIdFromCaller?: string
  ): Promise<{
    success: boolean;
    favorite: { favoriteId: string; serviceId: string; favoritedAt: string };
    message: string;
  }> {
    return requestJson(
      "/api/users/favorites",
      {
        method: "POST",
        body: JSON.stringify({
          serviceId,
        }),
      },
      authUserIdFromCaller
    );
  },

  async removeFavorite(
    id: string,
    authUserIdFromCaller?: string
  ): Promise<{
    success: boolean;
    removed: { favoriteId: string; serviceId: string };
    message: string;
  }> {
    return requestJson(
      `/api/users/favorites/${id}`,
      {
        method: "DELETE",
      },
      authUserIdFromCaller
    );
  },

  async addVendorFavorite(vendorId: string, authUserIdFromCaller?: string) {
    return requestJson<{ success: boolean; favorite: { entityType: 'vendor'; favoriteId: string; vendorId: string; favoritedAt: string }; message: string }>(
      '/api/users/favorites',
      { method: 'POST', body: JSON.stringify({ entityType: 'vendor', vendorId }) },
      authUserIdFromCaller
    );
  },

  async removeVendorFavorite(id: string, authUserIdFromCaller?: string) {
    return requestJson<{ success: boolean; removed: { entityType: 'vendor'; favoriteId: string; vendorId: string }; message: string }>(
      `/api/users/favorites/${id}?type=vendor`,
      { method: 'DELETE' },
      authUserIdFromCaller
    );
  },
};
