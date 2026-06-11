import { NextRequest, NextResponse } from "next/server";
import {
  betaNoIndexHeaders,
  createBetaGateToken,
  getBetaGateConfig,
  getBetaGateCookieMaxAgeSeconds,
  sanitizeBetaReturnTo,
} from "@/lib/beta-gate";

function wantsJson(request: NextRequest): boolean {
  return String(request.headers.get("accept") || "").includes("application/json");
}

async function readPasswordAndReturnTo(request: NextRequest): Promise<{
  password: string;
  returnTo: string;
}> {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return {
      password: String(body?.password || ""),
      returnTo: sanitizeBetaReturnTo(body?.returnTo),
    };
  }

  const formData = await request.formData();
  return {
    password: String(formData.get("password") || ""),
    returnTo: sanitizeBetaReturnTo(String(formData.get("returnTo") || "")),
  };
}

function jsonResponse(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  betaNoIndexHeaders(response.headers);
  return response;
}

export async function POST(request: NextRequest) {
  const betaGate = getBetaGateConfig();
  const { password, returnTo } = await readPasswordAndReturnTo(request);

  if (!betaGate.enabled) {
    return jsonResponse({ ok: true, gateEnabled: false }, 200);
  }

  if (!betaGate.password) {
    return jsonResponse(
      { ok: false, error: "Beta access is not configured.", code: "BETA_GATE_MISCONFIGURED" },
      503
    );
  }

  if (password !== betaGate.password) {
    if (wantsJson(request)) {
      return jsonResponse(
        { ok: false, error: "Incorrect beta access password.", code: "BETA_GATE_DENIED" },
        401
      );
    }

    const deniedUrl = new URL("/beta-access", request.url);
    deniedUrl.searchParams.set("error", "1");
    deniedUrl.searchParams.set("returnTo", returnTo);
    const response = NextResponse.redirect(deniedUrl, 303);
    betaNoIndexHeaders(response.headers);
    return response;
  }

  const token = await createBetaGateToken(betaGate);
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(betaGate.cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: getBetaGateCookieMaxAgeSeconds(betaGate),
  });
  betaNoIndexHeaders(response.headers);
  return response;
}
