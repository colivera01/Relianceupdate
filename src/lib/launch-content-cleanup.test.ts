import { describe, expect, it } from "vitest";
import { cleanPublicMediaTitle } from "@/lib/launch-content-cleanup";

describe("cleanPublicMediaTitle", () => {
  it("removes internal e2e proof wording from completed media titles", () => {
    expect(cleanPublicMediaTitle("E2E COMPLETED proof 1780688505819")).toBe(
      "Completed service walkthrough"
    );
  });

  it("maps before and during proof titles to service-video wording", () => {
    expect(cleanPublicMediaTitle("Intro proof")).toBe("Before-service walkthrough");
    expect(cleanPublicMediaTitle("IN_PROGRESS proof")).toBe("During-service walkthrough");
  });

  it("replaces generic proof wording with service-video wording for public labels", () => {
    expect(cleanPublicMediaTitle("Customer proof video")).toBe("Customer service video");
  });
});
