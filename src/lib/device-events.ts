// src/lib/device-events.ts
//
// Shared ingestion helper for Gen-1 device telemetry events. The public
// POST /api/device/events route and the dev-only seeder both call this so we
// have a single source of truth for envelope validation, idempotency,
// device-row updates, and lifecycle audits.

import { prisma } from "@/server/db";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

export const SUPPORTED_DEVICE_EVENT_TYPES = new Set([
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
]);

export const SUPPORTED_DEVICE_TYPES = new Set(["PHONE", "HEADSET"]);

export type DeviceEventEnvelope = {
  eventId?: unknown;
  eventType?: unknown;
  occurredAt?: unknown;
  deviceUid?: unknown;
  deviceType?: unknown;
  vendorId?: unknown;
  membershipId?: unknown;
  firmwareVersion?: unknown;
  phoneAppVersion?: unknown;
  context?: unknown;
  payload?: unknown;
};

export type IngestAuthContext = {
  vendorId: string;
  membershipId: string;
  userId: string;
};

export type IngestOutcome = {
  status: number;
  body: Record<string, unknown>;
  duplicate?: boolean;
};

type EventContext = {
  bookingId?: string;
  mediaSessionId?: string;
  assetId?: string;
  stage?: string;
};

export function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseOccurredAt(value: unknown): Date | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function buildAck(eventId: string, duplicate: boolean) {
  return {
    ok: true,
    eventId,
    ackedAt: new Date().toISOString(),
    duplicate,
    command: null,
  };
}

export function extractContext(rawContext: unknown): {
  context: EventContext | null;
  contextJson: string | null;
} {
  if (!isObject(rawContext)) {
    return { context: null, contextJson: null };
  }
  const context: EventContext = {
    bookingId: normalizeText(rawContext.bookingId) || undefined,
    mediaSessionId: normalizeText(rawContext.mediaSessionId) || undefined,
    assetId: normalizeText(rawContext.assetId) || undefined,
    stage: normalizeText(rawContext.stage) || undefined,
  };

  const hasAny = Boolean(
    context.bookingId || context.mediaSessionId || context.assetId || context.stage
  );
  const contextJson = JSON.stringify(rawContext);
  return {
    context: hasAny ? context : null,
    contextJson,
  };
}

/**
 * Ingest a device telemetry event using a pre-validated auth context.
 *
 * The caller is responsible for proving (vendorId, membershipId, userId) is a
 * valid active membership for the request. The helper enforces:
 *   - envelope validation
 *   - vendorId in the body matches the authenticated vendorId
 *   - membershipId in the body, if present, matches the authenticated one
 *   - device exists for the vendor and is active
 *   - deviceType matches registered device
 *   - eventId uniqueness (P2002 → duplicate: true)
 *   - lastSeenAt + (optional) firmwareVersion update on the Device row
 *   - lifecycle audit on fatal error_reported
 */
