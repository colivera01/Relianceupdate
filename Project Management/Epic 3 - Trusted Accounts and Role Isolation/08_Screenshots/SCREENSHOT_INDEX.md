# Epic 3 Phase A Screenshot Index

**Captured:** 2026-08-02
**Source:** `e2e/epic3-phase-a-role-isolation.spec.ts`
**Data:** Disposable synthetic users, vendor, memberships, and admin grant. No credentials, OTPs, real customer data, or private media.

| File | Role/state | Viewport | Validation |
|---|---|---|---|
| `Desktop/customer-blocked-from-vendor.png` | Customer blocked from vendor | Desktop | Wrong-role direct URL does not render vendor content |
| `After/general-session-cannot-open-admin.png` | General session blocked from admin | Desktop | General customer/vendor session cannot authorize admin |
| `Desktop/manager-vendor-dashboard.png` | Active manager allowed | Desktop | Current exact vendor membership opens vendor dashboard |
| `Desktop/database-granted-admin-dashboard.png` | DB-granted admin allowed | Desktop | Admin-scoped session plus active DB grant opens admin |
| `Mobile/customer-blocked-from-vendor-mobile.png` | Customer blocked from vendor | 390x844 | Blocked state remains readable on mobile |

## Visual Review

- No protected vendor/admin data appears in blocked captures.
- No overlap, clipping, or hidden recovery action was observed at the captured sizes.
- The manager screenshot includes synthetic empty/loading dashboard data only.
- The admin screenshot includes synthetic/admin shell data and no credentials.
- Before/after comparison is not claimed because no equivalent controlled pre-Phase-A capture exists.
