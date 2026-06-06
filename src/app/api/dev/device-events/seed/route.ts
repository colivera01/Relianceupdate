// src/app/api/dev/device-events/seed/route.ts
//
// DEVELOPMENT-ONLY ROUTE
// Generates a synthetic Gen-1 device event sequence for local/test use so the
// telemetry + status UI can be exercised without real headset hardware.
//
// Two modes:
//   - direct (default):     writes events directly via Prisma (fast path).
//   - ingest (opt-in):      sends each event through the shared
//                           ingestDeviceEvent helper that the public
//                           POST /api/device/events route uses, exercising
//                           envelope validation + idempotency end-to-end.
//
// Optional duplicateTest flag re-sends one event with the same eventId so we
// can verify the duplicate: true response path.
//
// Security:
// - Returns 404 in production.
// - Requires an authenticated user.
// - Requires an ACTIVE vendor membership for the supplied vendorId (no
//   cross-vendor seeding, even in dev).
//
// Not exposed in navigation. Not used by production code paths.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { requireVendorMembership } from "@/lib/membership-auth";
import { ingestDeviceEvent, type DeviceEventEnvelope } from "@/lib/device-events";

type SeedBody = {
  vendorId?: unknown;
  deviceUid?: unknown;
  includeError?: unknown;
  batteryPercent?: unknown;
  ingest?: unknown;
  duplicateTest?: unknown;
};

type PlannedEvent = {
  eventType: string;
  offsetMs: number;
  payload: Record<string, unknown>;
  context?: Record<string, unknown>;
};

type EnvelopedEvent = {
  envelope: DeviceEventEnvelope;
  occurredAt: Date;
  bookingId: string | null;
  stage: string | null;
};

