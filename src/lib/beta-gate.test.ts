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
  process.env.BETA_GATE_PASSWORD = "private-beta-secret";
  process.env.BETA_GATE_COOKIE_NAME = "reliance_beta_access";
  process.env.BETA_GATE_COOKIE_MAX_AGE_DAYS = "14";
}

function betaRequest(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
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
        password: "private-beta-secret",
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
