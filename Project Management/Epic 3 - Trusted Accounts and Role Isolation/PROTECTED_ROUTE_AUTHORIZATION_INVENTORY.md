# Epic 3 Phase A Protected Route Authorization Inventory

## Baseline

- Repository: `C:\Users\Cesar Olivera\Project Reliance`
- Branch: `cursor-latest-build`
- Starting commit: `43c18f9282d14567ce4c40b1fab32bfb97126817`
- Inventory date: 2026-08-02
- Active Next.js API route files reviewed: 179 under `src/app/api`, plus `src/app/admin/session/route.ts` and `src/app/reviews/quick/route.ts`

This inventory is the pre-change Phase A baseline. A signed session identifies only a candidate user. Current database state must determine account status, platform grants, vendor membership, manager authority, employee assignment, and resource ownership on every protected request.

## Classification Key

| Classification | Required authority |
| --- | --- |
| Public | No account session. Returned data must be intentionally public and minimized. |
| Authenticated | Active database `User` matching a valid signed identity. |
| Customer-owned | Authenticated active user who owns the customer resource or work record. |
| Vendor member | Active user plus exact active `VendorMembership` for the route vendor. |
| Vendor manager | Vendor member whose current membership role is `MANAGER`. |
| Assigned employee | Active employee membership for the exact vendor plus current assignment to the work record. |
| Admin | Admin-scoped signed identity plus active user plus active database `ADMIN` grant. |
| Internal job | Valid configured internal-job secret and a route limited to operational processing. |
| Retired/non-production | Unavailable in production; development access must be explicitly gated. |

## Exhaustive Route Matrix

The patterns below cover every active route file found during inventory. A row with mixed methods states the requirement for each method.

