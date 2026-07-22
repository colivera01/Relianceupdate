import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("clears only scoped admin cookies for an admin tab", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "admin" }),
      })
    );
    const cookies = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(cookies).toContain("reliance_admin_session=");
    expect(cookies).toContain("Path=/admin");
    expect(cookies).toContain("reliance_admin_api_session=");
    expect(cookies).toContain("Path=/api/admin");
    expect(cookies).not.toMatch(/(?:^|, )reliance_session=/);
  });

  it("clears only the general session for a vendor or customer tab", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "general" }),
      })
    );
    const cookies = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(cookies).toContain("reliance_session=");
    expect(cookies).toContain("Path=/");
    expect(cookies).not.toContain("reliance_admin_session=");
    expect(cookies).not.toContain("reliance_admin_api_session=");
  });
});
