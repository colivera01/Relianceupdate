// src/hooks/useVendorMedia.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface MediaAsset {
  id: string;
  vendorId: string;
  membershipId: string | null;
  deviceId: string | null;
  bytes: string;
  mimeType: string;
  blobKey: string;
  blobUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface StorageInfo {
  totalBytes: string;
  totalMB: string;
  totalGB: string;
  assetCount?: number;
}

export function useVendorMedia(vendorId: string | null) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/media`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setAssets(json.assets);
      setStorage(json.storage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  const fetchStorage = useCallback(async () => {
    if (!vendorId) return;

    try {
      const res = await fetch(`/api/vendors/${vendorId}/media/storage`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setStorage(json.storage);
    } catch (err) {
      console.error("Error fetching storage:", err);
    }
  }, [vendorId]);

  const deleteAsset = useCallback(
    async (assetId: string) => {
      if (!vendorId) return;

      try {
        const res = await fetch(`/api/vendors/${vendorId}/media/${assetId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Status ${res.status}`);
        }
        const json = await res.json();
        // Update storage immediately
        setStorage(json.storage);
        // Remove from assets list
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        return json;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      }
    },
    [vendorId]
  );

  const initUpload = useCallback(
    async (fileName: string, fileSize: number, mimeType: string, deviceId?: string) => {
      if (!vendorId) throw new Error("Vendor ID required");

      const res = await fetch(`/api/vendors/${vendorId}/media/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          fileSize,
          mimeType,
          deviceId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }

      return await res.json();
    },
    [vendorId]
  );

  const completeUpload = useCallback(
    async (
      assetId: string,
      blobKey: string,
      blobUrl: string | null,
      bytes: number,
      mimeType: string,
      deviceId?: string
    ) => {
      if (!vendorId) throw new Error("Vendor ID required");

      const res = await fetch(`/api/vendors/${vendorId}/media/upload/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          blobKey,
          blobUrl,
          bytes,
          mimeType,
          deviceId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }

      const json = await res.json();
      // Update storage and refresh assets
      setStorage(json.storage);
      await fetchMedia();
      return json;
    },
    [vendorId, fetchMedia]
  );

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  return {
    assets,
    storage,
    loading,
    error,
    fetchMedia,
    fetchStorage,
    deleteAsset,
    initUpload,
    completeUpload,
  };
}

