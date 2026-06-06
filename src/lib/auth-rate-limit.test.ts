import { describe, expect, it } from "vitest";
import {
  clearFailedLoginAttempts,
  getLoginThrottleState,
  recordFailedLoginAttempt,
} from "./auth-rate-limit";

describe("auth-rate-limit", () => {
  const key = "rate-limit-test@example.net|127.0.0.1";

  it("locks after repeated failures and clears on reset", () => {
    clearFailedLoginAttempts(key);

    for (let i = 0; i < 5; i += 1) {
      recordFailedLoginAttempt(key);
    }

    const blocked = getLoginThrottleState(key);
    expect(blocked.blocked).toBe(true);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    clearFailedLoginAttempts(key);

    const cleared = getLoginThrottleState(key);
    expect(cleared.blocked).toBe(false);
  });
});
