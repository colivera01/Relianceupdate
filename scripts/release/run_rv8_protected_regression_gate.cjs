const { spawnSync } = require("node:child_process");
const path = require("node:path");

const protectedTests = [
  "src/app/api/bookings/booking-crud.integration.test.ts",
  "src/lib/customer-service-records-server.test.ts",
  "src/lib/customer-service-record-presentation.test.ts",
  "src/lib/customer-load-contract.test.ts",
  "src/app/api/reviews/reviews-me.integration.test.ts",
  "src/app/api/users/favorites/favorites-routes.integration.test.ts",
  "src/lib/customer-support-contract.test.ts",
  "src/lib/customer-service-video-playback.test.ts",
  "src/app/api/reviews/create/route.test.ts",
  "src/app/api/employee/jobs/employee-job-lifecycle.integration.test.ts",
  "src/lib/job-assignment.test.ts",
  "src/lib/consent/canonical-recording-gate.test.ts",
  "src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.integration.test.ts",
  "src/lib/service-video-admin-audit.test.ts",
  "src/lib/service-video-admin-audit-notifications.test.ts",
  "src/app/api/admin/stats/route.test.ts",
  "src/lib/admin-auth.test.ts",
  "src/lib/auth-next.test.ts",
  "src/lib/vendor-access-recovery.test.ts",
  "src/lib/admin-media-moderation-queue.test.ts",
  "src/app/api/admin/media/admin-media-moderation.integration.test.ts",
  "src/lib/private-proof-access-audit.test.ts",
  "src/lib/service-video-package-visibility.test.ts",
  "src/lib/service-video-publication.test.ts",
  "src/app/api/reports/content/content-report.integration.test.ts",
  "src/lib/prisma-artifact.test.ts",
  "src/lib/vendor-job-card-state.test.ts",
  "src/app/api/vendors/[vendorId]/dashboard/dashboard.integration.test.ts",
  "src/lib/vendor-manager-notifications.test.ts",
  "src/lib/vendor-notification-navigation.test.ts",
  "src/app/api/vendors/[vendorId]/notifications/notifications.integration.test.ts",
];

const vitestEntrypoint = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitestEntrypoint, "run", ...protectedTests], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error("RV-8 PROTECTED REGRESSION GATE: NO-GO", result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error("RV-8 PROTECTED REGRESSION GATE: NO-GO");
  process.exit(result.status || 1);
}

console.log("RV-8 PROTECTED REGRESSION GATE: PASS");