| Route or exhaustive pattern | Methods | Target classification | Pre-change enforcement and Phase A disposition |
| --- | --- | --- | --- |
| `/api/address/autocomplete` | GET | Public | Public address lookup; retain public with bounded input/output. |
| `/api/admin/**` except exceptions below | GET/POST/PATCH | Admin | Most call `requireAdmin`; replace cached-role/owner-list authorization with DB grant. |
| `/api/admin/db-status` | GET | Admin | **Gap:** public database metadata/counts; add admin guard and minimize errors. |
| `/api/admin/reset`, `/api/admin/seed`, `/api/admin/seed-from-mock` | POST | Retired/non-production | Environment/secret gated; make unavailable in production and preserve explicit dev gate. |
| `/api/auth/debug`, `/api/test`, `/api/test-db`, `/api/dev/**` | GET/POST | Retired/non-production | Existing dev gate varies; standardize fail-closed production denial. |
| `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/reset-password/validate`, `/api/auth/resend-verification`, `/api/auth/verify-email`, `/api/auth/mfa/resend`, `/api/auth/mfa/verify` | GET/POST | Public | Identity challenge endpoints; lifecycle redesign remains Phase B. Keep rate limits and generic errors. |
| `/api/auth/session` | GET | Authenticated | Signed identity may be inspected, but capabilities must be rebuilt from DB before response. |
| `/api/auth/logout` | POST | Public | Cookie clearing remains idempotent; lifecycle changes deferred to Phase B. |
| `/admin/session` | POST | Authenticated | Creates admin-scoped session only after current DB admin grant; no cached role promotion. |
| `/api/availability/check` | POST | Public | Public read-only availability check. |
| `/api/availability/vendor/[vendorId]` | GET | Public | Public read-only availability. |
| `/api/availability/vendor/[vendorId]` | PUT | Vendor manager | **Gap:** permission TODO and no persistence; deny unless exact manager, while feature remains non-persistent. |
| `/api/beta-gate` | POST | Public | Independent beta access challenge; not an application role grant. |
| `/api/bookings`, `/api/bookings/[id]`, `/api/bookings/[id]/media`, `/api/bookings/[id]/media/[assetId]/download` | GET | Customer-owned | Require active actor and exact work-record ownership; no ID-only access. |
| `/api/bookings/[id]/cancel` | POST | Customer-owned | Require exact customer ownership and current resource state. |
| `/api/bookings/[id]/claim`, `/api/bookings/claim` | POST | Customer-owned | Secure-link claim must bind to the active signed customer and exact record. |
| `/api/consent/[token]`, `/api/consent/[token]/verification/start`, `/api/consent/[token]/verification/verify`, `/api/consent/[token]/wrong-recipient`, `/api/consent/accept`, `/api/consent/decline` | GET/POST | Public | Purpose-bound signed/hashed permission link and verification challenge; Epic 1 gates remain unchanged. |
| `/api/consent/request`, `/api/consent/requests/[requestId]/recipient`, `/api/consent/requests/[requestId]/resend` | POST/PATCH | Vendor manager | Exact vendor manager and work-record ownership required. |
| `/api/consent/status` | GET | Authenticated | Exact customer, vendor manager, or assigned employee authorization according to resource relationship. |
| `/api/customer/profile`, `/api/customer/profile/photo` | GET | Customer-owned | Active actor may read only their own profile. |
| `/api/customer/register` | POST | Public | Registration remains public; acceptance/lifecycle redesign is outside Phase A. |
| `/api/dashboard/stats`, `/api/dashboard/user-growth` | GET | Customer-owned | Active user sees only their own dashboard data. |
| `/api/device/events` | POST | Authenticated | Device event must resolve an active actor/device relationship; no raw device UID authority. |
| `/api/device/heartbeat` | POST | Authenticated | **Gap:** device UID currently acts as authority; require a current authenticated/device-bound actor when supported, fail closed otherwise. |
| `/api/device/pairing/preview`, `/api/device/pairing/confirm` | GET/POST | Public | Purpose-bound signed invite plus one-time pairing code; preserve as secure-link flow. |
| `/api/device/pairing/request`, `/api/device/pairing/status` | GET/POST | Vendor manager | Exact active manager membership for the vendor. |
| `/api/devices`, `/api/vendor/devices`, `/api/vendor/devices/[id]`, `/api/vendors/[vendorId]/devices`, `/api/vendors/[vendorId]/devices/status` | GET/DELETE | Vendor manager | Exact vendor manager; device IDs do not grant access. |
| `/api/employee/device/pair` | POST | Vendor member | Active employee membership for exact vendor; manager paths use manager authority. |
| `/api/employee/jobs` | GET | Assigned employee | Return only exact current assignments for active employee membership. |
| `/api/employee/jobs/[jobId]/start`, `/stage`, `/complete`, `/verify-location` | POST | Assigned employee | Rebuild membership and assignment from DB before every stage operation; preserve Epic 1 and location gates. |
| `/api/headsets/claim` | POST | Vendor manager | Exact manager membership; no arbitrary vendor ID. |
| `/api/health` | GET | Public | Minimal liveness only; no infrastructure detail. |
| `/api/health/schema` | GET | Internal job | **Gap:** public schema detail; require internal/admin authority and minimize production output. |
| `/api/internal/notifications/process` | POST | Internal job | Preserve configured scheduler secret; no user session substitution. |
| `/api/job-recovery-assistant` | POST | Vendor member | Exact work-record/vendor relationship; AI cannot broaden resource access. |
| `/api/join/request` | POST | Public | Public vendor-interest intake; rate limit and minimize response. |
| `/api/passkey/authenticate`, `/api/passkey/authenticate-options` | POST | Public | Public WebAuthn challenge; Phase B owns lifecycle redesign. |
| `/api/passkey`, `/api/passkey/register`, `/api/passkey/register-options` | GET/POST | Authenticated | Active actor may manage only their own credentials. |
| `/api/profile/check-vendor-eligibility`, `/api/profile/toggle` | GET/POST | Authenticated | Rebuild available views from current DB; UI view selection is never authority. |
| `/api/reports/content` | POST | Authenticated | Active actor; report target may be public but reporter identity is current DB user. |
| `/api/reviews` | GET | Public | Only public-safe moderated review data; ignore caller-supplied `userId` as an ownership grant. |
| `/api/reviews/create`, `/api/reviews/me` | POST/GET | Customer-owned | Active customer and exact work-record ownership; preserve review rules. |
| `/api/reviews/prompt-event`, `/api/reviews/sentiment` | POST | Customer-owned | Exact eligible customer/work record; no caller-supplied ownership. |
| `/api/reviews/rating-intent` | POST | Retired/non-production | **Gap:** unauthenticated arbitrary logging; remove from production path or require exact customer context. |
| `/api/reviews/window/start`, `/api/reviews/window/expire` | POST | Retired/non-production | Obsolete deadline workflow; must remain non-authoritative and unavailable to public callers. |
| `/reviews/quick` | GET/POST | Public | Purpose-bound review link; token establishes only the single review action, never account authority. |
| `/api/search`, `/api/services/categories`, `/api/services/discover` | GET | Public | Public discovery with public-only fields. |
| `/api/services` | GET | Public | Public service listing only. |
| `/api/services` | POST | Vendor manager | Exact manager membership for created service vendor. |
| `/api/services/[id]` | GET | Public | Public service detail only when publishable; private draft detail needs vendor authority. |
| `/api/services/[id]` | PUT/DELETE | Vendor manager | Exact service vendor manager; current broad pending/member mutation is too permissive. |
| `/api/services/[id]/media`, `/api/services/[id]/reviews/public` | GET | Public | Public-approved media and moderated public reviews only. |
| `/api/users`, `/api/users/profile`, `/api/users/favorites`, `/api/users/favorites/[id]` | GET/DELETE | Customer-owned | Active actor may access/mutate only their own account resources. |
| `/api/vendor/context`, `/api/vendor/session-guard` | GET | Vendor member | Return exact current membership context; never select another vendor when preferred vendor is unauthorized. |
| `/api/vendor/dashboard`, `/api/vendor/profile`, `/api/vendor/profile/photo`, `/api/vendor/trust-score`, `/api/vendor/promotion-requests` | GET | Vendor member | Exact active vendor membership; manager-only fields/actions remain manager-only. |
| `/api/vendor/coaching-summary`, `/api/vendor/copy-assistant` | POST | Vendor manager | Exact vendor manager; AI receives only authorized vendor data. |
| `/api/vendor/register` | POST | Authenticated | Active actor creates their own vendor relationship; onboarding redesign is outside Phase A. |
| `/api/vendor/invite/[token]` | GET | Public | Purpose-bound invite preview; acceptance lifecycle remains Phase B. |
| `/api/vendors/[vendorId]/public`, `/reviews/public`, `/trust-score` | GET | Public | Public-listed vendor data, moderated reviews, and public-safe Trust Score snapshot only. |
| `/api/vendors/[vendorId]/dashboard`, `/media`, `/media/[assetId]/download`, `/media/storage`, `/storage/usage`, `/storage/verify` | GET/POST | Vendor member | Exact active membership; resource IDs cannot substitute for membership. |
| `/api/vendors/[vendorId]/employee-invites`, `/employee-invites/[inviteId]`, `/invites`, `/invites/[inviteId]` | GET/POST/PATCH/DELETE | Vendor manager | Exact active manager and invite ownership. Invite acceptance redesign remains Phase B. |
| `/api/vendors/[vendorId]/headsets/[deviceId]/assign`, `/unassign` | POST | Vendor manager | Exact active manager plus device/vendor ownership. |
| `/api/vendors/[vendorId]/jobs/[jobId]` | GET | Vendor member | Exact vendor membership and work-record vendor ownership. |
| `/api/vendors/[vendorId]/jobs/[jobId]/actions`, `/approve`, `/reject` | PATCH/POST | Vendor manager | Exact manager membership and work-record ownership. |
| `/api/vendors/[vendorId]/media/[assetId]` | DELETE | Vendor manager | Exact manager plus media/vendor ownership. |
| `/api/vendors/[vendorId]/media/sessions`, `/sessions/[sessionId]`, `/upload/init`, `/upload/complete`, `/upload/proxy` | GET/POST | Assigned employee | Exact active employee membership and current work-record assignment, plus canonical Epic 1 recording permission and location gates. Manager-only administrative paths must be explicit. |
| `/api/vendors/[vendorId]/memberships` | GET | Vendor manager | Exact manager. |
| `/api/vendors/[vendorId]/memberships/[membershipId]`, `/approve`, `/deny`, `/revoke` | PATCH/POST | Vendor manager | Exact manager; target membership must belong to exact vendor. |

