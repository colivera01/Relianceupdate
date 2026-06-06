import { NextRequest, NextResponse } from "next/server";
import { registeredUsers } from "@/lib/dev-registered-users";
import {
  enforceDevRouteAccess,
  getDevRouteSecretHeaderName,
} from "@/lib/dev-route-access";

export async function GET(request: NextRequest) {
  const denied = enforceDevRouteAccess(request);
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    message: "Development auth debug summary",
    requiredHeader: getDevRouteSecretHeaderName(),
    userCount: registeredUsers.length,
  });
}
