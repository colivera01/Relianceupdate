import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getUserIdFromRequest, getVendorIdFromRequest } from "@/lib/auth";
import {
  ingestDeviceEvent,
  normalizeText,
  SUPPORTED_DEVICE_EVENT_TYPES,
  type DeviceEventEnvelope,
} from "@/lib/device-events";

function parseLimit(value: string | null): number {
  const raw = String(value || "").trim();
  const parsed = raw ? Number(raw) : NaN;
  const limit = Number.isFinite(parsed) ? Math.floor(parsed) : 50;
  if (limit <= 0) return 50;
  return Math.min(200, limit);
}

function parseSince(value: string | null): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as DeviceEventEnvelope;

    const vendorId = normalizeText(body?.vendorId);
    if (!vendorId) {
      return NextResponse.json({ error: "vendorId is required" }, { status: 422 });
    }

    let membership;
    try {
      membership = await requireVendorMembership(request, vendorId);
    } catch (error: any) {
      if (error?.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (String(error?.message || "").includes("Forbidden")) {
        return NextResponse.json(
          { error: "Forbidden: Active membership required for supplied vendorId" },
          { status: 403 }
        );
      }
      throw error;
    }

    const outcome = await ingestDeviceEvent(body, {
      vendorId,
      membershipId: membership.membershipId,
      userId: membership.userId,
    });

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to ingest device event",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const deviceUid = normalizeText(url.searchParams.get("deviceUid")) || null;
    const deviceId = normalizeText(url.searchParams.get("deviceId")) || null;
    const vendorIdParam = normalizeText(url.searchParams.get("vendorId")) || null;
    const eventType = normalizeText(url.searchParams.get("eventType")).toLowerCase() || null;
    const bookingId = normalizeText(url.searchParams.get("bookingId")) || null;
    const since = parseSince(url.searchParams.get("since"));
    const limit = parseLimit(url.searchParams.get("limit"));

    if (eventType && !SUPPORTED_DEVICE_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported eventType",
          supportedEventTypes: Array.from(SUPPORTED_DEVICE_EVENT_TYPES),
        },
        { status: 422 }
      );
    }

    // Authorization:
    // - Admin: can query across vendors
    // - Vendor manager: restricted to vendorId (from query or active vendor context)
    // - Employee: restricted to their active EMPLOYEE membership (vendor + membershipId)
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let authScope:
      | { kind: "admin"; vendorId: string | null; membershipId: string | null }
      | { kind: "manager"; vendorId: string; membershipId: string | null }
      | { kind: "employee"; vendorId: string; membershipId: string };

    let isAdmin = false;
    try {
      await requireAdmin(request);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    if (isAdmin) {
      authScope = { kind: "admin", vendorId: vendorIdParam, membershipId: null };
    } else {
      const vendorIdResolved = vendorIdParam || (await getVendorIdFromRequest(request));
      if (vendorIdResolved) {
        // Treat as manager query only if the user is actually a manager.
        await requireVendorManager(request, vendorIdResolved);
        authScope = { kind: "manager", vendorId: vendorIdResolved, membershipId: null };
      } else {
        // Employee fallback: constrain to active EMPLOYEE membership (most restrictive).
        const membership = await prisma.vendorMembership.findFirst({
          where: { userId, status: "ACTIVE", role: "EMPLOYEE" },
          orderBy: { approvedAt: "desc" },
          select: { id: true, vendorId: true },
        });
        if (!membership) {
          return NextResponse.json(
            { success: false, error: "Forbidden: Active vendor membership required" },
            { status: 403 }
          );
        }
        authScope = { kind: "employee", vendorId: membership.vendorId, membershipId: membership.id };
      }
    }

    const where: any = {};

    if (authScope.kind === "admin") {
      if (authScope.vendorId) where.vendorId = authScope.vendorId;
    } else {
      where.vendorId = authScope.vendorId;
      if (authScope.kind === "employee") {
        where.membershipId = authScope.membershipId;
      }
    }

    if (eventType) where.eventType = eventType;
    if (bookingId) where.bookingId = bookingId;
    if (since) {
      where.OR = [{ occurredAt: { gte: since } }, { receivedAt: { gte: since } }];
    }

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (deviceUid) {
      // Scope by device relation to avoid trusting a free-form deviceUid string in DeviceEvent.
      where.device = { deviceUid };
    }

    const events = await (prisma as any).deviceEvent.findMany({
      where,
      include: {
        device: {
          select: {
            id: true,
            deviceUid: true,
            deviceType: true,
          },
        },
      },
      orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
      take: limit,
    });

    const mapped = events.map((row: any) => ({
      id: row.id,
      eventId: row.eventId,
      eventType: row.eventType,
      occurredAt: row.occurredAt,
      receivedAt: row.receivedAt,
      deviceId: row.deviceId,
      deviceUid: row.device?.deviceUid || null,
      deviceType: row.device?.deviceType || null,
      vendorId: row.vendorId,
      membershipId: row.membershipId,
      bookingId: row.bookingId,
      mediaSessionId: row.mediaSessionId,
      assetId: row.assetId,
      stage: row.stage,
      firmwareVersion: row.firmwareVersion || null,
      payload: safeParseJson(row.payloadJson) ?? { _raw: row.payloadJson },
      contractVersion: "1",
    }));

    return NextResponse.json({
      success: true,
      events: mapped,
      count: mapped.length,
      filters: {
        deviceUid,
        deviceId,
        vendorId: authScope.kind === "admin" ? vendorIdParam : authScope.vendorId,
        eventType,
        bookingId,
        since: since ? since.toISOString() : null,
        limit,
        scope: authScope.kind,
      },
    });
  } catch (error: any) {
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (String(error?.message || "") === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch device events", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