export async function ingestDeviceEvent(
  envelope: DeviceEventEnvelope,
  auth: IngestAuthContext
): Promise<IngestOutcome> {
  const eventId = normalizeText(envelope?.eventId);
  if (!eventId) {
    return { status: 422, body: { error: "eventId is required" } };
  }

  const eventType = normalizeText(envelope?.eventType).toLowerCase();
  if (!eventType) {
    return { status: 422, body: { error: "eventType is required" } };
  }
  if (!SUPPORTED_DEVICE_EVENT_TYPES.has(eventType)) {
    return {
      status: 422,
      body: {
        error: "Unsupported eventType",
        supportedEventTypes: Array.from(SUPPORTED_DEVICE_EVENT_TYPES),
      },
    };
  }

  const occurredAt = parseOccurredAt(envelope?.occurredAt);
  if (!occurredAt) {
    return {
      status: 422,
      body: { error: "occurredAt is required and must be a valid ISO date" },
    };
  }

  const deviceUid = normalizeText(envelope?.deviceUid);
  if (!deviceUid) {
    return { status: 422, body: { error: "deviceUid is required" } };
  }

  const deviceType = normalizeText(envelope?.deviceType).toUpperCase();
  if (!deviceType) {
    return { status: 422, body: { error: "deviceType is required" } };
  }
  if (!SUPPORTED_DEVICE_TYPES.has(deviceType)) {
    return {
      status: 422,
      body: {
        error: "Unsupported deviceType",
        supportedDeviceTypes: Array.from(SUPPORTED_DEVICE_TYPES),
      },
    };
  }

  const bodyVendorId = normalizeText(envelope?.vendorId);
  if (!bodyVendorId) {
    return { status: 422, body: { error: "vendorId is required" } };
  }
  if (bodyVendorId !== auth.vendorId) {
    return {
      status: 403,
      body: {
        error: "vendorId does not match authenticated vendor membership",
        expectedVendorId: auth.vendorId,
      },
    };
  }

  if (!isObject(envelope?.payload)) {
    return {
      status: 422,
      body: { error: "payload is required and must be an object" },
    };
  }

  const incomingMembershipId = normalizeText(envelope?.membershipId);
  if (incomingMembershipId && incomingMembershipId !== auth.membershipId) {
    return {
      status: 403,
      body: {
        error: "membershipId does not match authenticated vendor membership",
        expectedMembershipId: auth.membershipId,
      },
    };
  }

  const device = await (prisma as any).device.findFirst({
    where: {
      vendorId: auth.vendorId,
      deviceUid,
    },
    select: {
      id: true,
      vendorId: true,
      isActive: true,
      deviceType: true,
    },
    orderBy: { pairedAt: "desc" },
  });

  if (!device) {
    return {
      status: 404,
      body: { error: "Unknown deviceUid for supplied vendorId" },
    };
  }

  if (!device.isActive) {
    return { status: 403, body: { error: "Device is inactive" } };
  }

  if (normalizeText(device.deviceType).toUpperCase() !== deviceType) {
    return {
      status: 422,
      body: {
        error: "deviceType does not match registered device",
        registeredDeviceType: normalizeText(device.deviceType).toUpperCase(),
      },
    };
  }

  const { context, contextJson } = extractContext(envelope?.context);
  const payloadJson = JSON.stringify(envelope.payload);
  const normalizedFirmwareVersion = normalizeText(envelope?.firmwareVersion) || null;
  const normalizedPhoneAppVersion = normalizeText(envelope?.phoneAppVersion) || null;

  let duplicate = false;
  try {
    await (prisma as any).deviceEvent.create({
      data: {
        eventId,
        eventType,
        occurredAt,
        deviceId: String(device.id),
        vendorId: auth.vendorId,
        membershipId: auth.membershipId,
        bookingId: context?.bookingId || null,
        mediaSessionId: context?.mediaSessionId || null,
        assetId: context?.assetId || null,
        stage: context?.stage || null,
        payloadJson,
        contextJson,
        firmwareVersion: normalizedFirmwareVersion,
        phoneAppVersion: normalizedPhoneAppVersion,
      },
    });
  } catch (error: any) {
    if (String(error?.code || "") === "P2002") {
      duplicate = true;
    } else {
      throw error;
    }
  }

  const deviceUpdateData: Record<string, unknown> = {
    lastSeenAt: new Date(),
  };

  if (eventType === "firmware_version_reported" && normalizedFirmwareVersion) {
    deviceUpdateData.firmwareVersion = normalizedFirmwareVersion;
  }

  await (prisma as any).device.update({
    where: { id: String(device.id) },
    data: deviceUpdateData,
  });

  if (!duplicate && eventType === "error_reported") {
    const severity = normalizeText(
      (envelope.payload as Record<string, unknown>)?.severity
    ).toLowerCase();
    if (severity === "fatal") {
      await recordLifecycleAudit({
        actionType: "device_error",
        entityType: "device",
        entityId: String(device.id),
        actorUserId: auth.userId,
        newValue: {
          eventId,
          eventType,
          severity,
          occurredAt: occurredAt.toISOString(),
        },
        metadata: {
          vendorId: auth.vendorId,
          membershipId: auth.membershipId,
          deviceUid,
          payload: envelope.payload as Record<string, unknown>,
          context: isObject(envelope.context) ? envelope.context : null,
        },
      });
    }
  }

  return {
    status: 200,
    body: buildAck(eventId, duplicate),
    duplicate,
  };
}
