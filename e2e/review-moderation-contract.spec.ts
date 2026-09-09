import { expect, test, type Page } from "@playwright/test";

const pendingReview = {
  reviewId: "review-comment",
  vendorId: "vendor-1",
  vendorName: "Electro LLC",
  userId: "customer-1",
  reviewerName: "Customer One",
  reviewerEmail: "customer@example.com",
  clientName: "Customer One",
  jobType: "Breaker Replacement",
  rating: 5,
  comment: "It was great",
  createdAt: "2026-09-08T12:00:00.000Z",
  moderationStatus: "pending_review",
  visibilityStatus: "private",
  moderationReason: null,
  moderatedAt: null,
  contractVersion: 2,
  ratingValidityStatus: "verified",
  ratingInvalidationReason: null,
  countsInCanonicalMetrics: false,
  aiRecommendation: null,
};

const starsOnlyReview = {
  ...pendingReview,
  reviewId: "review-stars-only",
  rating: 4,
  comment: "",
  moderationStatus: "not_applicable",
  countsInCanonicalMetrics: true,
};

async function installReviewQueueApi(page: Page) {
  await page.route("**/api/admin/reviews/moderation-queue**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        reviews: [pendingReview, starsOnlyReview],
        vendors: [{ id: "vendor-1", name: "Electro LLC" }],
        pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
      }),
    });
  });
}

test("Admin review moderation separates written comments from Vendor Rating evidence", async ({ page }) => {
  await installReviewQueueApi(page);
  await page.goto("/test-fixtures/admin-review-moderation");

  await expect(page.getByRole("heading", { name: "Review Moderation" })).toBeVisible();
  await expect(page.getByText("Moderate written comments separately from verified Vendor Rating evidence.")).toBeVisible();

  const writtenCommentCard = page.getByTestId("review-card-review-comment");
  await expect(writtenCommentCard.getByText("Rating evidence: Verified but excluded from canonical metrics")).toBeVisible();
  await expect(writtenCommentCard.getByRole("button", { name: "Publish Written Comment" })).toBeVisible();
  await expect(writtenCommentCard.getByRole("button", { name: "Keep Written Comment Private" })).toBeVisible();
  await expect(writtenCommentCard.getByRole("button", { name: "Invalidate Rating Evidence" })).toBeVisible();

  const starsOnlyCard = page.getByTestId("review-card-review-stars-only");
  await expect(starsOnlyCard.getByText("No written comment needs moderation.")).toBeVisible();
  await expect(starsOnlyCard.getByRole("button", { name: "Publish Written Comment" })).toHaveCount(0);
  await expect(starsOnlyCard.getByRole("button", { name: "Run AI Review" })).toHaveCount(0);

  await writtenCommentCard.getByRole("button", { name: "Invalidate Rating Evidence" }).click();
  const dialog = page.getByRole("dialog", { name: "Invalidate Rating Evidence" });
  await expect(dialog).toContainText("excludes its stars from canonical metrics and keeps its written comment Private");
});

test("Admin review moderation remains readable without horizontal overflow", async ({ page }) => {
  await installReviewQueueApi(page);
  await page.goto("/test-fixtures/admin-review-moderation");
  await expect(page.getByRole("heading", { name: "Review Moderation" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
