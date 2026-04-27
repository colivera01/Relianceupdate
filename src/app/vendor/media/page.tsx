"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { getClientSessionHeaders } from "@/lib/client-session";

type ArchiveFilter = "active" | "archived" | "all";

type VendorMediaAsset = {
  id: string;
  title: string;
  jobTitle: string | null;
  clientName: string | null;
  moderationStatus: string | null;
  archiveStatus: string | null;
  mimeType: string | null;
  createdAt: string;
};

function titleCase(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function VendorMediaPage() {
  const { data: profile, loading: profileLoading, error: profileError, approvalPending } = useVendorProfile();
  const vendorId = String(profile?.id || "").trim();

  const [filter, setFilter] = useState<ArchiveFilter>("active");
  const [assets, setAssets] = useState<VendorMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading || approvalPending || !vendorId) {
      setLoading(profileLoading);
      return;
    }

    let cancelled = false;

    async function fetchMedia() {
      setLoading(true);
      setError(null);
      try {
        const headers = getClientSessionHeaders();
        const res = await fetch(`/api/vendors/${vendorId}/media`, {
          method: "GET",
          headers,
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(payload?.error || "Failed to load vendor media"));
        }
        const rows = Array.isArray(payload?.assets) ? payload.assets : [];
        if (!cancelled) {
          setAssets(
            rows.map((row: any) => ({
              id: String(row?.id || row?.assetId || ""),
              title: String(row?.title || "Service Media"),
              jobTitle: row?.jobTitle ? String(row.jobTitle) : null,
              clientName: row?.clientName ? String(row.clientName) : null,
              moderationStatus: row?.moderationStatus ? String(row.moderationStatus) : null,
              archiveStatus: row?.archiveStatus ? String(row.archiveStatus) : null,
              mimeType: row?.mimeType ? String(row.mimeType) : null,
              createdAt: String(row?.createdAt || new Date().toISOString()),
            }))
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load media");
          setAssets([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMedia();
    return () => {
      cancelled = true;
    };
  }, [approvalPending, profileLoading, vendorId]);

  const filteredAssets = useMemo(() => {
    if (filter === "all") return assets;
    if (filter === "archived") {
      return assets.filter((asset) => String(asset.archiveStatus || "").toLowerCase() === "archived");
    }
    return assets.filter((asset) => String(asset.archiveStatus || "active").toLowerCase() !== "archived");
  }, [assets, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Media / Proof Library</h1>
          <p className="text-sm text-gray-600">Review approved, pending, and rejected media for your jobs.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/vendor/jobs">Back to Jobs</Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={filter === "active" ? "default" : "outline"} onClick={() => setFilter("active")}>
          Active
        </Button>
        <Button variant={filter === "archived" ? "default" : "outline"} onClick={() => setFilter("archived")}>
          Archived
        </Button>
        <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All
        </Button>
      </div>

      {approvalPending ? (
        <Card>
          <CardContent className="pt-6 text-sm text-amber-700">
            Vendor account pending approval. Media access unlocks after approval.
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
          <CardContent className="pt-6 text-sm text-gray-600">Loading media library...</CardContent>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-sm text-gray-600">Media management is being finalized.</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">Media management is being finalized.</CardContent>
        </Card>
      ) : null}

      {!loading && !error && filteredAssets.length > 0 ? (
        <div className="space-y-3">
          {filteredAssets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{asset.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{titleCase(asset.moderationStatus || "unknown") || "Unknown"}</Badge>
                  <Badge variant="secondary">{titleCase(asset.archiveStatus || "active") || "Active"}</Badge>
                  {asset.mimeType ? <Badge variant="outline">{asset.mimeType}</Badge> : null}
                </div>
                <p className="text-gray-700">
                  Job: <span className="font-medium">{asset.jobTitle || "N/A"}</span>
                </p>
                <p className="text-gray-700">
                  Client: <span className="font-medium">{asset.clientName || "N/A"}</span>
                </p>
                <p className="text-xs text-gray-500">Uploaded: {new Date(asset.createdAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
