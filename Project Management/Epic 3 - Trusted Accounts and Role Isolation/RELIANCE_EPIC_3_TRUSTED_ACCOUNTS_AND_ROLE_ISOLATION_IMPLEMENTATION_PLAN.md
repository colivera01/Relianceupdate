# Reliance Epic 3 - Trusted Accounts and Role Isolation Implementation Plan

**Planning status:** Approved with a two-phase internal implementation adjustment
**Implementation status:** Not started
**Repository reviewed:** `C:\Users\Cesar Olivera\Project Reliance`
**Current branch:** `cursor-latest-build`
**Planning baseline commit:** `43c18f9282d14567ce4c40b1fab32bfb97126817`
**Roadmap position:** Epic 3 after Verified Permission Request and Proof-First Platform Shell

This document is an implementation plan only. Producing it does not change application code, migrations, deployments, the Beta Readiness Checklist, or any frozen governing document.

**Approved implementation adjustment:** Epic 3 remains one roadmap epic but must be delivered through two separate engineering phases and commits. Phase A, Identity Foundation, must be implemented, tested, documented, and reviewed by the Product Owner before Phase B, Identity Lifecycle, begins. The controlling Phase A artifacts are:

- `RELIANCE_EPIC_3_AUTHORIZATION_ARCHITECTURE_DIAGRAM.md`
- `RELIANCE_EPIC_3_PHASE_A_IDENTITY_FOUNDATION_IMPLEMENTATION_PLAN.md`

Where this original plan combines Phase A and Phase B work in one sequence, the approved phase boundary in those artifacts controls.

## 1. Success Definition

Epic 3 succeeds when Reliance resolves every protected request from one authenticated server-side actor and then separately proves the authority required for the requested action.

Success means:

1. A session identifies one real `User`; client role labels, route names, IDs in request bodies, compatibility cookies, and browser storage cannot substitute for that identity.
2. Customer access requires ownership of the customer record or work record.
3. Vendor access requires an active membership in the exact vendor named by the protected resource.
4. Vendor-manager actions additionally require an active `MANAGER` membership.
5. Employee actions require an active `EMPLOYEE` membership, current assignment, and any existing Epic 1 permission and recording gates.
6. Admin access requires a current admin-capable account resolved from the database and a valid admin-scoped session. A general customer or vendor session can never become admin through a stale claim, another tab, or direct navigation.
7. Logout, expiration, password reset, account restriction, membership revocation, and employee reassignment end the relevant authority on the server, not only in the current tab's UI.
8. APIs return consistent `401`, `403`, `404`, `409`, `423`, and `429` results without leaking another account's data.
9. Existing valid users, profiles, memberships, work records, Epic 1 recording-permission decisions, reviews, Public proof, and Trust Score evidence remain intact.
10. The Product Owner can complete the manual authorization matrix in Section 15 without role leakage, stale access, or ID substitution.

Epic 3 is not complete merely because protected pages redirect correctly. The API and data access beneath every protected page must independently enforce the same actor, role, membership, ownership, and account-status rules.

## 2. Scope Confirmation

### Complete experience delivered

Customers, vendor managers, employees, and admins will sign in, refresh, navigate, recover access, and sign out without the platform confusing one identity or authority with another. A person with linked customer and vendor profiles may move between those authorized views without signing into a different account. An admin session remains isolated from a general customer/vendor session. Employees retain access only while their membership and assignment are current.

The experience includes clear loading, access-required, wrong-role, session-expired, account-changed, membership-revoked, and account-restricted states. Direct URLs and direct API requests are protected even when the UI is bypassed.

### Included

- Canonical server-side actor resolution for cookie-authenticated requests.
- Server-side session issuance, validation, expiration, revocation, and security-event evidence.
- Removal of production reliance on unsigned or non-HttpOnly compatibility identity cookies.
- Elimination of browser-exposed signed session bearer tokens from normal web login and session-refresh responses.
- Strict separation of admin-scoped and general sessions.
- Server-derived customer, vendor-manager, vendor-employee, and admin authorization helpers.
- Exact vendor-context selection with no silent fallback to a different membership.
- Protected layouts and direct-route behavior for customer, vendor, employee, and admin experiences.
- API authorization, ownership, membership, account-status, and IDOR review across the active route inventory.
- Secure employee invitation acceptance, identity binding, membership activation, cancellation, revocation, and reassignment behavior.
- Password reset, MFA, passkey, trusted-device, logout, and session-expiry alignment.
- Cross-tab account-change and logout synchronization.
- Security audit events that contain no passwords, raw session tokens, reset tokens, OTPs, passkey challenges, or raw invite secrets.
- Regression protection for Epic 1, Epic 2, reviews, Trust Score, Private proof, and Public proof.

### Explicitly excluded

- Account merging or combining two existing users.
- Changing the frozen participant, permission, publication, review, Trust Score, or proof-of-service rules.
- New recording-consent behavior, recording-subject assessment, location verification, capture controls, media publication, withdrawal, retention, deletion, or minor/guardian workflows.
- A general redesign of dashboards, navigation, public pages, or the Proof-First Platform Shell.
- New AI behavior. Existing AI endpoints inherit the corrected authorization model.
- Legal-policy rewrites.
- Epic 4 or any later roadmap epic.

### Supported browser-context rule proposed for approval

The secure and understandable Version 1 rule should be:

- One general signed-in identity per browser profile/origin. All customer, vendor, and employee tabs in that browser profile belong to that same `User`.
- Linked customer/vendor views are roles of that one identity and may be open in separate tabs at the same time.
- Signing into a different general account replaces the general session and all open general tabs show an `Account changed in another tab` state before loading more data.
- One path-scoped admin session may coexist with one general session in the same browser profile, because admin and general sessions use independent cookies and never fall back to one another.
- Two different general identities in simultaneous tabs require separate browser profiles, a private window, or separate browsers. Reliance will explain this instead of attempting unsafe tab-local identity tokens.

This rule preserves the Product Owner's required admin-plus-vendor comparison workflow while avoiding browser-exposed bearer tokens. Product Owner approval of this exact rule is required before implementation.

## 3. Checklist Items Included

The approved roadmap assigns the following rows to Epic 3:

- `SEC-01` through `SEC-03`.
- Relevant portions of `SEC-06` and `SEC-09`.
- Role-boundary portions of `ADM-02` through `ADM-04`.
- `PROD-03`.
- `TEST-01` through `TEST-03`, `TEST-11`, and `TEST-14`.
- `SHOT-05` and `SHOT-07`.
- Related `DOC-*` deliverables.

### Current tracker discrepancy

