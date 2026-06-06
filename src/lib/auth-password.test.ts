import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordHash, verifyPassword } from "./auth-password";

describe("auth-password", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("ExamplePassword1!");
    expect(isPasswordHash(hash)).toBe(true);
    expect(verifyPassword("ExamplePassword1!", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("still verifies legacy plaintext for compatibility", () => {
    expect(verifyPassword("legacy-pass", "legacy-pass")).toBe(true);
    expect(verifyPassword("wrong", "legacy-pass")).toBe(false);
  });
});
