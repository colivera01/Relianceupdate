import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReviewEmailToken, verifyReviewEmailToken } from "./review-email-token";

describe("review email token", () => {
  const previousSecret = process.env.REVIEW_EMAIL_TOKEN_SECRET;

  beforeEach(() => {
    process.env.REVIEW_EMAIL_TOKEN_SECRET = "test-review-email-secret";
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.REVIEW_EMAIL_TOKEN_SECRET;
    } else {
      process.env.REVIEW_EMAIL_TOKEN_SECRET = previousSecret;
    }
  });

  it("round-trips signed review window claims", () => {
    const token = createReviewEmailToken({ reviewWindowId: "review-window-1", ttlSeconds: 120 });

    expect(verifyReviewEmailToken(token)).toEqual(
      expect.objectContaining({
        reviewWindowId: "review-window-1",
        version: 1,
      })
    );
  });

  it("rejects tampered tokens", () => {
    const token = createReviewEmailToken({ reviewWindowId: "review-window-1", ttlSeconds: 120 });
    const tampered = token.endsWith("a") ? `${token.slice(0, -1)}b` : `${token.slice(0, -1)}a`;

    expect(verifyReviewEmailToken(tampered)).toBeNull();
  });
});
