"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

type DeviceTelemetryEvent = {
  id: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  deviceId: string;
  deviceUid: string | null;
  deviceType: string | null;
  vendorId: string;
  membershipId: string | null;
  bookingId: string | null;
  mediaSessionId: string | null;
  assetId: string | null;
  stage: string | null;
  firmwareVersion?: string | null;
  payload: Record<string, unknown> | null;
  contractVersion: string;
};

type DeviceStatusRow = {
  deviceId: string;
  deviceUid: string | null;
  deviceType: string;
  assignedEmployeeName: string | null;
  membershipId: string | null;
  lastSeenAt: string | null;
  onlineStatus: "online" | "recently_seen" | "offline";
  latestEventType: string | null;
  latestEventAt: string | null;
  batteryPercent: number | null;
  charging: boolean | null;
  firmwareVersion: string | null;
  appVersion: string | null;
  model: string | null;
  os: string | null;
  indicator: "error" | "low_battery" | "normal";
};

type ServiceVideoActivityRow = {
  id: string;
  bookingId: string | null;
  jobTitle: string;
  clientName: string | null;
  stage: string | null;
  moderationStatus: string;
  visibilityStatus: string;
  bytes: string;
  createdAt: string;
};

const SUPPORTED_EVENT_TYPES = [
  "device_boot",
  "device_paired",
  "heartbeat",
  "job_received",
  "recording_started",
  "recording_stopped",
  "upload_started",
  "upload_progress",
  "upload_completed",
  "upload_failed",
  "battery_low",
  "device_offline",
  "device_reconnected",
  "error_reported",
  "firmware_version_reported",
] as const;