const DEFAULT_DEVICE_UID = "hs_dev_test_001";
const DEFAULT_BATTERY = 72;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function clampBattery(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function readBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function makeEventId(prefix: string, index: number): string {
  return `${prefix}_${index}_${randomUUID()}`;
}

function planSequence(opts: {
  bookingId: string | null;
  batteryPercent: number;
  lowBatteryPercent: number;
  firmwareVersion: string;
  includeError: boolean;
}): PlannedEvent[] {
  const { bookingId, batteryPercent, lowBatteryPercent, firmwareVersion, includeError } = opts;
  const planned: PlannedEvent[] = [];
  planned.push({
    eventType: "device_boot",
    offsetMs: -9 * 60_000,
    payload: { firmwareVersion, bootReason: "power_on" },
  });
  planned.push({
    eventType: "device_paired",
    offsetMs: -8.5 * 60_000,
    payload: { pairingMode: "phone_bridge" },
  });
  planned.push({
    eventType: "heartbeat",
    offsetMs: -8 * 60_000,
    payload: { batteryPercent, charging: false, rssi: -55 },
  });
  if (bookingId) {
    planned.push({
      eventType: "job_received",
      offsetMs: -7 * 60_000,
      payload: { bookingId },
      context: { bookingId },
    });
  }
  planned.push({
    eventType: "recording_started",
    offsetMs: -6 * 60_000,
    payload: { stage: "BEFORE", source: "headset" },
    context: bookingId ? { bookingId, stage: "BEFORE" } : { stage: "BEFORE" },
  });
  planned.push({
    eventType: "recording_stopped",
    offsetMs: -5 * 60_000,
    payload: { stage: "BEFORE", durationSec: 60 },
    context: bookingId ? { bookingId, stage: "BEFORE" } : { stage: "BEFORE" },
  });
  planned.push({
    eventType: "upload_started",
    offsetMs: -4 * 60_000,
    payload: { stage: "BEFORE", bytes: 1_048_576 },
    context: bookingId ? { bookingId, stage: "BEFORE" } : { stage: "BEFORE" },
  });
  planned.push({
    eventType: "upload_completed",
    offsetMs: -3 * 60_000,
    payload: { stage: "BEFORE", bytes: 1_048_576, durationMs: 4500 },
    context: bookingId ? { bookingId, stage: "BEFORE" } : { stage: "BEFORE" },
  });
  planned.push({
    eventType: "battery_low",
    offsetMs: -2 * 60_000,
    payload: { batteryPercent: lowBatteryPercent, threshold: 20 },
  });
  if (includeError) {
    planned.push({
      eventType: "error_reported",
      offsetMs: -1 * 60_000,
      payload: {
        severity: "fatal",
        code: "DEV_TEST_ERROR",
        message: "Synthetic dev-only fatal error from seed route",
      },
    });
  }
  return planned;
}

function buildEnvelopes(
  planned: PlannedEvent[],
  opts: {
    now: number;
    seedPrefix: string;
    vendorId: string;
    deviceUid: string;
    deviceType: string;
    membershipId: string;
    firmwareVersion: string;
    phoneAppVersion: string;
  }
): EnvelopedEvent[] {
  const out: EnvelopedEvent[] = [];
  for (let i = 0; i < planned.length; i++) {
    const step = planned[i];
    const occurredAt = new Date(opts.now + step.offsetMs);
    const eventId = makeEventId(opts.seedPrefix, i);
    const contextObj: Record<string, unknown> = step.context ? { ...step.context } : {};
    const stage = typeof contextObj.stage === "string" ? (contextObj.stage as string) : null;
    const bookingForEvent =
      typeof contextObj.bookingId === "string" ? (contextObj.bookingId as string) : null;

    const envelope: DeviceEventEnvelope = {
      eventId,
      eventType: step.eventType,
      occurredAt: occurredAt.toISOString(),
      deviceUid: opts.deviceUid,
      deviceType: opts.deviceType,
      vendorId: opts.vendorId,
      membershipId: opts.membershipId,
      firmwareVersion: opts.firmwareVersion,
      phoneAppVersion: opts.phoneAppVersion,
      context: Object.keys(contextObj).length ? contextObj : undefined,
      payload: step.payload,
    };

    out.push({ envelope, occurredAt, bookingId: bookingForEvent, stage });
  }
  return out;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Not available in production" },
      { status: 404 }
    );
  }

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as SeedBody;

    const vendorId = normalizeText(body?.vendorId);
    if (!vendorId) {
      return NextResponse.json(
        { success: false, error: "vendorId is required" },
        { status: 422 }
      );
    }

    let membership;
    try {
      membership = await requireVendorMembership(request, vendorId);
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "Unauthorized") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      if (message.includes("Forbidden")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Active membership required for vendorId" },
          { status: 403 }
        );
      }
      throw error;
    }

    const deviceUid = normalizeText(body?.deviceUid) || DEFAULT_DEVICE_UID;
    const includeError = readBoolean(body?.includeError);
    const ingestMode = readBoolean(body?.ingest);
    const duplicateTest = readBoolean(body?.duplicateTest);
    const batteryPercent = clampBattery(body?.batteryPercent, DEFAULT_BATTERY);
    const lowBatteryPercent = Math.min(15, Math.max(1, Math.round(batteryPercent / 5)));

    // Find or create the device, scoped to vendor.
    let device = await (prisma as any).device.findFirst({
      where: { vendorId, deviceUid },
      select: {
        id: true,
        vendorId: true,
        deviceUid: true,
        deviceType: true,
        isActive: true,
      },
    });

    if (!device) {
      const conflicting = await (prisma as any).device.findFirst({
        where: { deviceUid },
        select: { id: true, vendorId: true },
      });
      if (conflicting && conflicting.vendorId !== vendorId) {
        return NextResponse.json(
          {
            success: false,
            error: "deviceUid already exists for a different vendor",
          },
          { status: 409 }
        );
      }

      device = await (prisma as any).device.create({
        data: {
          vendorId,
          deviceUid,
          deviceName: "Reliance Headset Dev",
          deviceType: "HEADSET",
          isActive: true,
          firmwareVersion: "dev-1.0.0",
          model: "Reliance Headset Dev",
          os: "rcos-dev",
          appVersion: "dev-1.0.0",
        },
        select: {
          id: true,
          vendorId: true,
          deviceUid: true,
          deviceType: true,
          isActive: true,
        },
      });
    }

    if (!device?.isActive) {
      return NextResponse.json(
        { success: false, error: "Device is inactive" },
        { status: 403 }
      );
    }

    const recentBooking = await prisma.booking.findFirst({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const bookingId = recentBooking?.id || null;

    const now = Date.now();
    const seedPrefix = `dev_seed_${now}`;
    const firmwareVersion = "dev-1.0.0";
    const phoneAppVersion = "dev-1.0.0";

    const planned = planSequence({
      bookingId,
      batteryPercent,
      lowBatteryPercent,
      firmwareVersion,
      includeError,
    });

    const envelopes = buildEnvelopes(planned, {
      now,
      seedPrefix,
      vendorId,
      deviceUid,
      deviceType: String(device.deviceType || "HEADSET").toUpperCase(),
      membershipId: membership.membershipId,
      firmwareVersion,
      phoneAppVersion,
    });

    const created: Array<{
      eventId: string;
      eventType: string;
      occurredAt: string;
      bookingId: string | null;
      stage: string | null;
    }> = [];

    const ingestionResults: Array<{
      eventId: string;
      eventType: string;
      status: number;
      duplicate: boolean;
      error?: string;
    }> = [];

    let latestOccurredAt = envelopes[envelopes.length - 1].occurredAt;
    let firstIngestEnvelope: DeviceEventEnvelope | null = null;

    if (ingestMode) {
      for (const item of envelopes) {
        const eventId = String(item.envelope.eventId);
        const eventType = String(item.envelope.eventType);
        try {
          const outcome = await ingestDeviceEvent(item.envelope, {
            vendorId,
            membershipId: membership.membershipId,
            userId: membership.userId,
          });
          ingestionResults.push({
            eventId,
            eventType,
            status: outcome.status,
            duplicate: Boolean(outcome.duplicate),
            error:
              outcome.status >= 400
                ? String((outcome.body as Record<string, unknown>)?.error || "ingest_error")
                : undefined,
          });

          if (outcome.status === 200 && !outcome.duplicate) {
            created.push({
              eventId,
              eventType,
              occurredAt: item.occurredAt.toISOString(),
              bookingId: item.bookingId,
              stage: item.stage,
            });
            if (!firstIngestEnvelope) {
              firstIngestEnvelope = item.envelope;
            }
            if (item.occurredAt > latestOccurredAt) latestOccurredAt = item.occurredAt;
          }
        } catch (error: any) {
          ingestionResults.push({
            eventId,
            eventType,
            status: 500,
            duplicate: false,
            error: error?.message || String(error),
          });
        }
      }
    } else {
      for (const item of envelopes) {
        const eventId = String(item.envelope.eventId);
        const eventType = String(item.envelope.eventType);
        const contextObj = (item.envelope.context as Record<string, unknown>) || {};
        try {
          await (prisma as any).deviceEvent.create({
            data: {
              eventId,
              eventType,
              occurredAt: item.occurredAt,
              deviceId: device.id,
              vendorId,
              membershipId: membership.membershipId,
              bookingId: item.bookingId,
              mediaSessionId: null,
              assetId: null,
              stage: item.stage,
              payloadJson: JSON.stringify(item.envelope.payload),
              contextJson: Object.keys(contextObj).length ? JSON.stringify(contextObj) : null,
              firmwareVersion,
              phoneAppVersion,
            },
          });
          created.push({
            eventId,
            eventType,
            occurredAt: item.occurredAt.toISOString(),
            bookingId: item.bookingId,
            stage: item.stage,
          });
          if (item.occurredAt > latestOccurredAt) latestOccurredAt = item.occurredAt;
        } catch (error: any) {
          if (String(error?.code || "") === "P2002") continue;
          throw error;
        }
      }
    }

    let duplicateResult: {
      mode: "ingest" | "direct";
      eventId: string | null;
      eventType: string | null;
      status: number;
      duplicate: boolean;
      error?: string;
    } | null = null;

    if (duplicateTest) {
      if (ingestMode) {
        const target = firstIngestEnvelope || envelopes[0]?.envelope || null;
        if (target) {
          try {
            const outcome = await ingestDeviceEvent(target, {
              vendorId,
              membershipId: membership.membershipId,
              userId: membership.userId,
            });
            duplicateResult = {
              mode: "ingest",
              eventId: String(target.eventId || ""),
              eventType: String(target.eventType || ""),
              status: outcome.status,
              duplicate: Boolean(outcome.duplicate),
              error:
                outcome.status >= 400
                  ? String((outcome.body as Record<string, unknown>)?.error || "ingest_error")
                  : undefined,
            };
          } catch (error: any) {
            duplicateResult = {
              mode: "ingest",
              eventId: String(target.eventId || ""),
              eventType: String(target.eventType || ""),
              status: 500,
              duplicate: false,
              error: error?.message || String(error),
            };
          }
        }
      } else {
        const target = created[0] || null;
        if (target) {
          let isDuplicate = false;
          let status = 200;
          let errorMessage: string | undefined;
          try {
            await (prisma as any).deviceEvent.create({
              data: {
                eventId: target.eventId,
                eventType: target.eventType,
                occurredAt: new Date(target.occurredAt),
                deviceId: device.id,
                vendorId,
                membershipId: membership.membershipId,
                bookingId: target.bookingId,
                mediaSessionId: null,
                assetId: null,
                stage: target.stage,
                payloadJson: JSON.stringify({}),
                contextJson: null,
                firmwareVersion,
                phoneAppVersion,
              },
            });
          } catch (error: any) {
            if (String(error?.code || "") === "P2002") {
              isDuplicate = true;
            } else {
              status = 500;
              errorMessage = error?.message || String(error);
            }
          }
          duplicateResult = {
            mode: "direct",
            eventId: target.eventId,
            eventType: target.eventType,
            status,
            duplicate: isDuplicate,
            error: errorMessage,
          };
        }
      }
    }

    await (prisma as any).device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: latestOccurredAt,
        firmwareVersion,
        appVersion: phoneAppVersion,
      },
    });

    return NextResponse.json({
      success: true,
      mode: ingestMode ? "ingest" : "direct",
      created: created.length,
      deviceUid,
      vendorId,
      bookingId,
      events: created,
      ingestionResults: ingestMode ? ingestionResults : [],
      duplicateResult,
      note: "Dev-only synthetic events. Not for production use.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed device events",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
