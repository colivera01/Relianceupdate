import type { FavoritesListResponse } from "../types/api";
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
    params?: { page?: number; limit?: number },
    authUserIdFromCaller?: string
  ): Promise<FavoritesListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const query = searchParams.toString();
    return requestJson<FavoritesListResponse>(
      `/api/users/favorites${query ? `?${query}` : ""}`,
      {
        method: "GET",
      },
      authUserIdFromCaller
    );
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
};
