import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { POST } from "@/app/api/beta-gate/route";
import {
  createBetaGateToken,
  getBetaGateConfig,
  sanitizeBetaReturnTo,
} from "@/lib/beta-gate";

const ORIGINAL_ENV = { ...process.env };
const BETA_ENV_KEYS = [
  "BETA_GATE_ENABLED",
  "BETA_GATE_PASSWORD",
  "BETA_GATE_COOKIE_NAME",
  "BETA_GATE_COOKIE_MAX_AGE_DAYS",
] as const;

function resetBetaEnv() {
  for (const key of BETA_ENV_KEYS) {
    delete process.env[key];
  }
}

function setEnabledBetaGate() {
  process.env.BETA_GATE_ENABLED = "true";
  process.env.BETA_GATE_PASSWORD = "Reliance2026";
  process.env.BETA_GATE_COOKIE_NAME = "reliance_beta_access";
  process.env.BETA_GATE_COOKIE_MAX_AGE_DAYS = "14";
}

function betaRequest(path: string, cookie?: string, extraHeaders: Record<string, string> = {}): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new NextRequest(`https://beta.relianceonline.org${path}`, { headers });
}

describe("private beta gate", () => {
  beforeEach(() => {
    resetBetaEnv();
    setEnabledBetaGate();
  });

  afterEach(() => {
    resetBetaEnv();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("blocks a public page and redirects to beta access", async () => {
    const response = await middleware(betaRequest("/browse?sortBy=distance"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://beta.relianceonline.org/beta-access?returnTo=%2Fbrowse%3FsortBy%3Ddistance"
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("defaults to private beta protection with the shared Reliance password", () => {
    resetBetaEnv();
    const config = getBetaGateConfig();

    expect(config.enabled).toBe(true);
    expect(config.password).toBe("Reliance2026");
    expect(config.cookieName).toBe("reliance_beta_access");
    expect(config.cookieMaxAgeDays).toBe(14);
  });

  it("allows access when the signed beta cookie is valid", async () => {
    const config = getBetaGateConfig();
    const token = await createBetaGateToken(config);
    const response = await middleware(betaRequest("/vendor/dashboard", `${config.cookieName}=${token}`));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("sets a secure httpOnly cookie when the beta password is correct", async () => {
    const request = new NextRequest("https://beta.relianceonline.org/api/beta-gate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        password: "Reliance2026",
        returnTo: "/vendor/dashboard",
      }),
    });

    const response = await POST(request);
    const setCookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://beta.relianceonline.org/vendor/dashboard");
    expect(setCookie).toContain("reliance_beta_access=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("denies the wrong beta password", async () => {
    const request = new NextRequest("https://beta.relianceonline.org/api/beta-gate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        password: "wrong-password",
        returnTo: "/browse",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("BETA_GATE_DENIED");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not block static assets", async () => {
    const response = await middleware(betaRequest("/homepage/stage-one.mp4"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not block health checks", async () => {
    const response = await middleware(betaRequest("/api/health/schema"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not block public compliance and SMS consent pages", async () => {
    for (const path of ["/privacy", "/terms", "/sms-policy", "/auth/register?type=user", "/help"]) {
      const response = await middleware(betaRequest(path));

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });

  it("does not block secure employee service-order links with capture tokens", async () => {
    const pageResponse = await middleware(betaRequest("/employee/jobs?jobId=job-1&ct=capture-token-1"));

    expect(pageResponse.headers.get("location")).toBeNull();
    expect(pageResponse.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const apiResponse = await middleware(
      betaRequest("/api/employee/jobs/job-1/stage", undefined, {
        "x-employee-capture-token": "capture-token-1",
      })
    );

    expect(apiResponse.headers.get("location")).toBeNull();
    expect(apiResponse.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not block employee capture media upload calls with capture token headers", async () => {
    for (const path of [
      "/api/vendors/vendor-1/media/sessions",
      "/api/vendors/vendor-1/media/sessions/session-1",
      "/api/vendors/vendor-1/media/upload/init",
      "/api/vendors/vendor-1/media/upload/complete",
      "/api/vendors/vendor-1/media/upload/proxy",
    ]) {
      const response = await middleware(
        betaRequest(path, undefined, {
          "x-employee-capture-token": "capture-token-1",
        })
      );

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });

  it("keeps vendor media upload calls gated when no capture token is present", async () => {
    const response = await middleware(betaRequest("/api/vendors/vendor-1/media/sessions"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://beta.relianceonline.org/beta-access?returnTo=%2Fapi%2Fvendors%2Fvendor-1%2Fmedia%2Fsessions"
    );
  });

  it("keeps employee job pages gated when no capture token is present", async () => {
    const response = await middleware(betaRequest("/employee/jobs?jobId=job-1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://beta.relianceonline.org/beta-access?returnTo=%2Femployee%2Fjobs%3FjobId%3Djob-1"
    );
  });

  it("allows normal behavior when the beta gate is disabled", async () => {
    process.env.BETA_GATE_ENABLED = "false";

    const response = await middleware(betaRequest("/browse"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("sanitizes unsafe return paths", () => {
    expect(sanitizeBetaReturnTo("https://evil.example")).toBe("/");
    expect(sanitizeBetaReturnTo("//evil.example")).toBe("/");
    expect(sanitizeBetaReturnTo("/api/beta-gate")).toBe("/");
    expect(sanitizeBetaReturnTo("/browse?sortBy=distance")).toBe("/browse?sortBy=distance");
  });
});