At planning baseline commit `43c18f9`, the current master checklist contains `PROD-03`, the assigned `TEST-*`, `SHOT-*`, and `DOC-*` rows, but it does not contain the roadmap-designated `SEC-01` through `SEC-03`, `SEC-06`, `SEC-09`, or `ADM-02` through `ADM-04` rows.

This plan does not invent or add missing checklist rows because the Product Owner prohibited checklist updates during planning. Before implementation begins, the Product Owner must approve one of these treatments:

1. Restore the approved security/admin rows from the authoritative checklist source; or
2. Approve a precise additive set of security/admin rows that preserves the roadmap meaning.

Implementation evidence may be gathered while the discrepancy is being resolved, but Epic 3 cannot satisfy its mandatory checklist gate until the tracker contains the rows it is expected to update.

### Visible checklist mapping

| Current row | Epic 3 responsibility |
|---|---|
| `PROD-03` | Role-appropriate navigation must reflect server-authorized profiles and never grant authority. |
| `TEST-01` | Unit coverage for session parsing, authorization policy, ownership, membership, revocation, and error mapping. |
| `TEST-02` | Route integration coverage using realistic user, membership, session, invite, and work-record fixtures. |
| `TEST-03` | Stable four-role Playwright journeys and direct-URL denial coverage. |
| `TEST-11` | Regression suite proving Epic 1, Epic 2, review, Trust Score, and proof workflows remain unchanged. |
| `TEST-14` | Authentication, authorization, IDOR, CSRF, fixation, brute-force, reset, revocation, and secret-exposure tests. |
| `SHOT-05` | Responsive auth, role, denial, expiry, and revoked-access evidence. |
| `SHOT-07` | Loading, success, failure, empty, expired, wrong-role, and blocked states. |
| `DOC-01` through `DOC-07` | Engineering report, screenshot index, UX review, and four-role journey summaries. |

## 4. Dependencies

### Frozen design dependencies

- `RELIANCE_PRODUCT_IDENTITY.md`: Reliance remains a proof-of-service platform; role isolation must not introduce booking or marketplace language.
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`: Current identity findings remain design constraints, not executable evidence.
- `RELIANCE_CONSENT_ARCHITECTURE_V1.md`: participant authority is specific and non-delegable; identity alone never supplies subject authority.
- `RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`: permission, recording, Private proof, Public proof, and reviews remain separate.
- `RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`: approved Product Owner decisions remain unchanged.
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`: participant names, message order, error patterns, and privacy language govern new states.
- `RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`: every blocked or recovery screen must explain why, what to do, what happens if nothing is done, and what remains private.
- `RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`: Epic 3 scope, acceptance criteria, deliverables, demo structure, and regression statement are mandatory.

### Implemented dependencies verified

- Epic 1 canonical recording-permission gate and permission evidence exist and must remain server-enforced.
- Epic 2 Proof-First shells and role terminology exist and must be preserved where they are effective.
- `User`, `AuthCredential`, MFA, passkey, trusted-device, `VendorMembership`, `VendorInvite`, and employee/capture structures exist in Prisma.
- Admin, vendor-manager, vendor-membership, customer ownership, employee assignment, and account-status checks exist, but they are not yet one uniform policy layer.
- Path-scoped admin cookies exist and provide a base for admin/general isolation.
- Existing tests cover portions of login, session, logout, MFA, passkey, vendor membership, and invites.

### Operational dependencies

- Azure SQL must support one additive session/security migration and indexed token-hash lookups.
- Beta deployment must be able to invalidate existing stateless sessions and require a one-time re-login at cutover.
- Controlled customer, vendor-manager, employee, and admin accounts are required for live verification.
- Email delivery must be available for recovery and MFA validation. SMS handset delivery remains an external provider dependency if Telnyx is still not operational.
- Azure logs must be available for a secret-exposure review without copying production secrets or customer data into project artifacts.

## 5. Current Repository Audit

This section reflects executable code at the planning baseline. Documentation and previous conversations were not treated as implementation evidence.

### 5.1 Authentication and session resolution

| Current source | Verified behavior | Assessment |
|---|---|---|
| `src/lib/auth-session.ts` | Creates signed HMAC session tokens with a seven-day claim lifetime. General, admin-UI, and admin-API cookies exist. | Useful cryptographic base, but stateless sessions cannot be individually revoked or reliably ended across tabs/browsers. |
| `src/lib/auth.ts` | Resolves identity from signed cookies/bearers, then development fallbacks, and also accepts non-HttpOnly `userId` compatibility cookies in production. | Multiple identity sources can disagree. Production compatibility cookies must not authenticate a protected request. |
| `src/lib/auth-login-response.ts` | Sets HttpOnly cookies but also returns a signed bearer token and sets non-HttpOnly user-ID cookies for general login. | Browser JavaScript receives reusable authentication material; XSS impact and stale-tab risk are unnecessarily broad. |
| `src/app/api/auth/session/route.ts` | Rebuilds the current user but returns another raw signed bearer token. | Server reconciliation is valuable; returning bearer material is not required for same-origin web access. |
| `src/app/admin/session/route.ts` | Reconciles admin state and refreshes path-scoped admin cookies on GET. Admin resolution can fall back to the general cookie. | Sliding refresh and general-cookie fallback weaken strict admin isolation. |
| `src/app/api/auth/logout/route.ts` | Clears either general or admin cookies. It has no server-side revocation or durable logout audit. | Other tabs and previously issued bearer tokens can remain effective until expiry. |
| `src/contexts/AuthContext.tsx` | Stores user and signed bearer token in tab-local `sessionStorage`; reconciles on mount, focus, and visibility. | Tabs can display stale identities until focus. Logout is not broadcast, and client state can diverge from shared server cookies. |
| `middleware.ts` | Enforces the beta-access gate only. | Protected app routes depend on layouts and APIs; middleware provides no general role boundary. |

### 5.2 Roles, membership, and account switching

| Current source | Verified behavior | Assessment |
|---|---|---|
| `src/hooks/useAvailableRoles.ts` | Derives roles from client user data and best-effort API probes; always adds the current UI role even when server roles do not include it. | UI role metadata can disagree with actual authority and create role leakage/confusion. |
| `src/components/ProfileToggle.tsx` | Navigation may continue even when `/api/profile/toggle` fails. | A failed server role check can still navigate into a shell. APIs may deny access, but the experience is misleading. |
| `src/lib/vendor-context.ts` | Selects active memberships, but a preferred vendor with no membership may fall back to another membership. | Explicit vendor context must fail closed rather than silently choosing a different vendor. |
| `src/lib/membership-auth.ts` | Provides useful manager/member guards and account checks. Device lookup contains a TODO and selects the first active vendor membership rather than a proven device owner. | Membership guards should become the canonical vendor policy; device/employee ownership needs correction. |
| `src/app/vendor/layout.tsx` | Client-side shell combines session claims, profile probes, pending state, and resolved context. | Protected content should depend on a server-authorized context, not a union of client hints. |
| `src/app/(user)/layout.tsx` | Customer shell is client guarded and makes a secondary profile request for restriction state. | Direct customer pages need a server ownership/session boundary; public service pages remain intentionally public. |
| `src/app/admin/layout.tsx` | Performs a server admin check before rendering admin content. | Good pattern, but admin APIs must use the same strict database-derived admin context. |

