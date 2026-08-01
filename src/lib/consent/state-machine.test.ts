import { describe, expect, it } from "vitest";

import {
  canMakePermissionDecision,
  derivePermissionState,
  transitionPermissionState,
} from "./state-machine";

describe("verified permission state machine", () => {
  it("keeps an undecided request pending until its action link expires", () => {
    expect(
      derivePermissionState({
        status: "requested",
        expiresAt: new Date("2026-08-02T12:00:00.000Z"),
        now: new Date("2026-08-01T12:00:00.000Z"),
      })
    ).toBe("pending");
  });

  it("expires an undecided action link after 48 hours", () => {
    expect(
      derivePermissionState({
        status: "requested",
        expiresAt: new Date("2026-08-01T12:00:00.000Z"),
        now: new Date("2026-08-01T12:00:00.001Z"),
      })
    ).toBe("expired");
  });

  it("does not expire an accepted permission decision", () => {
    expect(
      derivePermissionState({
        status: "accepted",
        expiresAt: new Date("2026-08-01T12:00:00.000Z"),
        now: new Date("2026-08-10T12:00:00.000Z"),
        verifiedDecision: true,
      })
    ).toBe("allowed");
  });

  it("requires a verified decision session before allow or decline", () => {
    expect(canMakePermissionDecision({ linkActive: true, sessionVerified: false })).toBe(false);
    expect(canMakePermissionDecision({ linkActive: false, sessionVerified: true })).toBe(false);
    expect(canMakePermissionDecision({ linkActive: true, sessionVerified: true })).toBe(true);
  });

  it("does not permit terminal decisions to be overwritten", () => {
    expect(() => transitionPermissionState("allowed", "declined")).toThrow(
      "Permission decision is already final"
    );
  });

  it("keeps mismatched recipients blocked until the vendor corrects them", () => {
    expect(derivePermissionState({ status: "RECIPIENT_MISMATCH" })).toBe("recipient_mismatch");
    expect(() => transitionPermissionState("recipient_mismatch", "allowed")).toThrow();
    expect(transitionPermissionState("recipient_mismatch", "superseded")).toBe("superseded");
  });
});
