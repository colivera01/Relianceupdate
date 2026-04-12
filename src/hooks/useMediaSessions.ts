"use client";

import { useCallback, useState } from "react";

export type MediaSessionStatus =
  | "CREATED"
  | "RECORDING"
  | "UPLOADING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface MediaSession {
  id: string;
  vendorId: string;
  userId: string | null;
  employeeId: string | null;
  bookingId: string | null;
  serviceId: string | null;
  deviceId: string | null;
  deviceType: "PHONE" | "HEADSET" | null;
  sessionType: string;
  status: MediaSessionStatus;
  title: string | null;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaAssets?: any[];
  mediaAssetCount?: number;
}

export interface CreateMediaSessionInput {
  bookingId?: string;
  serviceId?: string;
  employeeId?: string;
  deviceId?: string;
  deviceType?: "PHONE" | "HEADSET";
  sessionType?: string;
  title?: string;
  description?: string;
  status?: MediaSessionStatus;
}

export interface SessionFilters {
  status?: MediaSessionStatus;
  sessionType?: string;
  deviceId?: string;
  bookingId?: string;
}

export function useMediaSessions(vendorId: string | null) {
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [currentSession, setCurrentSession] = useState<MediaSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (input: CreateMediaSessionInput = {}): Promise<MediaSession> => {
      if (!vendorId) throw new Error("Vendor ID required");
      setError(null);

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
      setCurrentSession(json.session);
      return json.session as MediaSession;
    },
    [vendorId]
  );

  const listSessions = useCallback(
    async (filters: SessionFilters = {}): Promise<MediaSession[]> => {
      if (!vendorId) return [];
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.status) params.set("status", filters.status);
        if (filters.sessionType) params.set("sessionType", filters.sessionType);
        if (filters.deviceId) params.set("deviceId", filters.deviceId);
        if (filters.bookingId) params.set("bookingId", filters.bookingId);

        const url = `/api/vendors/${vendorId}/media/sessions${
          params.toString() ? `?${params.toString()}` : ""
        }`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Status ${res.status}`);
        }

        const json = await res.json();
        setSessions(json.sessions || []);
        return json.sessions || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [vendorId]
  );

  const getSession = useCallback(
    async (sessionId: string): Promise<MediaSession> => {
      if (!vendorId) throw new Error("Vendor ID required");
      setError(null);

      const res = await fetch(`/api/vendors/${vendorId}/media/sessions/${sessionId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }

      const json = await res.json();
      setCurrentSession(json.session);
      return json.session as MediaSession;
    },
    [vendorId]
  );

  const updateSession = useCallback(
    async (
      sessionId: string,
      patch: {
        status?: MediaSessionStatus;
        endedAt?: string | null;
        title?: string;
        description?: string;
      }
    ): Promise<MediaSession> => {
      if (!vendorId) throw new Error("Vendor ID required");
      setError(null);

      const res = await fetch(`/api/vendors/${vendorId}/media/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status ${res.status}`);
      }

      const json = await res.json();
      setCurrentSession(json.session);
      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? json.session : session))
      );
      return json.session as MediaSession;
    },
    [vendorId]
  );

  return {
    sessions,
    currentSession,
    loading,
    error,
    createSession,
    listSessions,
    getSession,
    updateSession,
  };
}

