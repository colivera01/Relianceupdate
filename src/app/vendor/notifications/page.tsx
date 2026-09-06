"use client";

import { Bell, CheckCircle2, Circle, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import type { VendorNotification } from "@/types/vendor";

type Filter = "all" | "unread" | "read";

export default function VendorNotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: vendor } = useVendorProfile();
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!vendor?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vendors/${encodeURIComponent(vendor.id)}/notifications`, {
        cache: "no-store",
        headers: getClientSessionHeaders(user?.id),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || "Unable to load notifications."));
      setNotifications(Array.isArray(body?.notifications) ? body.notifications : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // load is intentionally keyed to the resolved account identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, vendor?.id]);

  const visible = useMemo(() => notifications.filter((notification) => {
    if (filter === "unread") return !notification.read;
    if (filter === "read") return notification.read;
    return true;
  }), [filter, notifications]);

  const markRead = async (notification: VendorNotification) => {
    if (!vendor?.id || notification.read || notification.historical) return;
    const response = await fetch(
      `/api/vendors/${encodeURIComponent(vendor.id)}/notifications/${encodeURIComponent(notification.id)}/read`,
      { method: "POST", headers: getClientSessionHeaders(user?.id) },
    );
    if (!response.ok) throw new Error("Unable to mark notification as read.");
    setNotifications((items) => items.map((item) => item.id === notification.id
      ? { ...item, read: true, readAt: new Date().toISOString() }
      : item));
  };

  const viewDetails = async (notification: VendorNotification) => {
    try {
      await markRead(notification);
    } catch {
      // Read-state persistence is secondary; access to the work record must continue.
    }
    if (notification.href) router.push(notification.href);
  };

  return (
    <div className="space-y-6 text-white">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Vendor Manager</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold">
            <Bell className="h-7 w-7 text-blue-300" /> Notification history
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/68">
            Reliance Audit outcomes for this manager account. Historical notices remain readable without invented read dates.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notification filters">
        {(["all", "unread", "read"] as Filter[]).map((value) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : value === "unread" ? "Unread" : "Read"}
          </Button>
        ))}
      </div>

      {error ? (
        <Card className="border-rose-300/40 bg-rose-950/35 text-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p>{error}</p><Button type="button" onClick={() => void load()}>Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <p className="text-sm text-white/68">Loading notifications...</p>
      ) : visible.length === 0 ? (
        <Card className="border-white/10 bg-white/6 text-white">
          <CardContent className="p-6 text-sm text-white/68">No {filter === "all" ? "" : `${filter} `}notifications.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((notification) => (
            <Card key={notification.id} className="border-white/12 bg-[#0b1524] text-white">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  {notification.read
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 fill-blue-400 text-blue-400" />}
                  <div>
                    <p className="font-semibold text-white">{notification.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/72">{notification.message}</p>
                    <p className="mt-2 text-xs text-white/48">
                      {new Date(notification.time).toLocaleString()}
                      {notification.historical ? " · Historical notice" : ""}
                    </p>
                  </div>
                </div>
                {notification.href ? (
                  <Button type="button" variant="outline" onClick={() => void viewDetails(notification)}>
                    <ExternalLink className="mr-2 h-4 w-4" /> View details
                  </Button>
                ) : !notification.read && !notification.historical ? (
                  <Button type="button" variant="outline" onClick={() => void markRead(notification)}>
                    Mark read
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
