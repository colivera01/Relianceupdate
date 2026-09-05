import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("completed customer Service Record contract", () => {
  const detailPage = source("src/app/(user)/my-bookings/[bookingId]/page.tsx");
  const recordsPage = source("src/app/(user)/my-bookings/page.tsx");
  const reviewWindowRoute = source("src/app/api/reviews/window/start/route.ts");
  const reviewCreateRoute = source("src/app/api/reviews/create/route.ts");

  it("removes legacy playback consent and client-only authorization", () => {
    expect(detailPage).not.toContain("/api/consent/request");
    expect(detailPage).not.toContain("Request video access");
    expect(detailPage).not.toContain("Approve video access first");
    expect(detailPage).not.toContain("sessionStorage");
    expect(reviewWindowRoute).not.toContain("consentRecord");
    expect(reviewWindowRoute).toContain("loadCustomerReviewEligibility");
  });

  it("presents the approved three-stage Service Video before secondary details", () => {
    expect(detailPage).toContain("Your Service Video");
    expect(detailPage).toContain("Play complete Service Video");
    expect(detailPage).toContain("Starting Condition");
    expect(detailPage).toContain("Work in Progress");
    expect(detailPage).toContain("Final Result");
    expect(detailPage.indexOf("Your Service Video")).toBeLessThan(detailPage.indexOf("View service details"));
    expect(detailPage).not.toContain("Current service-record state");
    expect(detailPage).not.toContain("Current stage:");
  });

  it("starts the canonical review window only from an intentional customer action", () => {
    expect(detailPage).toContain("const beginReview = useCallback(async");
    expect(detailPage).toContain("onClick={() => void beginReview()}");
    expect(detailPage).toContain("searchParams?.get('action') === 'review'");
    expect(detailPage).toContain("reviewIntentHandled.current = true");
    const reviewStartCall = detailPage.indexOf("fetch('/api/reviews/window/start'");
    expect(detailPage.slice(Math.max(0, reviewStartCall - 500), reviewStartCall)).toContain(
      "const beginReview = useCallback(async"
    );
    expect(reviewWindowRoute).not.toContain("sendReviewInvitation");
  });

  it("keeps vendor and employee ratings separate from Trust Score", () => {
    expect(reviewCreateRoute).toContain("employeeCustomerRatingEvidence.create");
    expect(reviewCreateRoute).toContain("employeeRating");
    expect(reviewCreateRoute).not.toMatch(/trustScore|trust_score|recalculateTrust/i);
  });

  it("uses a concise completed-record card with one review pathway", () => {
    expect(recordsPage).toContain("View Service Record");
    expect(recordsPage).toContain("Leave a review");
    expect(recordsPage).toContain("Service Video:");
  });
});
