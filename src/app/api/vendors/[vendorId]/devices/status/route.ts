// src/app/api/vendors/[vendorId]/devices/status/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

type DeviceEventRow = {
  eventType: string;
  occurredAt: Date;
  receivedAt: Date;
  payloadJson: string | null;
  firmwareVersion: string | null;
  phoneAppVersion: string | null;
};

const ONLINE_MS = 2 * 60 * 1000;
const RECENTLY_SEEN_MS = 30 * 60 * 1000;
const RECENT_INDICATOR_MS = 30 * 60 * 1000;

function safeParseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readNumber(payload: Record<string, unknown> | null, keys: string[]): number | null {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }
  return null;
}

function readBoolean(payload: Record<string, unknown> | null, keys: string[]): boolean | null {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return null;
}

function isFatalError(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  if (payload.fatal === true) return true;
  const severity = String(payload.severity || payload.level || payload.errorSeverity || "").trim().toLowerCase();
  return severity === "fatal" || severity === "critical";
}

function deriveOnlineStatus(lastSeenAt: Date | null, now: Date): "online" | "recently_seen" | "offline" {
  if (!lastSeenAt) return "offline";
  const ageMs = now.getTime() - lastSeenAt.getTime();
  if (ageMs <= ONLINE_MS) return "online";
  if (ageMs <= RECENTLY_SEEN_MS) return "recently_seen";
  return "offline";
}

function deriveIndicator(events: DeviceEventRow[], now: Date): "error" | "low_battery" | "normal" {
  const recentEvents = events.filter((event) => now.getTime() - event.occurredAt.getTime() <= RECENT_INDICATOR_MS);
  const recentFatalError = recentEvents.find((event) => {
    if (event.eventType !== "error_reported") return false;
    return isFatalError(safeParseJson(event.payloadJson));
  });
  if (recentFatalError) return "error";

  const latestBatteryLow = events.find((event) => event.eventType === "battery_low");
  if (!latestBatteryLow) return "normal";

  const newerHealthyHeartbeat = events.find((event) => {
    if (event.eventType !== "heartbeat") return false;
    return event.occurredAt.getTime() > latestBatteryLow.occurredAt.getTime();
  });

  return newerHealthyHeartbeat ? "normal" : "low_battery";
}

function deriveBattery(events: DeviceEventRow[]): {
  batteryPercent: number | null;
  charging: boolean | null;
} {
  const batteryEvent = events.find((event) => event.eventType === "heartbeat" || event.eventType === "battery_low");
  const payload = safeParseJson(batteryEvent?.payloadJson);
  return {
    batteryPercent: readNumber(payload, ["batteryPercent", "battery", "battery_pct", "batteryPct"]),
    charging: readBoolean(payload, ["charging", "isCharging"]),
  };
}

/**
 * GET /api/vendors/[vendorId]/devices/status
 * Manager-only health summary for devices belonging to a vendor.
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await params;
    await requireVendorManager(request, vendorId);

    const now = new Date();
    const devices = await (prisma as any).device.findMany({
      where: { vendorId },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: {
            membership: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          take: 1,
        },
        deviceEvents: {
          orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
          take: 25,
          select: {
            eventType: true,
            occurredAt: true,
            receivedAt: true,
            payloadJson: true,
            firmwareVersion: true,
            phoneAppVersion: true,
          },
        },
      },
      orderBy: [{ lastSeenAt: "desc" }, { pairedAt: "desc" }],
    });

    const status = devices.map((device: any) => {
      const events = Array.isArray(device.deviceEvents) ? (device.deviceEvents as DeviceEventRow[]) : [];
      const latestEvent = events[0] || null;
      const assignment = Array.isArray(device.assignments) ? device.assignments[0] : null;
      const assignmentUser = assignment?.membership?.user || null;
      const latestWithFirmware = events.find((event) => event.firmwareVersion);
      const latestWithAppVersion = events.find((event) => event.phoneAppVersion);
      const battery = deriveBattery(events);

      return {
        deviceId: device.id,
        deviceUid: device.deviceUid,
        deviceType: device.deviceType,
        assignedEmployeeName: assignmentUser?.name || assignmentUser?.email || null,
        membershipId: assignment?.membershipId || null,
        lastSeenAt: device.lastSeenAt,
        onlineStatus: deriveOnlineStatus(device.lastSeenAt, now),
        latestEventType: latestEvent?.eventType || null,
        latestEventAt: latestEvent?.occurredAt || null,
        batteryPercent: battery.batteryPercent,
        charging: battery.charging,
        firmwareVersion: latestWithFirmware?.firmwareVersion || device.firmwareVersion || null,
        appVersion: latestWithAppVersion?.phoneAppVersion || device.appVersion || null,
        model: device.model || null,
        os: device.os || null,
        indicator: deriveIndicator(events, now),
      };
    });

    return NextResponse.json({
      success: true,
      devices: status,
      count: status.length,
      generatedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error("[devices/status] GET error:", error);
    if (String(error?.message || "") === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch device status", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

