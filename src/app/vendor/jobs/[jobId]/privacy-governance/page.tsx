"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { MediaLifecycleCard } from "@/components/service-video/MediaLifecycleCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";

export default function VendorPrivacyGovernancePage() {
  const params = useParams<{ jobId: string }>();
  const bookingId = String(params?.jobId || "").trim();
  const { user } = useAuth();
  const userId =
    typeof user?.id === "string" || typeof user?.id === "number"
      ? String(user.id)
      : "";
  const headers = useMemo(() => getClientSessionHeaders(userId), [userId]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadRole() {
      try {
        const response = await fetch("/api/vendor/context", {
          headers,
          cache: "no-store",
          credentials: "include",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error || "Vendor context unavailable");
        }
        if (active) setRole(String(body?.role || "").trim().toUpperCase());
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Vendor context unavailable",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadRole();
    return () => {
      active = false;
    };
  }, [headers]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-6">
        <Link
          href={`/vendor/jobs/${encodeURIComponent(bookingId)}`}
          className="text-sm text-blue-700 hover:underline"
        >
          Back to work record
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-950">
            Privacy &amp; Governance
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage protective privacy actions without changing the Service Video
            evidence lifecycle.
          </p>
        </div>
        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-gray-600">
              Checking manager authority...
            </CardContent>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <CardContent className="p-4 text-sm text-red-700">
              {error}
            </CardContent>
          </Card>
        ) : null}
        {!loading && !error && role !== "MANAGER" ? (
          <Card
            className="border-amber-300 bg-amber-50"
            data-testid="privacy-governance-denied"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-950">
                <ShieldAlert className="h-5 w-5" /> Manager authority required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900">
              Only an active Vendor Manager for this work record may use these
              Privacy &amp; Governance controls.
            </CardContent>
          </Card>
        ) : null}
        {!loading && !error && role === "MANAGER" && bookingId ? (
          <MediaLifecycleCard role="vendor" bookingId={bookingId} />
        ) : null}
      </div>
    </div>
  );
}
