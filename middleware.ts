import { NextRequest, NextResponse } from "next/server";
import {
  betaNoIndexHeaders,
  getBetaGateConfig,
  isBetaGateBypassRequest,
  sanitizeBetaReturnTo,
  verifyBetaGateToken,
} from "@/lib/beta-gate";

function withBetaNoIndex(response: NextResponse, enabled: boolean): NextResponse {
  if (enabled) {
    betaNoIndexHeaders(response.headers);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const acceptanceReadOnly = process.env["RELIANCE_ACCEPTANCE_READ_ONLY"] === "YES";
  const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  if (acceptanceReadOnly && !safeMethod) {
    const response = NextResponse.json(
      {
        error: "Beta is temporarily read-only during Product Owner acceptance.",
        code: "ACCEPTANCE_READ_ONLY",
      },
      { status: 423 }
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Retry-After", "60");
    return withBetaNoIndex(response, true);
  }

  const betaGate = getBetaGateConfig();

  if (!betaGate.enabled) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  if (isBetaGateBypassRequest(pathname, request.nextUrl.searchParams, request.headers)) {
    return withBetaNoIndex(NextResponse.next(), true);
  }

  const accessCookie = request.cookies.get(betaGate.cookieName)?.value;
  const hasAccess = await verifyBetaGateToken(accessCookie, betaGate);

  if (hasAccess) {
    return withBetaNoIndex(NextResponse.next(), true);
  }

  const accessUrl = request.nextUrl.clone();
  accessUrl.pathname = "/beta-access";
  accessUrl.search = "";
  accessUrl.searchParams.set(
    "returnTo",
    sanitizeBetaReturnTo(`${request.nextUrl.pathname}${request.nextUrl.search}`)
  );

  return withBetaNoIndex(NextResponse.redirect(accessUrl), true);
}

export const config = {
  matcher: ["/:path*"],
};
