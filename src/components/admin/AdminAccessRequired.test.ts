import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/media-moderation",
  useSearchParams: () => new URLSearchParams("package=package-1"),
}));

describe("Admin access recovery", () => {
  it("preserves the exact package deep link through sign-in", async () => {
    const { AdminAccessRequired } = await import("./AdminAccessRequired");
    const html = renderToStaticMarkup(createElement(AdminAccessRequired));
    expect(html).toContain(
      "/auth/login?next=%2Fadmin%2Fmedia-moderation%3Fpackage%3Dpackage-1",
    );
  });
});