## Page Route Protection Inventory

| Page family | Classification | Phase A behavior |
| --- | --- | --- |
| `/admin/**` | Admin | Admin-scoped signed identity plus active DB user and active DB admin grant; general customer/vendor session never authorizes. |
| `/vendor/**` | Vendor member | Server-side exact current membership gate before rendering vendor shell; manager-only pages/actions require current manager role. |
| `/customer/**`, `/my-bookings/**`, `/profile-settings`, `/user-dashboard`, `/favorites` | Customer-owned | Active general actor; each resource page checks exact ownership. |
| `/employee/**` | Assigned employee | Active employee membership; job pages additionally require current assignment. |
| Public service, vendor, policy, login, registration, permission-link, and review-link pages | Public | Public or purpose-bound link data only; no protected navigation or account authority inferred from page URL. |

## Known Pre-change Weaknesses Requiring Phase A Correction

1. Production accepts unsigned compatibility identity cookies such as `userId` and `vendorId`.
2. General and admin role claims in signed sessions can influence authorization even when DB authority changed.
3. Hardcoded owner IDs can authorize admin without a current DB role grant.
4. Preferred vendor resolution can silently fall back to a different membership.
5. Several vendor mutation routes accept any active or pending member instead of manager authority.
6. Public diagnostic routes disclose database/schema information.
7. Some device routes treat a device UID as sufficient authority.
8. Client-side role and layout checks can expose protected shells before server authorization finishes.
9. Error responses and logs are inconsistent and sometimes expose internal exception details.
10. Some public analytics/logging endpoints accept caller-supplied IDs without authenticated ownership.

## Phase Boundary

This inventory does not authorize Phase B work. Password-reset lifecycle, passkeys/MFA policy, trusted devices, durable session revocation, logout-everywhere, cross-tab synchronization, and employee-invite redesign remain deferred.
