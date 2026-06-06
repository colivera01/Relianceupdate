// src/app/api/device/pairing/request/route.ts

import { prisma } from "@/server/db";

import { getVendorIdFromRequest } from "@/lib/auth";
import { createDevicePairingInviteToken } from "@/lib/device-pairing-link";
import { sendDevicePairingInvite } from "@/lib/notifications/send-device-pairing-invite";
import { readNotificationEnv } from "@/lib/env/notification-config";

import { NextResponse } from "next/server";

import crypto from "crypto";

function generateSixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function isLocalOnlyBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.trim().toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

function normalizeBaseUrlOverride(raw: unknown): string | null {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) {
      return null;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}



export async function POST(req: Request) {
  try {
    console.log("[pairing/request] Starting request...");
    const vendorId = await getVendorIdFromRequest(req);
    console.log("[pairing/request] Vendor ID:", vendorId);

    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const inviteEmail = String(body?.inviteEmail || "").trim() || null;
    const invitePhone = String(body?.invitePhone || "").trim() || null;
    const baseUrlOverride = normalizeBaseUrlOverride(body?.baseUrlOverride);

    if (body?.baseUrlOverride && !baseUrlOverride) {
      return NextResponse.json({ error: "baseUrlOverride must be a valid http or https URL" }, { status: 400 });
    }

    let code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    console.log("[pairing/request] Generated code:", code);

    // Regenerate if collision occurs.
    // (Unique index on code protects final insert anyway.)
    for (let i = 0; i < 3; i += 1) {
      const existing = await (prisma as any).devicePairingCode.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) break;
      code = generateSixDigitCode();
    }

    // Try to create the pairing code
    // Using 'as any' to bypass TypeScript if Prisma client hasn't been regenerated
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        businessName: true,
        name: true,
      },
    });

    await (prisma as any).devicePairingCode.create({
      data: {
        vendorId,
        code,
        expiresAt,
      },
    });

    console.log("[pairing/request] Successfully created pairing code");
    const env = readNotificationEnv();
    const origin = new URL(req.url).origin;
    const baseUrl =
      process.env.NODE_ENV !== "production" && baseUrlOverride
        ? baseUrlOverride
        : env.appBaseUrl || origin;
    const inviteToken = createDevicePairingInviteToken({
      code,
      vendorId: String(vendorId),
      vendorName: vendor?.businessName || vendor?.name || "Reliance vendor",
      expiresAt,
    });
    const pairingUrl = `${baseUrl}/device/pair?invite=${encodeURIComponent(inviteToken)}`;
    const linkAccessMode = isLocalOnlyBaseUrl(baseUrl) ? "local_only" : "public";

    const inviteDelivery =
      inviteEmail || invitePhone
        ? await sendDevicePairingInvite({
            vendorName: vendor?.businessName || vendor?.name || "Reliance vendor",
            inviteeEmail: inviteEmail,
            inviteePhone: invitePhone,
            pairingUrl,
            pairingCode: code,
            expiresAtIso: expiresAt.toISOString(),
            linkAccessMode,
          })
        : undefined;

    return NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString(),
      pairingUrl,
      inviteToken,
      linkAccessMode,
      inviteDelivery,
    });
  } catch (error: any) {
    console.error("[pairing/request] Error:", error);
    console.error("[pairing/request] Error name:", error?.name);
    console.error("[pairing/request] Error message:", error?.message);
    if (error?.stack) {
      console.error("[pairing/request] Error stack:", error.stack);
    }
    return NextResponse.json(
      { 
        error: "Failed to create pairing code",
        details: error?.message || String(error),
        code: error?.code,
        meta: error?.meta
      },
      { status: 500 }
    );
  }
}


