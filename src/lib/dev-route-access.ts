import { NextRequest, NextResponse } from "next/server";

const DEV_ROUTE_SECRET_HEADER = "x-dev-route-secret";

export function getDevRouteSecretHeaderName() {
  return DEV_ROUTE_SECRET_HEADER;
}

export function enforceDevRouteAccess(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Not available in production" },
      { status: 404 }
    );
  }

  const expected = String(process.env.DEV_ROUTE_SECRET || "").trim();
  if (!expected) {
    return NextResponse.json(
      {
        success: false,
        error: "Set DEV_ROUTE_SECRET in .env.local to enable this development-only route.",
      },
      { status: 503 }
    );
  }

  const provided = String(request.headers.get(DEV_ROUTE_SECRET_HEADER) || "").trim();
  if (provided !== expected) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid or missing ${DEV_ROUTE_SECRET_HEADER}`,
      },
      { status: 401 }
    );
  }

  return null;
}
