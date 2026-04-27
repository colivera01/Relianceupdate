"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";

type StoragePayload = {
  usedBytes: string;
  limitBytes: string;
  percentUsed: number;
  totalGB?: string;
  limitGB?: string;
};

function formatBytes(value: bigint): string {
  const gb = Number(value) / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = Number(value) / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function VendorStoragePage() {
  const { data: profile, loading: profileLoading, error: profileError, approvalPending } = useVendorProfile();
  const vendorId = String(profile?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<StoragePayload | null>(null);

  useEffect(() => {
    if (profileLoading || approvalPending || !vendorId) {
      setLoading(profileLoading);
      return;
    }

    let cancelled = false;

    async function fetchStorage() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/vendors/${vendorId}/storage/usage`, {
          method: "GET",
          headers: getClientSessionHeaders(),
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(payload?.error || "Failed to load storage usage"));
        }
        const data = payload?.storage;
        if (!data || data.usedBytes == null || data.limitBytes == null) {
          throw new Error("Storage payload missing required fields");
        }
        if (!cancelled) {
          setStorage({
            usedBytes: String(data.usedBytes),
            limitBytes: String(data.limitBytes),
            percentUsed: Number(data.percentUsed || 0),
            totalGB: data.totalGB ? String(data.totalGB) : undefined,
            limitGB: data.limitGB ? String(data.limitGB) : undefined,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load storage usage");
          setStorage(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStorage();
    return () => {
      cancelled = true;
    };
  }, [approvalPending, profileLoading, vendorId]);

  const percent = useMemo(() => {
    if (!storage) return 0;
    return Math.max(0, Math.min(100, Number(storage.percentUsed || 0)));
  }, [storage]);

  const usedLabel = useMemo(() => {
    if (!storage) return "N/A";
    if (storage.totalGB) return `${storage.totalGB} GB`;
    return formatBytes(BigInt(storage.usedBytes || "0"));
  }, [storage]);

  const limitLabel = useMemo(() => {
    if (!storage) return "N/A";
    if (storage.limitGB) return `${storage.limitGB} GB`;
    return formatBytes(BigInt(storage.limitBytes || "0"));
  }, [storage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Storage Usage</h1>
          <p className="text-sm text-gray-600">Track your vendor media storage consumption.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/vendor/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

      {approvalPending ? (
        <Card>
          <CardContent className="pt-6 text-sm text-amber-700">
            Vendor account pending approval. Storage access unlocks after approval.
          </CardContent>
        </Card>
      ) : null}

      {profileError && !profileLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-red-600">{profileError}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">Loading storage usage...</CardContent>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-sm text-gray-600">Storage tracking is not fully connected yet.</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && !storage ? (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">Storage tracking is not fully connected yet.</CardContent>
        </Card>
      ) : null}

      {!loading && !error && storage ? (
        <Card>
          <CardHeader>
            <CardTitle>Current Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Used</span>
              <span className="font-medium text-gray-900">{usedLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Limit</span>
              <span className="font-medium text-gray-900">{limitLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Percent Used</span>
              <span className="font-medium text-gray-900">{percent.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