### 5.3 Login, recovery, MFA, passkeys, and trusted devices

| Current source | Verified behavior | Assessment |
|---|---|---|
| `src/app/api/auth/login/route.ts` | Credential login, role payload construction, rate limiting, and MFA challenge initiation exist. | Role claims must be refreshed from current DB authority on every server session use. |
| `src/lib/auth-rate-limit.ts` | Failed-login records are stored in a local `tmp` JSON file. | Not reliable across scaled Azure instances, restarts, or read-only package filesystems. |
| `src/lib/password-reset-tokens.ts` | Database-backed hashed reset challenges exist, with a local-file fallback. | Local fallback is not production durable. Password reset does not revoke all active sessions/trusted devices. |
| `src/app/api/auth/reset-password/route.ts` | Changes the password and clears general cookies in the current response. | Admin cookies, other browsers, other tabs, and existing stateless bearer tokens are not revoked. |
| `src/lib/auth-mfa.ts` | Hashed MFA codes and hashed trusted-device tokens with expiration/revocation fields exist. | Strong base; challenge limits, session binding, and reset/revocation integration require matrix testing. |
| `src/lib/auth-passkeys.ts` and `src/app/api/passkey/*` | WebAuthn challenge, credential counter, revocation, and authentication flows exist. | Preserve the standard implementation; bind the successful result to the new server session and audit model. |

### 5.4 Employee identity, invitations, and capture links

| Current source | Verified behavior | Assessment |
|---|---|---|
| `prisma/schema.prisma` `VendorMembership` | Represents active manager/employee authority and revocation evidence. | This should be the canonical employee/vendor authorization relationship. |
| `prisma/schema.prisma` `Employee` | Separate legacy employee rows exist and are not directly bound to `User`/`VendorMembership`. | Parallel employee identities create drift risk and require a non-destructive reconciliation plan. |
| `prisma/schema.prisma` `VendorInvite` | Stores raw unique `code` and raw unique `token`. | Raw bearer invite secrets should not remain retrievable from the database or manager API. |
| `src/app/api/vendors/[vendorId]/employee-invites/route.ts` | Manager guard exists, but manager list responses expose raw invite code, token, and URL. Invite creation may create or update user records before recipient verification. | Invite secrets and pre-verification account mutation are high-risk. |
| `src/app/api/vendor/invite/[token]/route.ts` | A bearer-link holder can submit contact details, create or update a user, and activate an employee membership without authenticating the intended contact. | Release-blocking identity-binding weakness. Acceptance must verify the recipient before membership activation. |
| `src/lib/employee-capture-token.ts` | Signed two-week capture links bind vendor, booking, and membership and recheck assignment/status. | Useful resource binding, but long-lived URL bearer material and incomplete status rejection need tightening. Only `ACTIVE` should authorize. |
| `src/app/api/employee/jobs/route.ts` | Signed-in employee or capture token can load assigned/released work; Epic 1 permission gate is returned. | Preserve canonical permission gating; authority must also fail immediately on membership revocation/reassignment. |

### 5.5 API and direct-route inventory

The active repository contains approximately 179 API route files, including admin, vendor, customer, employee, authentication, consent, media, review, and public endpoint families. Existing guards are not uniformly applied through one policy API.

Verified examples:

- `src/app/api/admin/db-status/route.ts` exposes database/environment metadata without an admin guard. It must be protected or removed from production exposure.
- Non-production reset/seed routes use environment and secret checks; those controls must be validated as fail-closed in production.
- Vendor dashboard, device, profile, and Trust Score routes often use `getVendorIdFromRequest`, inheriting compatibility-cookie and context-fallback risk.
- Public vendor/service routes are intentionally public and must continue to filter only Public/active data.
- Review, permission, media, and booking routes use different combinations of user, vendor, membership, resource, and sidecar checks. They need a route-by-route ownership matrix, not a blanket route-prefix assumption.

Implementation must produce a complete protected-route inventory before changing route guards. Every route will be classified `public`, `authenticated`, `customer-owned`, `vendor-member`, `vendor-manager`, `assigned-employee`, `admin`, `internal-job`, or `retired/non-production`.

### 5.6 Existing tests

Current focused coverage includes login integration, session, admin session, logout, forgot password, MFA resend, auth helper tests, vendor invites, vendor membership, media-session consent, review sidecar authorization, and an auth redirect smoke test. There is not yet one exhaustive authorization matrix covering all role/resource combinations, direct URL access, cross-tab replacement, session revocation, or IDOR substitutions.

## 6. Current Weaknesses and Required Treatment

| Weakness | Current evidence | Required Epic 3 treatment | Priority |
|---|---|---|---|
| Account confusion | Shared cookies plus tab-local bearer/user state; admin/general fallback | Canonical server session, scoped cookies, cross-tab account-change event, no cross-scope fallback | Critical |
| Stale sessions | Stateless seven-day tokens, no server revocation | Hashed server session records with revoked/expired state and fresh authority checks | Critical |
| Shared-browser behavior | Different tabs can retain different `sessionStorage` identities while cookies are shared | Enforce one general identity per browser profile; allow separately scoped admin session; explain replacement | High |
| Role leakage | UI adds current role and navigation proceeds after toggle failure | Server-authorized role capabilities; denied role never renders protected shell/data | High |
| Direct URL access | Middleware only protects beta gate; customer/vendor shells are client guarded | Server layout/page guards plus independent API guards | High |
| IDOR | Many routes accept `vendorId`, booking IDs, user IDs, membership IDs, or media IDs | Resolve resource first, derive tenant/owner, compare to actor authority, use `404` where enumeration risk exists | Critical |
| API authorization gaps | Guard helpers vary; `admin/db-status` lacks admin guard | Complete route inventory and policy wrapper adoption | Critical |
| Employee invitation takeover | Raw bearer invite may mutate/create identity and activate membership | Hashed rotating invite, verified recipient account, pending-to-active transition, intended-recipient binding | Critical |
| Account recovery persistence | Password reset does not revoke all sessions/trusted devices | Atomic password update plus session/trusted-device revocation and security notice | High |
| Multi-tab logout | Current tab clears storage; others remain stale | Broadcast account event plus server revocation; all tabs fail closed on next request | High |
| Admin fallback | Admin resolver may use general session | Admin APIs/UI accept only admin-scoped server sessions | Critical |
| Vendor context fallback | Preferred vendor may silently become a different membership | Exact requested vendor or explicit selection; otherwise `403/404` | Critical |
| Device-owner ambiguity | First active membership may be selected for device | Exact current device assignment and active membership required | High |
| Local-file security state | Login throttle/reset fallback uses local `tmp` files | Durable shared store or DB records for production; local fallback development only | High |
| Secret exposure | Signed session bearer returned to browser; invite token returned in manager payload | HttpOnly session only for same-origin web; hash invite/session secrets; redact logs/API/audit | Critical |
| Fail-open timeout | Vendor timeout errors can return not timed out | Security uncertainty must block protected vendor actions with recoverable error | High |

