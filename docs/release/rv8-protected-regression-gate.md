# RV-8 protected regression gate

Run `npm run test:rv8:protected` before building or deploying an RV-8 release candidate.
Any failure is a deployment no-go until the failure is understood and corrected.

The gate covers the customer booking and Private Proof path, review creation, employee recording,
Vendor Manager submission, Reliance Audit, package visibility and publication, reporting, release
artifact integrity, terminal Vendor card state, and per-manager Audit notifications.

After deployment, the controlled read-only smoke must also verify authenticated customer, employee,
Vendor Manager, and Admin boundaries; exact Admin package deep links; the canonical pending count;
manager-only unread notifications; Private Proof playback; Public visibility isolation; reporting;
and the mounted Prisma artifact contract. Smoke validation must not PASS or REJECT a protected record,
create proof or Public evidence, resend a notification, or otherwise mutate protected acceptance data.
