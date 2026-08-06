import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { processDueRetentionSchedules, processMediaDeletionJobs } from "@/lib/media-lifecycle";

function secretMatches(supplied: string, expected: string): boolean {
  const left = createHash("sha256").update(supplied).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const configuredSecret = String(process.env.INTERNAL_NOTIFICATION_WORKER_SECRET || "").trim();
  if (!configuredSecret) return NextResponse.json({ success: false, error: "Lifecycle worker is not configured" }, { status: 503 });
  const suppliedSecret = String(request.headers.get("x-internal-notification-secret") || "").trim();
  if (!suppliedSecret || !secretMatches(suppliedSecret, configuredSecret)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const retention = await processDueRetentionSchedules(25);
  const deletion = await processMediaDeletionJobs(10);
  return NextResponse.json({ success: true, processed: retention.length + deletion.length, retention, deletion });
}
