"use client";

import { useCallback, useEffect, useState } from "react";
import { VendorDevice, PairingRequestResponse } from "@/types/vendor";

export function useVendorDevices() {
  const [devices, setDevices] = useState<VendorDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingRequestResponse | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as { devices: VendorDevice[] };
      setDevices(json.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPairingCode = useCallback(async () => {
    setPairingLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/device/pairing/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || `Status ${res.status}`;
        throw new Error(errorMessage);
      }
      const json = (await res.json()) as PairingRequestResponse;
      setPairing(json);
      return json;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("[useVendorDevices] requestPairingCode error:", err);
      throw err;
    } finally {
      setPairingLoading(false);
    }
  }, []);

  const revokeDevice = useCallback(async (deviceId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/vendor/devices/${deviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await fetchDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, [fetchDevices]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    pairing,
    pairingLoading,
    fetchDevices,
    requestPairingCode,
    revokeDevice,
    setPairing,
  };
}


