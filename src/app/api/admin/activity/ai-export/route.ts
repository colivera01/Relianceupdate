import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import {
  buildAiActivityReport,
  normalizeAiActivityFeatureFilter,
  serializeAiRecentRunsCsv,
} from "@/lib/ai/reporting";
import { isTransientDbConnectivityError } from "@/lib/transient-db-errors";

function parseRecentRunLimit(value: string | null): number {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(Math.max(parsed, 1), 500);
}

function parseFormat(value: string | null): "json" | "csv" {
  return String(value || "").trim().toLowerCase() === "csv" ? "csv" : "json";
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const featureFilter = normalizeAiActivityFeatureFilter(
      searchParams.get("aiFeature")
    );
    const format = parseFormat(searchParams.get("format"));
    const recentRunLimit = parseRecentRunLimit(searchParams.get("limit"));
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [responseLogs, feedbackLogs, errorLogs] = await Promise.all([
      (prisma as any).adminAuditLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          entityType: "ai_run",
          actionType: "ai_response",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          actionType: true,
          entityId: true,
          actorUserId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      (prisma as any).adminAuditLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          entityType: "ai_run",
          actionType: "ai_feedback",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          actionType: true,
          entityId: true,
          actorUserId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      (prisma as any).adminAuditLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          entityType: "ai_run",
          actionType: "ai_error",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          actionType: true,
          entityId: true,
          actorUserId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    const report = buildAiActivityReport({
      responseLogs,
      feedbackLogs,
      errorLogs,
      recentRunLimit,
      featureFilter,
    });

    if (format === "csv") {
      const csv = serializeAiRecentRunsCsv(report.recentRuns);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"reliance-ai-runs-${featureFilter}.csv\"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      success: true,
      appliedFilter: {
        aiFeature: featureFilter,
        limit: recentRunLimit,
      },
      report,
    });
  } catch (error) {
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: "DB_UNAVAILABLE",
          message: "AI activity export is temporarily unavailable.",
          retryable: true,
        },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to export AI activity";
    const normalizedMessage = message.toLowerCase();
    const status = normalizedMessage.includes("unauthorized")
      ? 401
      : normalizedMessage.includes("forbidden")
        ? 403
        : 500;
    console.error("[admin/activity/ai-export] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status }
    );
  }
}
