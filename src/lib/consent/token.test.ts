import { describe, expect, it } from "vitest";

import { createOpaqueSecret, hashOpaqueSecret, safeSecretEqual } from "./token";

describe("verified permission secrets", () => {
  it("creates a 256-bit URL-safe secret and stores only its hash", () => {
    const secret = createOpaqueSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashOpaqueSecret(secret)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOpaqueSecret(secret)).not.toContain(secret);
  });

  it("uses constant-time equality semantics for hashed values", () => {
    const hash = hashOpaqueSecret("permission-secret");
    expect(safeSecretEqual(hash, hashOpaqueSecret("permission-secret"))).toBe(true);
    expect(safeSecretEqual(hash, hashOpaqueSecret("different-secret"))).toBe(false);
  });
});
