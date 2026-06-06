import { NextRequest, NextResponse } from "next/server";
import {
  enforceDevRouteAccess,
  getDevRouteSecretHeaderName,
} from "@/lib/dev-route-access";

export async function GET(request: NextRequest) {
  const denied = enforceDevRouteAccess(request);
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    message: "Development test route is working",
    requiredHeader: getDevRouteSecretHeaderName(),
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const denied = enforceDevRouteAccess(request);
  if (denied) return denied;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  return NextResponse.json({
    success: true,
    message: "Development test POST route is working",
    requiredHeader: getDevRouteSecretHeaderName(),
    receivedData: body,
    timestamp: new Date().toISOString(),
  });
}
