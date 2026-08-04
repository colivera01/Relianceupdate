# Epic 3 Phase A Screenshot Index

**Captured:** 2026-08-02 and 2026-08-04
**Source:** Local Phase A role-isolation suite and controlled live-beta smoke suite
**Data:** Disposable synthetic users, vendor, memberships, and admin grant. No credentials, OTPs, real customer data, or private media.

| File | Role/state | Viewport | Validation |
|---|---|---|---|
| `Desktop/customer-blocked-from-vendor.png` | Customer blocked from vendor | Desktop | Wrong-role direct URL does not render vendor content |
| `After/general-session-cannot-open-admin.png` | General session blocked from admin | Desktop | General customer/vendor session cannot authorize admin |
| `Desktop/manager-vendor-dashboard.png` | Active manager allowed | Desktop | Current exact vendor membership opens vendor dashboard |
| `Desktop/database-granted-admin-dashboard.png` | DB-granted admin allowed | Desktop | Admin-scoped session plus active DB grant opens admin |
| `Mobile/customer-blocked-from-vendor-mobile.png` | Customer blocked from vendor | 390x844 | Blocked state remains readable on mobile |
| `Desktop/live-beta-explore-proof.png` | Public Explore Proof | Desktop | Public proof-first page renders from the deployed package |
| `Desktop/live-beta-customer-dashboard.png` | Customer allowed | Desktop | Customer dashboard opens for the correct signed-in actor |
| `Desktop/live-beta-vendor-dashboard.png` | Vendor manager allowed | Desktop | Vendor dashboard opens for an active current membership |
| `Desktop/live-beta-employee-work-view.png` | Employee allowed | Desktop | Assigned-work view opens without manager authority |
| `Desktop/live-beta-admin-dashboard.png` | Database-granted admin allowed | Desktop | Admin dashboard opens with admin-scoped session and active grant |
| `Desktop/live-beta-permission-page.png` | Customer permission decision | Desktop | Recording purpose, audio-off state, and Private starting audience are visible |
| `Desktop/live-beta-permission-otp-entry.png` | Customer verification | Desktop | OTP entry renders without exposing the generated OTP |
| `Mobile/live-beta-customer-blocked-from-vendor.png` | Customer blocked from vendor | 390x844 | Live wrong-role block is readable and contains no vendor data |

## Visual Review

- No protected vendor/admin data appears in blocked captures.
- No overlap, clipping, or hidden recovery action was observed at the captured sizes.
- The manager screenshot includes synthetic empty/loading dashboard data only.
- The admin screenshot includes synthetic/admin shell data and no credentials.
- Before/after comparison is not claimed because no equivalent controlled pre-Phase-A capture exists.
- Live-beta captures use disposable synthetic `@reliance.test` fixtures that were deleted after the run.
- No screenshot contains a password, OTP, raw permission token, SAS URL, or application secret.
