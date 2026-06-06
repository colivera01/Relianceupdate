import { describe, expect, it } from "vitest";
import {
  createAuthBearerToken,
  createAuthSessionCookie,
  verifyAuthBearerToken,
  verifyAuthSessionCookie,
} from "./auth-session";

describe("auth-session", () => {
  it("creates and verifies a signed session cookie", () => {
    const token = createAuthSessionCookie({
      userId: "user-1",
      email: "user@example.com",
      userType: "vendor",
      availableProfiles: ["vendor"],
    });

    const claims = verifyAuthSessionCookie(token);
    expect(claims).toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      userType: "vendor",
      availableProfiles: ["vendor"],
      version: 1,
    });
  });

  it("rejects tampered session cookies", () => {
    const token = createAuthSessionCookie({
      userId: "user-1",
      email: "user@example.com",
      userType: "customer",
      availableProfiles: ["customer"],
    });

    const tampered = `${token.slice(0, -1)}x`;
    expect(verifyAuthSessionCookie(tampered)).toBeNull();
  });

  it("creates and verifies a signed bearer token", () => {
    const token = createAuthBearerToken({
      userId: "user-2",
      email: "bearer@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });

    const claims = verifyAuthBearerToken(token);
    expect(claims).toMatchObject({
      userId: "user-2",
      email: "bearer@example.com",
      userType: "admin",
      availableProfiles: ["admin"],
    });
  });
});
