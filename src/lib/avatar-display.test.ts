import { describe, expect, it } from "vitest";

import {
  initialsFromDisplayName,
  isGeneratedAvatarUrl,
  sanitizeCustomerFacingAvatar,
} from "@/lib/avatar-display";

describe("avatar-display", () => {
  it("treats randomuser portraits as generated placeholders", () => {
    expect(
      isGeneratedAvatarUrl("https://randomuser.me/api/portraits/women/44.jpg")
    ).toBe(true);
    expect(
      sanitizeCustomerFacingAvatar("https://randomuser.me/api/portraits/men/32.jpg")
    ).toBeNull();
  });

  it("keeps real avatar urls", () => {
    expect(sanitizeCustomerFacingAvatar("https://example.com/avatar.png")).toBe(
      "https://example.com/avatar.png"
    );
  });

  it("builds initials from a display name", () => {
    expect(initialsFromDisplayName("Ivan Oliveira")).toBe("IO");
    expect(initialsFromDisplayName("Reliance")).toBe("R");
    expect(initialsFromDisplayName("")).toBe("U");
  });
});
