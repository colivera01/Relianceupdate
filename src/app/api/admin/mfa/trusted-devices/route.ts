import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";

const TRUSTED_DEVICES_DB_UNAVAILABLE_MESSAGE =
  "Trusted MFA devices are temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

function serializeTrustedDevice(row: any) {
  return {
    id: String(row.id),
    userId: String(row.userId),
    email: String(row.credential?.email || row.credential?.user?.email || ""),
    userName: String(row.credential?.user?.name || "").trim() || "User",
    label: row.label || null,
    role: row.vendorRole || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    expiresAt: row.expiresAt?.toISOString?.() || null,
    lastUsedAt: row.lastUsedAt?.toISOString?.() || null,
    revokedAt: row.revokedAt?.toISOString?.() || null,
  };
}

async function getVendorScopedTrustedDevices(vendorId: string) {
  const memberships = await (prisma as any).vendorMembership.findMany({
    where: {
      vendorId,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      role: true,
    },
  });

  const roleByUserId = new Map<string, string>();
  for (const membership of memberships) {
    roleByUserId.set(String(membership.userId), String(membership.role || ""));
  }

  const userIds = Array.from(roleByUserId.keys());
  if (!userIds.length) {
    return [];
  }

  const devices = await (prisma as any).authTrustedDevice.findMany({
    where: {
      userId: { in: userIds },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      label: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      credential: {
        select: {
          email: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return devices.map((device: any) => ({
    ...device,
    vendorRole: roleByUserId.get(String(device.userId)) || null,
  }));
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const targetType = normalizeString(url.searchParams.get("targetType")).toLowerCase();
    const targetId = normalizeString(url.searchParams.get("targetId"));

    if (!targetId || !["user", "vendor"].includes(targetType)) {
      return NextResponse.json(
        { success: false, error: "targetType must be user or vendor and targetId is required" },
        { status: 400 }
      );
    }

    const devices =
      targetType === "user"
        ? await (prisma as any).authTrustedDevice.findMany({
            where: {
              userId: targetId,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              userId: true,
              label: true,
              createdAt: true,
              expiresAt: true,
              lastUsedAt: true,
              revokedAt: true,
              credential: {
                select: {
                  email: true,
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })
        : await getVendorScopedTrustedDevices(targetId);

    return NextResponse.json({
      success: true,
      devices: devices.map(serializeTrustedDevice),
    });
  } catch (error: any) {
    console.error("[admin/mfa/trusted-devices] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: TRUSTED_DEVICES_DB_UNAVAILABLE_MESSAGE,
          message: TRUSTED_DEVICES_DB_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Failed to load trusted devices" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId: actorUserId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const targetType = normalizeString(body?.targetType).toLowerCase();
    const targetId = normalizeString(body?.targetId);
    const deviceId = normalizeString(body?.deviceId);

    if (!deviceId || !targetId || !["user", "vendor"].includes(targetType)) {
      return NextResponse.json(
        { success: false, error: "targetType, targetId, and deviceId are required" },
        { status: 400 }
      );
    }

    const existing = await (prisma as any).authTrustedDevice.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        userId: true,
        label: true,
        expiresAt: true,
        revokedAt: true,
        credential: {
          select: {
            email: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Trusted device not found" }, { status: 404 });
    }

    if (targetType === "user") {
      if (String(existing.userId) !== targetId) {
        return NextResponse.json({ success: false, error: "Trusted device does not belong to that user" }, { status: 422 });
      }
    } else {
      const membership = await (prisma as any).vendorMembership.findFirst({
        where: {
          vendorId: targetId,
          userId: String(existing.userId),
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ success: false, error: "Trusted device does not belong to an active vendor member" }, { status: 422 });
      }
    }

    const revokedAt = new Date();
    await (prisma as any).authTrustedDevice.update({
      where: { id: deviceId },
      data: { revokedAt },
    });

    await createAdminAuditLog({
      actionType: "MFA_TRUSTED_DEVICE_REVOKED",
      entityType: "device",
      entityId: deviceId,
      actorUserId,
      previousValue: {
        userId: String(existing.userId),
        label: existing.label || null,
        email: existing.credential?.email || null,
        revokedAt: existing.revokedAt?.toISOString?.() || null,
      },
      newValue: {
        revokedAt: revokedAt.toISOString(),
      },
      metadata: {
        source: "POST /api/admin/mfa/trusted-devices",
        targetType,
        targetId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Trusted device revoked",
      deviceId,
    });
  } catch (error: any) {
    console.error("[admin/mfa/trusted-devices] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: TRUSTED_DEVICES_DB_UNAVAILABLE_MESSAGE,
          message: TRUSTED_DEVICES_DB_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Failed to revoke trusted device" }, { status: 500 });
  }
}
