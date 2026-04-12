import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; sessionId: string }>;
}

const ALLOWED_PATCH_FIELDS = new Set(["status", "endedAt", "title", "description"]);
const ALLOWED_STATUSES = new Set([
  "CREATED",
  "RECORDING",
  "UPLOADING",
  "COMPLETED",
  "APPROVED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
]);

function serializeSession(session: any) {
  if (!session) return session;
  return {
    ...session,
    mediaAssets: Array.isArray(session.mediaAssets)
      ? session.mediaAssets.map((asset: any) => ({
          ...asset,
          bytes:
            typeof asset?.bytes === "bigint"
              ? asset.bytes.toString()
              : asset?.bytes,
        }))
      : session.mediaAssets,
  };
}

/**
 * GET /api/vendors/[vendorId]/media/sessions/[sessionId]
 * Return session details including linked media assets.
 */
export async function GET(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, sessionId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const session = await (prisma as any).mediaSession.findFirst({
      where: { id: sessionId, vendorId },
      include: {
        mediaAssets: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Media session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: serializeSession(session) });
  } catch (error: any) {
    console.error("[media/sessions/:id] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch media session", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/[vendorId]/media/sessions/[sessionId]
 * Allow safe updates only (status, endedAt, title, description).
 */
export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, sessionId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const existing = await (prisma as any).mediaSession.findFirst({
      where: { id: sessionId, vendorId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Media session not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const bodyKeys = Object.keys(body);
    const invalidKeys = bodyKeys.filter((k) => !ALLOWED_PATCH_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Unsupported fields in patch: ${invalidKeys.join(", ")}` },
        { status: 422 }
      );
    }

    if (body.status && !ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 422 });
    }

    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.title !== undefined) data.title = body.title || null;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.endedAt !== undefined) {
      data.endedAt = body.endedAt ? new Date(body.endedAt) : null;
    }

    const session = await (prisma as any).mediaSession.update({
      where: { id: sessionId },
      data,
      include: {
        mediaAssets: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ session: serializeSession(session) });
  } catch (error: any) {
    console.error("[media/sessions/:id] PATCH error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update media session", details: error.message },
      { status: 500 }
    );
  }
}

