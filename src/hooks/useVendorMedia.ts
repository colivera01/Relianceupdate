// src/hooks/useVendorMedia.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface MediaAsset {
  id: string;
  vendorId: string;
  membershipId: string | null;
  uploadedByMembershipId?: string | null;
  deviceId: string | null;
  bytes: string;
  mimeType: string;
  blobKey: string;
  blobUrl: string | null;
  moderationStatus?: string;
  visibilityStatus?: string;
  archiveStatus?: string;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface StorageInfo {
  totalBytes: string;
  totalMB: string;
  totalGB: string;
  assetCount?: number;
}

interface MediaSessionCreateInput {
  bookingId?: string;
  serviceId?: string;
  employeeId?: string;
  deviceId?: string;
  deviceType?: "PHONE" | "HEADSET";
  sessionType?: string;
  title?: string;
  description?: string;
}

interface InitUploadOptions {
  deviceId?: string;
  mediaSessionId?: string;
  autoCreateSession?: boolean;
  session?: MediaSessionCreateInput;
}

export function useVendorMedia(vendorId: string | null) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createMediaSession = useCallback(
    async (input: MediaSessionCreateInput = {}) => {
      if (!vendorId) throw new Error("Vendor ID required");
      const res = await fetch(`/api/vendors/${vendorId}/media/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }
      const json = await res.json();
      return json.session as { id: string; status: string };
    },
    [vendorId]
  );

  const updateMediaSession = useCallback(
    async (
      mediaSessionId: string,
      patch: {
        status?: "CREATED" | "RECORDING" | "UPLOADING" | "COMPLETED" | "FAILED" | "CANCELLED";
        endedAt?: string | null;
        title?: string;
        description?: string;
      }
    ) => {
      if (!vendorId) throw new Error("Vendor ID required");
      const res = await fetch(`/api/vendors/${vendorId}/media/sessions/${mediaSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }
      const json = await res.json();
      return json.session as { id: string; status: string };
    },
    [vendorId]
  );

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
    async (
      fileName: string,
      fileSize: number,
      mimeType: string,
      deviceIdOrOptions?: string | InitUploadOptions
    ) => {
      if (!vendorId) throw new Error("Vendor ID required");

      const options: InitUploadOptions =
        typeof deviceIdOrOptions === "string"
          ? { deviceId: deviceIdOrOptions }
          : deviceIdOrOptions || {};

      let mediaSessionId = options.mediaSessionId;
      if (!mediaSessionId && options.autoCreateSession) {
        const session = await createMediaSession({
          ...options.session,
          deviceId: options.deviceId || options.session?.deviceId,
          sessionType: options.session?.sessionType || "SERVICE_RECORD",
        });
        mediaSessionId = session.id;
        await updateMediaSession(mediaSessionId, { status: "UPLOADING" });
      }

      const res = await fetch(`/api/vendors/${vendorId}/media/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          expectedBytes: fileSize,
          fileSize,
          mimeType,
          deviceId: options.deviceId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }

      const json = await res.json();
      return {
        ...json,
        mediaSessionId: mediaSessionId || null,
      };
    },
    [vendorId, createMediaSession, updateMediaSession]
  );

  const completeUpload = useCallback(
    async (
      assetId: string,
      blobKey: string,
      blobUrl: string | null,
      bytes: number,
      mimeType: string,
      deviceId?: string,
      mediaSessionId?: string
    ) => {
      if (!vendorId) throw new Error("Vendor ID required");

      try {
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
            mediaSessionId,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Status ${res.status}`);
        }

        const json = await res.json();
        if (mediaSessionId) {
          await updateMediaSession(mediaSessionId, {
            status: "COMPLETED",
            endedAt: new Date().toISOString(),
          });
        }
        // Update storage and refresh assets
        setStorage(json.storage);
        await fetchMedia();
        return json;
      } catch (err) {
        if (mediaSessionId) {
          await updateMediaSession(mediaSessionId, {
            status: "FAILED",
            endedAt: new Date().toISOString(),
          }).catch(() => {
            // Best effort status update; preserve original upload error.
          });
        }
        throw err;
      }
    },
    [vendorId, fetchMedia, updateMediaSession]
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
    createMediaSession,
    updateMediaSession,
    initUpload,
    completeUpload,
  };
}

