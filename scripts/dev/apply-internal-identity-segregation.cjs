/**
 * Marks owner + Sparkle internal/demo rows in live DB without removing access.
 * Safe to rerun (idempotent updates).
 */
const { PrismaClient } = require("@prisma/client");

const OWNER_ADMIN_USER_ID = "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0";
const SPARKLE_CLEAN_VENDOR_ID = "cmipm4d6v0000sosgqvb8tp63";

/** Seeded vendors used for production-like audits (not internal/demo shells). */
const PRODUCTION_LIKE_VENDOR_IDS = [
  "cmnvdegk60000sop8sj18nud2", // Metro Home Care Pros
  "cmpggaky40000soc0il005lwi", // Midtown Home Detailers
  "cmpggam0w0003soc0z4ezfhth", // Brooklyn Home Care Studio
];

const p = new PrismaClient();

async function main() {
  const owner = await p.user.update({
    where: { id: OWNER_ADMIN_USER_ID },
    data: { demo: true },
    select: { id: true, email: true, demo: true },
  });

  const sparkle = await p.vendor.update({
    where: { id: SPARKLE_CLEAN_VENDOR_ID },
    data: {
      demo: true,
      isPubliclyListed: false,
      publiclyListedAt: null,
    },
    select: {
      id: true,
      businessName: true,
      demo: true,
      isPubliclyListed: true,
    },
  });

  const sparkleBookings = await p.booking.updateMany({
    where: { vendorId: SPARKLE_CLEAN_VENDOR_ID },
    data: { demo: true },
  });
  const sparkleReviews = await p.review.updateMany({
    where: { vendorId: SPARKLE_CLEAN_VENDOR_ID },
    data: { demo: true },
  });
  const sparkleServices = await p.service.updateMany({
    where: { vendorId: SPARKLE_CLEAN_VENDOR_ID },
    data: { demo: true },
  });
  const ownerBookings = await p.booking.updateMany({
    where: { userId: OWNER_ADMIN_USER_ID },
    data: { demo: true },
  });
  const ownerReviews = await p.review.updateMany({
    where: { userId: OWNER_ADMIN_USER_ID },
    data: { demo: true },
  });

  const productionVendors = await p.vendor.updateMany({
    where: { id: { in: PRODUCTION_LIKE_VENDOR_IDS } },
    data: { demo: false },
  });
  const productionServices = await p.service.updateMany({
    where: { vendorId: { in: PRODUCTION_LIKE_VENDOR_IDS } },
    data: { demo: false },
  });

  const cancelledPromos = await p.promotionCampaign.updateMany({
    where: {
      vendorId: SPARKLE_CLEAN_VENDOR_ID,
      status: { notIn: ["cancelled", "rejected", "expired"] },
    },
    data: { status: "cancelled" },
  });

  console.log(
    JSON.stringify(
      {
        owner,
        sparkle,
        updated: {
          sparkleBookings: sparkleBookings.count,
          sparkleReviews: sparkleReviews.count,
          sparkleServices: sparkleServices.count,
          ownerBookings: ownerBookings.count,
          ownerReviews: ownerReviews.count,
          sparklePromotionsCancelled: cancelledPromos.count,
          productionVendorsClearedDemo: productionVendors.count,
          productionServicesClearedDemo: productionServices.count,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
