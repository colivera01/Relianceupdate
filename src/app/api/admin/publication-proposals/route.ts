import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminPublicationQueue } from "@/lib/service-video-publication";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ success: true, proposals: await listAdminPublicationQueue() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load publication proposals";
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500 });
  }
}