## 7. Expected Files Affected

The exact set will be finalized by the route inventory. Current estimate: 25-45 application/test files, one additive migration, and Epic 3 project records.

### Authentication

- `src/lib/auth-session.ts`
- `src/lib/auth.ts`
- `src/lib/auth-login-response.ts`
- `src/lib/auth-login-user.ts`
- `src/lib/auth-rate-limit.ts`
- `src/lib/password-reset-tokens.ts`
- `src/lib/auth-mfa.ts`
- `src/lib/auth-passkeys.ts`
- New canonical session/actor service under `src/lib/auth/` or the repository's established shared-library structure

### Middleware

- `middleware.ts` only if a presence-level redirect can remain Edge-safe and cannot be mistaken for authorization.
- No database-dependent authority decision will be placed solely in middleware.

### Layouts and routes

- `src/app/admin/layout.tsx`
- `src/app/vendor/layout.tsx`
- `src/app/(user)/layout.tsx`
- Employee entry/work pages that currently have no dedicated server layout
- `src/app/auth/login/page.tsx`
- `src/app/auth/forgot-password/page.tsx`
- `src/app/auth/reset-password/page.tsx`
- Access-required/session-expired/account-changed/revoked-state components or pages

### APIs

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/admin/session/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/mfa/*`
- `src/app/api/passkey/*`
- `src/app/api/profile/toggle/route.ts`
- Protected `src/app/api/customer/*`
- Protected `src/app/api/vendor/*` and `src/app/api/vendors/[vendorId]/*`
- Protected `src/app/api/employee/*`
- Protected `src/app/api/admin/*`
- Protected consent, media, review, booking, and service-record routes identified by the inventory

### Session and authorization helpers

- `src/lib/admin-auth.ts`
- `src/lib/vendor-context.ts`
- `src/lib/membership-auth.ts`
- `src/lib/account-status.ts`
- `src/lib/client-session.ts`
- `src/contexts/AuthContext.tsx`
- `src/hooks/useAvailableRoles.ts`
- `src/components/ProfileToggle.tsx`
- `src/components/vendor/VendorSessionGuard.tsx`

### Employee invitation and membership

- `src/app/api/vendors/[vendorId]/employee-invites/route.ts`
- `src/app/api/vendors/[vendorId]/employee-invites/[inviteId]/route.ts`
- `src/app/api/vendor/invite/[token]/route.ts`
- `src/app/vendor/invite/[token]/page.tsx`
- `src/app/vendor/employees/page.tsx`
- `src/lib/employee-capture-token.ts`
- Membership approval, revocation, reassignment, and device-assignment routes identified by the inventory

### Admin

- Admin session and guard files above
- `src/app/api/admin/db-status/route.ts`
- Admin account/security/session inspection surfaces that already manage trusted devices or account state
- Security audit-log display if current logs cannot show the new events safely

### Database

- `prisma/schema.prisma`
- One additive migration under `prisma/migrations/`
- No destructive account merge, membership rewrite, or work-record migration

### Notifications

- Existing login alert, MFA, recovery, invite, invite-accepted, revocation, and security-event templates only where behavior changes
- No consent, review, publication, or marketing template changes

### Tests

- Existing auth/session/login/logout/MFA/passkey/invite/membership tests
- New policy and session unit tests
- New API authorization matrix and IDOR integration suites
- New Playwright role-isolation, multi-tab, expiry, recovery, and revoked-employee journeys
- Existing Epic 1, review, Trust Score, media, and route smoke tests for regression

### Documentation

- `Project Management/Epic 3 - Trusted Accounts and Role Isolation/01_Engineering_Report.md`
- `02_UX_Review.md`
- `03_Product_Owner_Demo.md`
- `04_Lessons_Learned.md`
- `05_Technical_Debt.md`
- `06_Checklist_Snapshot.md`
- `07_Git_Checkpoint.md`
- Epic 3 screenshot index under `08_Screenshots/`
- `Project Management/PROJECT_DASHBOARD.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md` only after implementation evidence exists and the missing-row discrepancy is resolved

## 8. Security Model

### Universal authorization rule

Every protected operation follows this order:

1. Authenticate the server session.
2. Load the current active `User` and credential state.
3. Resolve the requested resource from the database.
4. Determine the resource owner/vendor/assignment from the resource, never from a client assertion alone.
5. Resolve the actor's current role, membership, ownership, and account status from the database.
6. Apply the action-specific policy.
7. Record a security audit event for consequential allow/deny/revoke/recovery actions.
8. Return only the fields that role may view.

### Customer

**May see:** own profile, own work records, customer-visible Private proof tied to those records, Public proof, own reviews, own permission decisions, and own security settings.

**May modify:** own profile and credentials; decisions specifically assigned to that customer/verified authority context; own eligible genuine review; own favorites and supported account preferences.

**May never access:** another customer's Private record or review draft; vendor internal dashboards; employee assignment/capture tools; admin tools; raw tokens, OTPs, audit internals, or another user's contact/security data.

### Vendor manager

**May see:** the exact vendor's business profile, services, work records, active/pending memberships, assignment status, authorized permission evidence summaries, and vendor-facing metrics.

**May modify:** vendor profile/services and work records within current approved rules; invite/revoke/reassign team members; perform manager-review actions; approved vendor operational settings.

**May never access:** another vendor's non-Public data; customer credentials/security data; customer Private proof unrelated to that vendor's work; admin moderation controls; employee or customer accounts as if they were the account owner; raw permission/session/invite/OTP secrets.

### Employee

**May see:** own membership, current assignments, approved recording scope/status, and the minimum customer/service information required to perform assigned work.

**May modify:** only current assigned work stages/actions permitted by membership, assignment, Epic 1 permission state, location gate, and recording workflow.

**May never access:** vendor-manager settings, team administration, unassigned work, another employee's capture links, customer account/security data, admin tools, or other vendors. Revocation or reassignment ends access immediately.

### Admin

**May see:** operational/admin evidence required for moderation, support, safety, account restriction, reports, permission audit, and approved internal controls.

**May modify:** only actions explicitly assigned to admin by the frozen workflow and current approved admin tools, with audit evidence.

**May never access:** a customer/vendor/employee session by impersonation, silently act as another participant, create customer permission, fabricate customer activity, or broaden Private/Public access. Admin identity does not confer participant authority.

### Reliance internal/background jobs

Internal jobs use a separate authenticated service identity or deployment secret with narrow purpose, not an admin browser session. Each job route must validate purpose, environment, replay/idempotency, and audit requirements. Non-production seed/reset tools must be unreachable in production even if a secret is guessed.

## 9. Session Model

### Proposed durable session record

One additive `AuthSession` model is recommended. It should store:

- session ID;
- user ID;
- token hash only;
- scope (`GENERAL` or `ADMIN`);
- issued, last-seen, absolute-expiry, revoked, and revocation-reason timestamps;
- authentication method and MFA strength;
- trusted-device reference when used;
- IP/user-agent fingerprints suitable for security evidence without storing unnecessary secrets;
- optional session family/version for rotation and recovery revocation.

The browser receives only a random opaque token in an HttpOnly, Secure, SameSite cookie. The database stores only its hash. Session endpoints do not return bearer tokens to JavaScript.

### Login

- Verify credentials/passkey and any required MFA.
- Rebuild current roles from the database.
- Create one server session for the requested scope.
- General login replaces the previous general identity in that browser profile and broadcasts the account-change event.
- Admin login creates only admin-scoped cookies and never derives admin from a general cookie.
- Rotate session IDs after authentication to prevent fixation.

### Logout

- Revoke the server session first.
- Clear the matching cookies.
- Broadcast logout/account-change to all same-scope tabs.
- General logout does not silently terminate a separately scoped admin session; admin logout does not terminate the general session unless the user chooses `Sign out everywhere`.
- `Sign out everywhere` revokes all sessions and trusted devices for that user after confirmation.

### Expiration

- Preserve the current seven-day absolute maximum for beta unless the Product Owner approves a different value.
- Stop the current indefinite admin sliding refresh behavior.
- Preserve the vendor-configured inactivity timeout, but enforce it server-side and fail closed when timeout state cannot be verified.
- UI shows a clear session-expired state and preserves a safe return path without preserving sensitive form data.

### Multiple tabs

- Same identity and different authorized customer/vendor views may remain open concurrently.
- Logout, account replacement, membership revocation, and account restriction are broadcast to open tabs.
- Each protected fetch still validates the server record; BroadcastChannel is UX acceleration, not the security boundary.
- An admin tab and one general-identity tab may coexist because their server sessions are strictly scoped.

### Multiple browsers/devices

- Each browser receives an independent revocable session.
- Account security may list and revoke active sessions if the existing admin/account UI can support it without broad redesign.
- Password reset revokes all active sessions and trusted devices for the affected account, then requires fresh authentication.

### Password reset

- Keep generic forgot-password responses to prevent account enumeration.
- Keep reset tokens hashed, single-use, and expiring.
- Remove production local-file fallback.
- On success, atomically update the password, consume the challenge, revoke active sessions/trusted devices, and send a security notification.

### MFA and passkeys

- Preserve current hashed MFA challenges and WebAuthn counter verification.
- Successful MFA/passkey creates the same canonical server session as password login.
- Trusted device reduces the configured MFA prompt only; it never bypasses current account, role, membership, or restriction checks.
- Session schema leaves room for future MFA level/purpose without claiming a new MFA product in Epic 3.

## 10. Authorization Matrix

| Action | Customer | Vendor manager | Employee | Admin | Required ownership/membership |
|---|---:|---:|---:|---:|---|
| View own customer dashboard | Allow | Allow only if same user has customer profile | Allow only if same user has customer profile | Deny | Current user owns customer data |
| View another customer's Private work record | Deny | Only vendor-side minimum for its own work | Only assigned minimum | Approved support/moderation evidence only | Exact booking/vendor/assignment/admin purpose |
| View Public proof | Allow | Allow | Allow | Allow | Public/active visibility only |
| Open vendor dashboard | Deny unless linked active membership | Allow | Deny manager dashboard | Deny as participant | Active exact-vendor manager membership |
| Modify vendor profile/services | Deny | Allow | Deny | Approved admin controls only | Active exact-vendor manager membership |
| Invite/revoke employee | Deny | Allow | Deny | Approved admin support only | Active exact-vendor manager membership |
| View employee assignments | Deny | Allow for own vendor | Allow own current assignments | Approved admin evidence only | Exact membership and assignment |
| Start/capture assigned work | Deny | Only if explicitly assigned under employee rules | Allow when all existing gates pass | Deny | Active employee membership, assignment, release, location, Epic 1 gate |
| Create/resend permission request | Deny | Allow under Epic 1 policy | Deny unless frozen rule later grants | Read-only evidence | Exact vendor manager authority |
| Decide customer permission | Allow only for verified intended authority holder | Deny | Deny | Deny | Epic 1 verified decision session/account binding |
| Submit review | Allow for own eligible record | Deny unless same user is eligible customer | Deny unless same user is eligible customer | Moderate only | Work-record ownership and review eligibility |
| Moderate media/review | Deny | Deny | Deny | Allow | Current admin-scoped session and action-specific policy |
| Access admin dashboard/API | Deny | Deny | Deny | Allow | Current DB admin capability and admin-scoped session |
| Reset own password | Allow | Allow | Allow | Allow | Verified single-use reset challenge for exact credential |
| Revoke another user's sessions | Deny | Deny | Deny | Approved account-security action only | Admin policy plus immutable audit |
| Change request `vendorId` to another vendor | Deny | Deny | Deny | Only explicit admin endpoint | Exact resource vendor and current membership; no fallback |

Linked profiles do not combine authorities. If one `User` is both customer and vendor manager, each action still passes the row-specific rule.

## 11. API Protection Plan

### Standard endpoint contract

Every protected route will document and test:

- **Authentication:** required session scope and authentication strength.
- **Authorization:** required role/capability.
- **Ownership:** exact resource relationship derived server-side.
- **Membership:** exact vendor role/status when applicable.
- **Audit:** allowed, denied, recovery, revocation, or mutation evidence required.
- **Expected error:** stable status/code and non-enumerating message.

### Route-family matrix

| Route family | Authentication | Authorization/ownership | Audit | Expected denial |
|---|---|---|---|---|
| `/api/auth/login`, forgot/reset, MFA, passkey authentication | Public challenge endpoints with rate/replay controls | Exact credential/challenge binding; generic lookup responses | Login success/failure threshold, reset, MFA, trusted-device changes | `400`, `401`, `429` |
| `/api/auth/session`, logout, passkey management | General server session | Current active user; passkey belongs to credential | Session issue/revoke, passkey add/revoke | `401`, `423` |
| `/admin/session`, `/api/admin/**` | Admin-scoped server session only | Current DB admin capability; action-specific policy | Admin login/access/mutation/denial | `401`, `403`, `423` |
| `/api/customer/**` | General server session | Current user owns requested customer/work/review data | Consequential mutation and denied cross-owner attempt | `401`, scoped `404`, `423` |
| `/api/vendor/**` | General server session | Exact current vendor context; no ID fallback | Context selection and protected mutation | `401`, `403`, `404`, `423` |
| `/api/vendors/[vendorId]/**` | General server session | Active exact-vendor membership; manager for manager actions | Membership/invite/profile/job mutation | `401`, `403`, scoped `404`, `409` |
| `/api/employee/**` | General employee session or narrowly approved assignment token | Active exact-vendor employee membership and current assignment | Start/capture/reassignment/revocation denial | `401`, `403`, `404`, `409`, `423` |
| Employee invite acceptance | Verified recipient session/challenge | Invite recipient matches verified account; invite active/current; membership transition is atomic | Sent/opened/verified/accepted/wrong account/expired/cancelled | `400`, `401`, `403`, `409`, `410` |
| `/api/consent/**` | Preserve Epic 1's verified session/link rules | Exact booking/vendor/authority holder and canonical recording gate | Preserve Epic 1 immutable evidence | Existing Epic 1 stable codes |
| Media/session/upload routes | General or assigned-employee session | Exact vendor, booking, employee assignment, permission, release, location, stage rules | Session/create/upload/denial | `401`, `403`, `404`, `409`, `423` |
| Review routes | General customer or admin scope as applicable | Exact work-record owner or admin moderation | Genuine submission/moderation only | `401`, `403`, scoped `404`, `409` |
| Public vendor/service/proof routes | No account required | Return only current Public/active fields | No sensitive access audit needed | `404` for non-Public data |
| Internal scheduler/job routes | Purpose-specific service authentication | Exact job capability, environment, idempotency | Each invocation/result | `401`, `403`, `409` |
| Development seed/reset routes | Never available in production | Environment plus deployment secret in development only | Invocation | `404` in production |

### IDOR method

For every route parameter or body field named `userId`, `vendorId`, `bookingId`, `serviceId`, `membershipId`, `inviteId`, `reviewId`, `mediaSessionId`, `assetId`, or equivalent:

1. Load the resource by ID.
2. Derive its owner/vendor/assignment.
3. Compare to the canonical actor context.
4. Ignore client-supplied actor IDs.
5. Return scoped `404` when revealing existence would expose another tenant/customer; use `403` for a known role boundary where the UX needs to explain it.

### CSRF and request integrity

- Cookie-authenticated mutations require same-origin validation and an approved CSRF strategy.
- `SameSite=Lax` remains defense in depth, not the only mutation control.
- GET routes remain read-only.
- Login, recovery, MFA, passkey, and invite endpoints have per-identity and per-network rate limits in a shared durable store.
- Security logs redact cookies, authorization headers, token query parameters, OTPs, reset links, and invite secrets.

## 12. Regression Protection

### Epic 1 cannot be weakened

- Recording permission continues to use the canonical Epic 1 decision.
- Pending, declined, expired, wrong-recipient, superseded, and no-channel states remain recording-locked.
- Session or role changes cannot create permission or bypass the recording gate.
- Invite, login, or account recovery events create no review, rating, Trust Score input, publication approval, or Public video.
- No raw permission token or OTP enters session/audit logs.

### Epic 2 cannot be weakened

- Preserve effective Product Identity and Language Guide-aligned copy.
- Preserve proof-first navigation and public/private distinctions.
- Only auth/role/access messaging that is misleading or insecure may change.
- Public pages remain accessible without receiving protected data.
- Responsive layouts and first-time comprehension remain intact.

### Other preserved behavior

- Valid reviews and moderation state remain unchanged.
- No-review remains no-review and has no Trust Score effect.
- Existing valid Public proof remains Public; Private proof remains restricted.
- Existing work-record, assignment, location, media-stage, and manager-review rules remain unchanged except where stale/revoked authority must be denied.
- Existing user and vendor IDs are not merged, rewritten, or reassigned.

## 13. Test Plan

### Unit tests

- Session token hashing, issue, lookup, rotation, expiry, revocation, scope, and constant-time comparison.
- Canonical actor construction from current DB state.
- Customer ownership, vendor membership/manager, employee assignment, and admin policies.
- Exact vendor context with no fallback.
- Error mapping and redaction.
- Cross-tab event payloads contain no secrets.
- Invite hashing, intended-recipient match, expiry, cancellation, replay, and activation transition.
- Password reset session/trusted-device revocation.
- MFA/passkey session creation and trusted-device boundaries.

### Integration authorization matrix

For representative protected routes, run each action as anonymous, correct customer, wrong customer, correct vendor manager, other-vendor manager, active employee, revoked employee, unassigned employee, admin, and restricted account.

Required scenarios:

- Customer A cannot read or mutate Customer B's work record/review/profile.
- Vendor A cannot access Vendor B by changing route/body/query IDs.
- Employee sees only current assignments and loses access after revocation/reassignment.
- Vendor manager cannot use admin routes; admin cannot silently act as a vendor/customer.
- Direct API requests fail even if the matching protected page would normally hide the action.
- Public endpoints return no Private fields.
- Invite acceptance cannot bind to a different signed-in account or mutate an existing user's verified contact.
- Cancelled, expired, used, and superseded invites cannot activate membership.
- Password reset invalidates all old sessions, bearers, and trusted devices.
- Restricted/deactivated accounts fail closed.

### Session and browser tests

- General login, refresh, browser reopen, absolute expiry, vendor inactivity expiry, and logout.
- Admin login in one tab plus vendor/customer general session in another tab without cross-scope leakage.
- Login as a different general account in another tab; all existing general tabs show account-changed and do not render old data.
- Logout in one tab; other same-scope tabs stop protected access.
- Admin logout does not silently log out the general account and vice versa.
- Multiple browsers create independent revocable sessions.
- Session fixation attempt does not preserve pre-login session ID.
- Browser refresh during MFA, passkey, reset, and invite flows remains consistent.

### Security tests

- IDOR parameter substitution across representative resource families.
- CSRF attempts from foreign Origin/Referer.
- Stale/revoked session replay.
- Raw cookie/bearer/invite/reset/OTP secret scans in responses, logs, audit metadata, and screenshots.
- Brute-force and distributed-instance rate-limit behavior.
- Production denial of seed/reset/debug routes and environment metadata.
- Cookie flags and path isolation.
- Passkey challenge replay and counter regression.

### Regression suites

- Epic 1 permission request, allow/decline/wrong-recipient/resend, canonical recording lock, and admin Permission Audit.
- Epic 2 public shell and route smoke tests.
- Review eligibility/ownership/moderation and Trust Score neutrality.
- Vendor jobs, employee jobs, media-session creation, location gate, and three-stage recording tests.
- Public/Private service-video visibility tests.

### Commands expected

The implementation report will record exact results for commands actually run, expected to include:

- Focused Vitest auth/session/authorization/invite/membership suites.
- Focused Epic 1, review, Trust Score, employee, vendor, and media regression suites.
- `npm test` when feasible.
- `npx tsc --noEmit --pretty false --incremental false`.
- Repository lint command if one exists at implementation time; the current `package.json` has no lint script, so no lint success will be claimed without adding/using an approved command.
- `npm run build`.
- Focused and full applicable Playwright suites against a controlled beta-like database.
- Dependency/security scan using the repository-approved tool available at implementation time.

### Acceptance test gate

No high/critical authorization defect, unresolved cross-account data exposure, raw authentication secret exposure, or Epic 1 recording-gate regression may remain open. A test blocked by external infrastructure must be clearly separated from an application failure.

## 14. Screenshot Plan

Screenshots will contain controlled synthetic accounts and redacted contact details. They will be indexed but not committed unless the approved project rules explicitly require repository screenshot artifacts.

### Desktop

- Customer dashboard with correct identity.
- Vendor-manager dashboard with exact vendor.
- Employee assignment page with current employee identity.
- Admin dashboard with admin-scoped identity.
- Admin and general sessions open side by side without leakage.
- Wrong-role access denied.
- Direct-route access required.
- Session expired.
- Account changed in another tab.
- Employee invitation verified-account step.
- Employee revoked/reassigned blocked state.
- Password-reset success and old-session denial.

### Mobile

- Login and MFA/passkey choice.
- Customer, vendor, employee, and admin identity headers.
- Access required, session expired, account changed, wrong-role, and revoked employee.
- Invite verification and wrong-account state.

### State inventory

- Loading: checking session/authority.
- Success: signed in to correct role; invite accepted.
- Failure: session service unavailable without leaking data.
- Empty: no memberships/no assignments.
- Blocked: wrong role, restricted account, revoked membership, expired invite.
- Before/after: current misleading role shell or stale-tab behavior compared with canonical blocked/reconciled behavior, where practical and safe.

## 15. Product Owner Demo Checklist

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Sign in as each dedicated role, refresh, close/reopen, navigate directly, and confirm every page shows the correct identity and authority without training. |
| Admin/general coexistence | Open the admin account on `/admin` and a controlled vendor/customer account on general routes in another tab. Refresh both. Each remains correct; neither gains the other's navigation or data. |
| General account replacement | With Customer A open, sign in as Customer B in another general tab. Return to A's tab. It must show `Account changed in another tab` before any A data can reload. |
| Expected notifications | Trigger MFA, password reset, new login, invite acceptance, and security revocation. Confirm only the intended controlled contact receives each message. |
| Expected dashboard updates | Open every dashboard after login, role-view switching, refresh, membership revocation, account restriction, and logout. Identity/data must match the current server session every time. |
| Expected database state | Inspect hashed session records, scope, expiry, revocation, MFA/passkey/trusted-device references, and audit events. No raw session, reset, invite, or OTP secret may be stored. |
| Expected admin state | Attempt admin UI/API as customer, vendor, and employee and receive denial. Sign in with the admin-scoped account and confirm approved admin tools work. |
| Expected customer state | Customer A can view only A's Private records/reviews. Change a work-record ID to B's and receive a non-enumerating denial. Public proof remains visible. |
| Expected vendor state | Vendor A loads only A. Change `vendorId` to Vendor B in route/body/query and receive denial with no fallback to another membership. |
| Expected employee state | Accept a controlled invite only after recipient verification, open current assignments, then revoke/reassign and confirm old session/link access stops immediately. |
| Invite wrong-account test | Open Employee A's invite while signed in as B. The page explains the mismatch and does not alter B, A, or the membership. |
| Password reset | Reset a controlled account, then try old sessions in another tab/browser. All old access fails; a fresh login succeeds. |
| Session expiration | Use a controlled short timeout, wait or clock-control it, and confirm protected UI/API deny access consistently with a clear recovery action. |
| Expected Trust Score behavior | Compare Trust Score evidence before/after login, role switch, invite, revocation, and reset. No authentication event changes the score. |
| Expected review behavior | The correct customer retains eligible genuine reviews; another customer cannot access or submit; no auth event creates a review/rating. |
| Expected Epic 1 behavior | Declined/pending/expired/wrong-recipient permission remains recording-locked before and after role/session changes. Allowed permission still requires all unrelated assignment/location gates. |
| Expected audit history | Confirm login/recovery/session revoke/membership change/admin denial events identify actor and action without raw secrets or sensitive request headers. |
| Expected screenshots | Verify the indexed desktop/mobile/loading/success/failure/empty/blocked and before/after images in Section 14. |

## 16. Regression Statement Plan

The Epic 3 Engineering Report will include a `REGRESSION STATEMENT` containing:

### Existing functionality intentionally preserved

- Epic 1 permission states, recording lock, OTP/link evidence, and admin Permission Audit.
- Epic 2 Proof-First public and role shells where copy and hierarchy are already effective.
- Valid user/vendor/customer/employee records and active legitimate memberships.
- Current work records, assignments, location gates, media stages, manager review, Private proof, Public proof, reviews, moderation, and Trust Score inputs.
- MFA, passkeys, and trusted devices, with corrected session binding.

### Existing functionality intentionally unchanged

- Consent policy and scope.
- Publication, withdrawal, retention, deletion, minors, recording behavior, review rules, Trust Score formula, AI behavior, and legal text.
- Public browsing and Public proof filtering except for any confirmed data leak.

### Areas verified unaffected

- Permission creation/decision and recording lock.
- Customer review ownership and no-review neutrality.
- Vendor job management and employee recording gates.
- Admin moderation boundaries.
- Notification content unrelated to account security.

### Potential regression risks reviewed

- Existing browser sessions invalidated at cutover.
- Linked customer/vendor profile navigation after server-role enforcement.
- Admin/general side-by-side browser use.
- Legacy employee/invite records.
- Capture links after assignment or membership changes.
- Recovery/MFA/passkey state during deployment.
- Azure session/database availability and performance.

### Known unrelated issues

Only issues proven unrelated to Epic 3 will be listed. They will not be silently fixed, staged, or described as Epic 3 regressions.

## 17. Business Value

- Prevents one customer, vendor, employee, or admin from seeing or changing another participant's protected data.
- Makes Epic 1 permission evidence attributable to the correct actor.
- Gives vendors confidence that employees lose access when revoked or reassigned.
- Lets the Product Owner compare admin and vendor/customer behavior without session contamination.
- Reduces support incidents caused by wrong-account dashboards, stale tabs, and unclear role switching.
- Creates a defensible security foundation for later recording, publication, withdrawal, moderation, and audit epics.
- Preserves customer trust: Private information remains Private even when the UI is bypassed.

## 18. Technical Debt and Product Owner Decisions

### Technical debt to resolve in Epic 3

| Issue | Impact | Recommended treatment |
|---|---|---|
| Stateless browser sessions | No reliable revocation/logout/reset invalidation | Add hashed server session records and invalidate legacy sessions at cutover. |
| Parallel `Employee` and `VendorMembership` identity structures | Drift and ambiguous employee authority | Make membership canonical; preserve legacy rows for media relations and document staged reconciliation. |
| Raw `VendorInvite` token/code | Database/API secret exposure | Add hash fields, rotate active invites, stop returning raw secrets, deprecate raw fields non-destructively. |
| Local-file login throttle/reset fallback | Not multi-instance/durable | Use DB/shared durable state in production; retain local development adapter only. |
| Client bearer/session storage | XSS and stale-tab impact | Same-origin HttpOnly session cookie; no raw token in session API payload. |
| Inconsistent route guards | IDOR and role drift | Canonical actor/policy helpers plus complete route inventory. |
| Missing security/admin checklist rows | Cannot truthfully close roadmap scope | Product Owner-approved tracker reconciliation before implementation checklist update. |

### Product Owner approval decisions

1. **Supported multi-tab rule:** Approve one general identity per browser profile plus one isolated admin session, as defined in Section 2.
2. **Cutover behavior:** Approve invalidating all existing stateless sessions at deployment and requiring one fresh login. This is safer than dual-running old bearer sessions.
3. **Checklist reconciliation:** Approve restoration/addition of the missing `SEC-*` and `ADM-*` rows before implementation updates the tracker.
4. **Legacy employee records:** Approve preserving legacy `Employee` rows for compatibility while making active `VendorMembership` the authority source; no destructive merge in Epic 3.

No Product Owner decision is required for obvious security boundaries such as rejecting raw compatibility-cookie identity, preventing cross-vendor ID substitution, hashing secrets, or denying revoked memberships.

## 19. Estimated Implementation Sequence

Implementation will proceed in this order after approval:

### Step 1 - Freeze evidence and route inventory

- Record repository, branch, start commit, status, and unrelated worktree changes.
- Create the complete route classification and authorization matrix.
- Add characterization tests for current login, profile switching, admin/general coexistence, employee invites, and Epic 1 gates before behavior changes.

### Step 2 - Add durable session infrastructure

- Add one additive migration for hashed server sessions and required security evidence/invite-hash compatibility fields.
- Implement issue, validate, rotate, revoke, expire, and revoke-all operations.
- Preserve current IDs and data; no account merging.

### Step 3 - Canonical actor and authorization policy

- Build one server actor context from the durable session and current DB state.
- Build customer ownership, exact vendor member/manager, assigned employee, admin, and internal-job policies.
- Standardize safe errors and security audits.

### Step 4 - Login, session, logout, and cross-tab behavior

- Move normal web auth to HttpOnly opaque sessions.
- Remove session tokens and compatibility identity cookies from client authority.
- Implement strict admin/general scope separation.
- Implement account-change/logout synchronization and clear recovery states.

### Step 5 - Recovery, MFA, passkeys, and trusted devices

- Bind all successful methods to the same session service.
- Make password reset revoke sessions/trusted devices.
- Move production rate-limit/reset state off local files.
- Verify fixation, replay, rate-limit, and secret-redaction controls.

### Step 6 - Secure employee invitation and revocation

- Hash/rotate invite secrets and stop manager API disclosure.
- Require intended-recipient verification before account binding or membership activation.
- Make active membership and current assignment canonical.
- End capture/job access immediately after revoke/reassign.

### Step 7 - Protect layouts and APIs

- Apply server guards to role shells.
- Apply canonical policies route by route from the inventory.
- Protect/remove production debug metadata routes.
- Preserve intentional public routes and data filters.

### Step 8 - Focused tests and defect correction

- Run unit, integration, authorization matrix, IDOR, CSRF, session, invite, and Playwright suites.
- Correct only Epic 3 defects and rerun affected regressions.

### Step 9 - Production build and controlled beta validation

- Run type check, build, applicable security checks, and controlled four-role smoke tests.
- Capture desktop/mobile and non-happy-state screenshots.
- Verify no raw secrets in DB/API/log/audit/screenshot evidence.

### Step 10 - Epic records and scoped Git checkpoint

- Complete Engineering Report, four-role UX review, Demo Checklist, Lessons Learned, Technical Debt, Checklist Snapshot, Screenshot Index, Git Checkpoint, and Project Dashboard.
- Update only approved affected checklist rows.
- Commit and push only Epic 3 implementation and required project records.
- Stop for Product Owner demo approval; do not begin Epic 4.

## 20. Approval Gate

No code, migration, deployment, or checklist update begins until the Product Owner approves this plan and explicitly resolves these three planning gates:

1. The supported multi-tab/session rule in Section 2.
2. One-time invalidation of existing stateless sessions at Epic 3 deployment.
3. Restoration or approved addition of the missing roadmap-designated `SEC-*` and `ADM-*` checklist rows.

If implementation reveals that a frozen requirement can be met only by account merging, consent/workflow redesign, broader participant authority, or a second identity architecture, work stops and the conflict is presented to the Product Owner.

After approval, Epic 3 implementation will be the only active epic. Epic 4 and all later work remain out of scope.