function onlineStatusClass(status: DeviceStatusRow["onlineStatus"]) {
  if (status === "online") return "bg-green-100 text-green-800 border-green-200";
  if (status === "recently_seen") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function indicatorClass(indicator: DeviceStatusRow["indicator"]) {
  if (indicator === "error") return "bg-red-100 text-red-800 border-red-200";
  if (indicator === "low_battery") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-blue-50 text-blue-800 border-blue-200";
}

export default function VendorTelemetryPage() {
  const { user } = useAuth();
  const userId = useMemo(() => String(user?.id || "").trim(), [user?.id]);
  const { data: vendorProfile, loading: vendorProfileLoading } = useVendorProfile();
  const resolvedVendorId = useMemo(() => (vendorProfile?.id ? String(vendorProfile.id) : ""), [vendorProfile?.id]);

  const [events, setEvents] = useState<DeviceTelemetryEvent[]>([]);
  const [serviceVideoActivity, setServiceVideoActivity] = useState<ServiceVideoActivityRow[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [eventType, setEventType] = useState<string>("all");
  const [deviceUid, setDeviceUid] = useState<string>("");
  const [sinceLocal, setSinceLocal] = useState<string>(""); // datetime-local
  const [limit, setLimit] = useState<number>(50);

  const buildSinceIso = useCallback((): string | null => {
    const raw = sinceLocal.trim();
    if (!raw) return null;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }, [sinceLocal]);

  const fetchDeviceStatuses = useCallback(async () => {
    if (!userId) {
      setStatusError("Missing user session");
      return;
    }
    if (!resolvedVendorId) {
      setStatusError("Missing vendor context");
      return;
    }

    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/vendors/${resolvedVendorId}/devices/status`, {
        method: "GET",
        cache: "no-store",
        headers: {
          ...getClientSessionHeaders(userId),
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || json?.message || "Failed to fetch device status"));
      }

      const incoming = Array.isArray(json?.devices) ? json.devices : [];
      setDeviceStatuses(
        incoming.map((row: any) => ({
          deviceId: String(row.deviceId),
          deviceUid: row.deviceUid ? String(row.deviceUid) : null,
          deviceType: String(row.deviceType || "UNKNOWN"),
          assignedEmployeeName: row.assignedEmployeeName ? String(row.assignedEmployeeName) : null,
          membershipId: row.membershipId ? String(row.membershipId) : null,
          lastSeenAt: row.lastSeenAt ? String(row.lastSeenAt) : null,
          onlineStatus: ["online", "recently_seen", "offline"].includes(String(row.onlineStatus))
            ? row.onlineStatus
            : "offline",
          latestEventType: row.latestEventType ? String(row.latestEventType) : null,
          latestEventAt: row.latestEventAt ? String(row.latestEventAt) : null,
          batteryPercent: typeof row.batteryPercent === "number" ? row.batteryPercent : null,
          charging: typeof row.charging === "boolean" ? row.charging : null,
          firmwareVersion: row.firmwareVersion ? String(row.firmwareVersion) : null,
          appVersion: row.appVersion ? String(row.appVersion) : null,
          model: row.model ? String(row.model) : null,
          os: row.os ? String(row.os) : null,
          indicator: ["error", "low_battery", "normal"].includes(String(row.indicator))
            ? row.indicator
            : "normal",
        }))
      );
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to fetch device status");
      setDeviceStatuses([]);
    } finally {
      setStatusLoading(false);
    }
  }, [userId, resolvedVendorId]);

  const fetchEvents = useCallback(async () => {
    if (!userId) {
      setError("Missing user session");
      return;
    }
    if (!resolvedVendorId) {
      setError("Missing vendor context");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("vendorId", resolvedVendorId);

      if (eventType && eventType !== "all") params.set("eventType", eventType);
      if (deviceUid.trim()) params.set("deviceUid", deviceUid.trim());

      const sinceIso = buildSinceIso();
      if (sinceIso) params.set("since", sinceIso);

      const clampedLimit = Math.max(1, Math.min(200, Math.floor(limit || 50)));
      params.set("limit", String(clampedLimit));

      const res = await fetch(`/api/device/events?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          ...getClientSessionHeaders(userId),
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || json?.message || "Failed to fetch telemetry"));
      }

      const incoming = Array.isArray(json?.events) ? json.events : [];
      setEvents(
        incoming.map((e: any) => ({
          id: String(e.id),
          eventId: String(e.eventId),
          eventType: String(e.eventType),
          occurredAt: String(e.occurredAt),
          receivedAt: String(e.receivedAt),
          deviceId: String(e.deviceId),
          deviceUid: e.deviceUid ? String(e.deviceUid) : null,
          deviceType: e.deviceType ? String(e.deviceType) : null,
          vendorId: String(e.vendorId),
          membershipId: e.membershipId ? String(e.membershipId) : null,
          bookingId: e.bookingId ? String(e.bookingId) : null,
          mediaSessionId: e.mediaSessionId ? String(e.mediaSessionId) : null,
          assetId: e.assetId ? String(e.assetId) : null,
          stage: e.stage ? String(e.stage) : null,
          firmwareVersion: e.firmwareVersion ? String(e.firmwareVersion) : null,
          payload: e.payload && typeof e.payload === "object" ? e.payload : null,
          contractVersion: String(e.contractVersion || "1"),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch telemetry");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [userId, resolvedVendorId, eventType, deviceUid, sinceLocal, limit, buildSinceIso]);

  const fetchServiceVideoActivity = useCallback(async () => {
    if (!userId || !resolvedVendorId) return;
    setActivityError(null);
    try {
      const res = await fetch(`/api/vendors/${resolvedVendorId}/media?activity=true`, {
        method: "GET",
        cache: "no-store",
        headers: {
          ...getClientSessionHeaders(userId),
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || json?.message || "Failed to fetch service video activity"));
      }
      const incoming = Array.isArray(json?.assets) ? json.assets : [];
      setServiceVideoActivity(
        incoming
          .filter((asset: any) => String(asset?.sessionType || "").trim().toUpperCase() === "JOB_SERVICE_VIDEO")
          .map((asset: any) => ({
            id: String(asset.id || asset.assetId),
            bookingId: asset.bookingId ? String(asset.bookingId) : null,
            jobTitle: String(asset.jobTitle || asset.title || "Service video"),
            clientName: asset.clientName ? String(asset.clientName) : null,
            stage: asset.vendorJobVideoStage ? String(asset.vendorJobVideoStage) : null,
            moderationStatus: String(asset.moderationStatus || "pending_review"),
            visibilityStatus: String(asset.visibilityStatus || "private"),
            bytes: String(asset.bytes || "0"),
            createdAt: String(asset.createdAt),
          }))
      );
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : "Failed to fetch service video activity");
      setServiceVideoActivity([]);
    }
  }, [userId, resolvedVendorId]);

  const displayFilters = useMemo(() => {
    const parts: string[] = [];
    if (eventType && eventType !== "all") parts.push(`type=${eventType}`);
    if (deviceUid.trim()) parts.push(`device=${deviceUid.trim()}`);
    const sinceIso = buildSinceIso();
    if (sinceIso) parts.push(`since=${sinceIso}`);
    parts.push(`limit=${Math.max(1, Math.min(200, Math.floor(limit || 50)))}`);
    return parts.join(" · ");
  }, [eventType, deviceUid, sinceLocal, limit, buildSinceIso]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchDeviceStatuses(), fetchEvents(), fetchServiceVideoActivity()]);
  }, [fetchDeviceStatuses, fetchEvents, fetchServiceVideoActivity]);

  const showRawTelemetryForDevice = useCallback((uid: string | null) => {
    if (!uid) return;
    setDeviceUid(uid);
    setEventType("all");
    setSinceLocal("");
    setLimit(50);
  }, []);

  // Initial fetch once context is ready
  useEffect(() => {
    if (!vendorProfileLoading && resolvedVendorId && userId) {
      void refreshAll();
    }
  }, [vendorProfileLoading, resolvedVendorId, userId, refreshAll]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Video Activity</h1>
          <p className="text-sm text-gray-600 mt-1">
            See whether employee devices are connected and sending service-video activity for assigned work.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void refreshAll()}
          disabled={loading || statusLoading || vendorProfileLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {loading || statusLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent service video recordings</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            {serviceVideoActivity.length} upload{serviceVideoActivity.length === 1 ? "" : "s"} saved from employee service orders
          </p>
        </CardHeader>
        <CardContent>
          {activityError ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {activityError}
            </div>
          ) : null}

          {serviceVideoActivity.length === 0 ? (
            <div className="text-sm text-gray-600 py-4">No service video uploads have been saved yet.</div>
          ) : (
            <div className="space-y-3">
              {serviceVideoActivity.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold text-gray-900">{asset.jobTitle}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {asset.clientName ? <span>Client: {asset.clientName}</span> : null}
                        {asset.clientName && asset.bookingId ? <span> · </span> : null}
                        {asset.bookingId ? <span>Booking: {asset.bookingId}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {asset.stage ? <Badge variant="outline">{asset.stage.replace(/_/g, " ")}</Badge> : null}
                      <Badge variant="outline">{asset.moderationStatus.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline">{asset.visibilityStatus.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Saved: {new Date(asset.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Device Status</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            {statusLoading ? "Loading device status..." : `${deviceStatuses.length} device${deviceStatuses.length === 1 ? "" : "s"}` }
          </p>
        </CardHeader>
        <CardContent>
          {statusError ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {statusError}
            </div>
          ) : null}

          {deviceStatuses.length === 0 && !statusLoading ? (
            <div className="text-sm text-gray-600 py-4">No devices found for this vendor yet.</div>
          ) : null}

          <div className="grid grid-cols-1 gap-4">
            {deviceStatuses.map((device) => (
              <div key={device.deviceId} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{device.deviceUid || device.deviceId}</span>
                      <Badge variant="outline">{device.deviceType}</Badge>
                      <Badge variant="outline" className={onlineStatusClass(device.onlineStatus)}>
                        {device.onlineStatus}
                      </Badge>
                      <Badge variant="outline" className={indicatorClass(device.indicator)}>
                        {device.indicator}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <div>Assigned: {device.assignedEmployeeName || device.membershipId || "—"}</div>
                      <div>Last seen: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never"}</div>
                      <div>
                        Latest event: {device.latestEventType || "—"}
                        {device.latestEventAt ? ` at ${new Date(device.latestEventAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 min-w-[180px]">
                    <div>Battery: {device.batteryPercent === null ? "—" : `${device.batteryPercent}%`}</div>
                    <div>Charging: {device.charging === null ? "—" : device.charging ? "Yes" : "No"}</div>
                    <div>Firmware: {device.firmwareVersion || "—"}</div>
                    <div>App: {device.appVersion || "—"}</div>
                    <div>Model/OS: {[device.model, device.os].filter(Boolean).join(" / ") || "—"}</div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!device.deviceUid}
                    onClick={() => showRawTelemetryForDevice(device.deviceUid)}
                  >
                    View device events
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <p className="text-xs text-gray-500 mt-1">{displayFilters || "No filters"}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-600">Event Type</label>
              <Select value={eventType} onValueChange={(v) => setEventType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SUPPORTED_EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-600">Device UID</label>
              <Input value={deviceUid} onChange={(e) => setDeviceUid(e.target.value)} placeholder="e.g. hs_..." />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-600">Since</label>
              <Input type="datetime-local" value={sinceLocal} onChange={(e) => setSinceLocal(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-600">Limit</label>
              <Input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Latest events</CardTitle>
          <p className="text-xs text-gray-500 mt-1">{loading ? "Loading recent events..." : `${events.length} event${events.length === 1 ? "" : "s"}` }</p>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading ? (
            <div className="text-sm text-gray-600 py-4">No telemetry events matched your filters yet.</div>
          ) : null}

          <div className="space-y-4">
            {events.map((e) => (
              <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-blue-100 text-blue-800 border border-blue-200">{e.eventType}</Badge>
                      {e.stage ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                          {e.stage}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      <div>Device UID: {e.deviceUid || "—"}</div>
                    <div>Device Type: {e.deviceType || "—"}</div>
                      <div>Occurred: {new Date(e.occurredAt).toLocaleString()}</div>
                      <div>Received: {new Date(e.receivedAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    {e.bookingId ? <div>Booking: {e.bookingId}</div> : null}
                    {e.assetId ? <div>Asset: {e.assetId}</div> : null}
                    {e.firmwareVersion ? <div>FW: {e.firmwareVersion}</div> : null}
                  </div>
                </div>

                <details className="mt-3">
                  <summary className="text-xs text-blue-700 cursor-pointer">Payload</summary>
                  <pre className="mt-2 overflow-auto text-[11px] bg-gray-50 border rounded p-3">
                    {JSON.stringify(e.payload || {}, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

