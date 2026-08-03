# Reliance Epic 3 Phase A - Identity Foundation Implementation Plan

**Epic:** Epic 3 - Trusted Accounts and Role Isolation
**Internal engineering phase:** Phase A of two
**Planning status:** Awaiting Product Owner approval
**Implementation status:** Not started
**Repository:** `C:\Users\Cesar Olivera\Project Reliance`
**Branch:** `cursor-latest-build`
**Planning baseline commit:** `43c18f9282d14567ce4c40b1fab32bfb97126817`
**Architecture diagram:** `RELIANCE_EPIC_3_AUTHORIZATION_ARCHITECTURE_DIAGRAM.md`

This plan refines the approved Epic 3 plan into the first of two internal engineering phases. It does not create another roadmap epic and does not change the approved roadmap, frozen documents, application, migrations, deployment, or Beta Readiness Checklist.

## 1. Phase A Objective

Phase A creates one canonical server-side answer to this question:

> May this currently authenticated user perform this exact action on this exact protected resource now?

It establishes the permanent rule:

> The session tells Reliance **who**. The database tells Reliance **what that actor may do**.

Every protected request will rebuild the current actor, account status, ownership, exact-vendor membership, employee assignment, database-backed admin authority, and required domain permission from the database. No cached role or client-supplied identity field may authorize access.

Phase A ends after implementation, focused regression testing, screenshots, engineering records, and Product Owner review. Phase B does not begin automatically.

## 2. Success Definition

Phase A is successful when:

1. A valid signed session supplies only the candidate user identity.
2. The server loads the current active `User` for every protected request.
3. Admin access comes from a current database-backed platform-role grant and an admin-scoped session, not a hard-coded email, phone, cached profile, or general-session fallback.
4. Customer access requires current ownership of the requested customer-scoped resource.
5. Vendor access requires current active membership in the exact vendor derived from the protected resource.
6. Manager actions require the exact membership's current `MANAGER` role.
7. Employee actions require the exact membership's current `EMPLOYEE` role and current assignment.
8. API route/body/query ID substitution cannot expose or mutate another customer's, vendor's, employee's, or admin-only resource.
9. Protected layouts render only after their server boundary verifies current authority; hiding a button is never the security control.
10. Existing Epic 1 recording permission, assignment, release, location, and media-stage gates still run after authorization and cannot be bypassed.
11. Existing valid users, vendor memberships, work records, permission evidence, Private/Public proof, reviews, and Trust Score evidence are unchanged.
12. The Product Owner completes the Phase A demo and approves the foundation before Phase B begins.

## 3. Scope Confirmation

### Included in Phase A

- Session identity boundary: use a cryptographically valid session only to identify a candidate `userId`.
- Canonical actor loader: current user, account status, and credential state from the database.
- Database-backed platform admin grant and strict admin-session isolation.
- Customer ownership policies.
- Exact-vendor member and manager policies with no fallback vendor selection.
- Employee membership and current-assignment policies.
- API authorization inventory and policy enforcement for every active protected endpoint.
- Direct URL protection for customer, vendor, employee, and admin shells.
- IDOR prevention for IDs in routes, queries, headers, and request bodies.
- Current account restriction and inactive/revoked membership enforcement.
- Stable fail-closed errors and consequential authorization audit evidence.
- Removal of protected-request authentication through production compatibility identity cookies.
- Removal of runtime authorization from cached session/browser/URL/cookie role claims.
- Characterization, unit, integration, security, Playwright, build, and regression evidence required for this phase.

### Explicitly deferred to Phase B

- Password-reset redesign and reset-driven global session invalidation.
- Passkey lifecycle changes.
- MFA challenge/lifecycle changes.
- Trusted-device lifecycle changes.
- Employee invite creation or acceptance redesign.
- Hashed invite migration and recipient-verification workflow.
- Durable server-side session records, session-family rotation, and explicit session revocation.
- `Sign out everywhere`.
- Cross-tab logout/account-change synchronization.
- Broad logout UX changes.
- Replacing the current signed bearer/cookie format with an opaque server session.
- Account recovery notification changes beyond fixes strictly required to preserve Phase A authorization.

### Explicitly outside Epic 3

- Recording-consent policy or Epic 1 decision logic.
- Recording-subject assessment, location selection, location verification, capture, upload, manager review, publication, withdrawal, disputes, retention, deletion, minors, reviews, Trust Score, AI, or legal-policy redesign.
- Account merging.
- New participant authority not present in frozen documents.
- Epic 4 or any later roadmap work.

## 4. Phase Boundary and Risk Isolation

Phase A deliberately does not combine authorization-policy changes with identity-lifecycle changes.

### What Phase A may trust temporarily

The existing signed session cookie or signed bearer may identify a candidate `userId` while Phase B is pending. Phase A may preserve both temporarily for compatibility, but:

- signature and expiry must be valid;
- unsigned production identity cookies are rejected;
- development headers/fallbacks remain development-only;
- role/profile/vendor/customer/admin claims are ignored for authority;
- the current database actor and resource relationships are loaded for every protected request.

### Known residual risk after Phase A

Until Phase B, existing stateless signed sessions cannot be individually revoked before expiry and current cross-tab lifecycle behavior remains. Phase A will prevent a stale session role from granting authority because database status, membership, ownership, assignment, and admin grant are rebuilt. Phase B remains required to complete revocation, recovery, invite, and tab-lifecycle guarantees.

This residual risk must be recorded in Phase A Technical Debt and may not be presented as completed Epic 3 functionality.

## 5. Checklist Items Included

Phase A provides evidence for the authorization portions of the roadmap-assigned security/admin rows and the currently visible tracker rows:

| Roadmap/checklist area | Phase A evidence |
|---|---|
| `SEC-01` | Canonical authenticated actor; production compatibility identity sources rejected. |
| `SEC-02` | Database-derived authorization, ownership, membership, and role isolation. |
| `SEC-03` | Protected API/direct-route enforcement and IDOR prevention. |
| Relevant `SEC-06` | Fail-closed account status, revoked membership, and denied security events. |
| Relevant `SEC-09` | Protected response minimization and no secret/foreign-tenant disclosure. |
| `ADM-02` through `ADM-04` role portions | Database-backed admin authority and admin/general isolation for protected requests. |
| `PROD-03` | Role navigation reflects current server-authorized capabilities and cannot grant authority. |
| `TEST-01`, `TEST-02`, `TEST-03` | Unit, integration, and Playwright authorization evidence. |
| `TEST-11` | Epic 1, Epic 2, review, proof, and Trust Score regression evidence. |
| `TEST-14` | Direct URL, IDOR, role, membership, ownership, admin isolation, and secret exposure tests. |
| `SHOT-05`, `SHOT-07` | Responsive and non-happy protected-access states. |
| Related `DOC-*` | Phase A engineering report, UX review, demo, screenshots, technical debt, lessons, and checkpoint. |

The master checklist currently lacks the roadmap-referenced `SEC-*` and `ADM-*` rows. No checklist edits occur during planning. Product Owner-approved tracker reconciliation remains required before Phase A records checklist completion.

## 6. Governing Documents and Dependencies

### Governing documents

- `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`
- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `docs/legal-consent-audit/RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`
- `RELIANCE_EPIC_3_TRUSTED_ACCOUNTS_AND_ROLE_ISOLATION_IMPLEMENTATION_PLAN.md`
- `RELIANCE_EPIC_3_AUTHORIZATION_ARCHITECTURE_DIAGRAM.md`

No frozen document will be changed.

### Verified implementation dependencies

- Signed session verification in `src/lib/auth-session.ts`.
- Current user/account state in Prisma `User`.
- Vendor authority in `VendorMembership`.
- Current work-record ownership in `Booking.userId` and related customer resolution.
- Current employee assignment metadata and membership IDs.
- Existing admin route helper and path-scoped cookies.
- Epic 1 canonical recording permission gate.
- Existing customer, vendor, employee, admin, consent, media, review, and Public route families.
- Existing focused auth, membership, invite, media-permission, review-sidecar, and route smoke tests.

### Operational dependencies

- Azure SQL additive migration support.
- Controlled customer, vendor-manager, employee, admin, and second-tenant fixtures.
- A beta-like environment for direct API and role-route tests.
- No dependency on Telnyx handset delivery for Phase A.

## 7. Current Repository Findings Driving Phase A

### Identity and cached authority

- `src/lib/auth.ts` accepts multiple identity sources, including production compatibility user/vendor cookies.
- Signed session claims include `userType` and `availableProfiles`; current code sometimes uses them to decide access.
- `src/contexts/AuthContext.tsx`, `src/lib/client-session.ts`, and `src/hooks/useAvailableRoles.ts` retain client identity/role state.
- `useAvailableRoles` adds the current UI role even if current server roles do not include it.
- `ProfileToggle` may navigate after the toggle API fails.

Phase A will ensure these values are display/navigation hints only. No protected server action may authorize from them.

### Admin authority

- Admin authority currently depends on hard-coded owner identity helpers in `src/lib/internal-identities.ts` and session claims.
- `getAdminAuthSessionClaimsFromRequest` can fall back from admin-scoped cookies to the general session.
- Prisma has no database-backed platform-admin grant associated with `User`.

Phase A must add a database-backed admin grant and remove general-session fallback for protected admin access. Hard-coded owner constants may be used only as a one-time migration/bootstrap input, not as runtime authorization.

### Vendor and employee authority

- `requireVendorManager` and `requireVendorMembership` provide a useful base.
- `vendor-context` may silently fall back to a different membership when a preferred vendor is not authorized.
- Some vendor APIs use `getVendorIdFromRequest`, which inherits compatibility-cookie and context-fallback risk.
- Employee work APIs recheck membership and assignment in several places, but this is not yet one reusable policy.
- Legacy `Employee` rows and current `VendorMembership` authority coexist.

Phase A makes current active `VendorMembership` canonical for authority, preserves legacy rows for compatibility, and requires exact resource/vendor matching.

### Protected routes and IDOR

- `middleware.ts` enforces only the beta gate.
- Admin has a server layout guard; customer and vendor shells rely substantially on client state and follow-up APIs.
- Protected API routes use several different guard combinations.
- `src/app/api/admin/db-status/route.ts` currently exposes environment/database metadata without an admin guard.
- IDs such as `userId`, `vendorId`, `bookingId`, `membershipId`, `reviewId`, `mediaSessionId`, and `assetId` appear across protected route/body/query surfaces.

Phase A requires a complete route inventory and resource-first authorization for each protected endpoint.

## 8. Target Phase A Architecture

### Canonical actor

Introduce one request-scoped function conceptually equivalent to:

`resolveRequestActor(request, requiredScope)`

It will:

1. Validate an approved signed session source.
2. extract only the candidate `userId` and session metadata needed for authentication;
3. load the current `User` and credential/account state from the database;
4. reject missing, inactive, suspended, or otherwise restricted actors according to current approved account-status rules;
5. load a database admin grant only when admin scope is required;
6. return no cached role, vendor, ownership, assignment, or permission as authority.

The actor may expose current capability summaries to server-rendered UI, but action policies still reload the exact resource relationships needed for the request.

### Authorization policies

Create focused policy helpers rather than one large role switch:

- `requireCustomerResourceOwner`.
- `requireExactVendorMembership`.
- `requireExactVendorManager`.
- `requireAssignedEmployee`.
- `requirePlatformAdmin`.
- `requireInternalJobCapability` where active internal routes require it.

Each helper receives the canonical actor and a server-loaded resource or its derived owner/vendor/assignment. It does not accept a client role as proof.

### Resource-first authorization

For ID-addressed protected operations:

1. Load the minimum resource row.
2. Derive customer owner, vendor, membership, assignment, and status.
3. Load current authority from the database.
4. Apply the action policy.
5. Only then load or mutate protected details.

### Domain gates remain separate

Authorization answers whether the actor may attempt the action. Existing domain gates still answer whether the action is currently allowed:

- Epic 1 recording permission.
- Employee assignment/release.
- Location verification.
- Work-record status/stage.
- Review eligibility.
- Private/Public visibility.

Authentication or role never implies domain permission.

## 9. Database Migration Expected

### One additive Phase A migration

Add a database-backed platform-role grant, recommended as a normalized table rather than a cached `userType` field:

`PlatformRoleGrant`

Expected fields:

- `id`;
- `userId`;
- `role` (`ADMIN` initially);
- `status` (`ACTIVE`, `REVOKED`);
- `grantedAt`, `grantedByUserId`;
- `revokedAt`, `revokedByUserId`;
- `reason` or audit reference where current conventions support it;
- created/updated timestamps;
- unique active role constraint appropriate for Azure SQL/Prisma compatibility;
- indexes on user, role, and status.

### Backfill

- Backfill the current approved owner-admin user ID as one active `ADMIN` grant.
- Verify the exact beta admin user before applying the migration.
- Do not grant admin by email/phone at runtime.
- Do not convert customer/vendor memberships into admin grants.

### Not included in this migration

- No `AuthSession` model yet; durable session lifecycle belongs to Phase B.
- No invite hash/acceptance migration; invite lifecycle belongs to Phase B.
- No account merge.
- No changes to consent, booking, media, review, Trust Score, publication, retention, or deletion data.

### Rollback

- Application rollback must remain compatible with the additive table.
- The migration rollback plan removes no user or business data.
- Runtime admin authorization will switch only after backfill verification and focused admin tests pass.
- If the grant cannot be verified, admin access remains blocked and the deployment does not proceed.

## 10. Expected Files Affected

The exact list follows the protected-route inventory. Estimated Phase A impact: 20-35 application/test files plus one additive migration and Phase A project records.

### Session and actor boundary

- `src/lib/auth-session.ts`
- `src/lib/auth.ts`
- New request-actor helper under `src/lib/auth/` or the established shared-library structure
- `src/lib/account-status.ts`
- Characterization tests for signed cookie/bearer identity and rejected compatibility identity

Phase A will not redesign login response, password reset, MFA, passkeys, trusted devices, logout everywhere, or cross-tab lifecycle.

### Authorization helpers

- `src/lib/admin-auth.ts`
- `src/lib/vendor-context.ts`
- `src/lib/membership-auth.ts`
- New customer ownership and assigned-employee policy helpers if no safe existing helper fits
- Shared error/audit helpers where required

### Layouts and server route boundaries

- `src/app/admin/layout.tsx`
- `src/app/vendor/layout.tsx` or a new server wrapper preserving the current client shell
- `src/app/(user)/layout.tsx` or a new server wrapper preserving intentionally public routes
- Employee job/recording entry surfaces that currently lack a dedicated server boundary
- Access-required, wrong-role, restricted, and denied components only where current states are misleading

### APIs

- `src/app/admin/session/route.ts` for strict admin-scope/database-grant checks, without Phase B session redesign
- `src/app/api/auth/session/route.ts` only if needed to ensure returned role summaries are database-current and non-authoritative
- `src/app/api/profile/toggle/route.ts`
- `src/app/api/admin/**` protected routes, including `admin/db-status`
- `src/app/api/customer/**` protected routes
- `src/app/api/vendor/**` and `src/app/api/vendors/[vendorId]/**` protected routes
- `src/app/api/employee/**` protected routes
- Protected consent, media, booking/work-record, review, favorite, profile, and device endpoints found by the inventory
- Public endpoints only if the audit proves they expose protected fields

### Database

- `prisma/schema.prisma`
- One new additive migration under `prisma/migrations/`
- Migration verification evidence in the Engineering Report

### UI

- `src/hooks/useAvailableRoles.ts`
- `src/components/ProfileToggle.tsx`
- Role shell loading/denial states affected by server-authorized capabilities

Client UI may display current authorized capabilities but cannot provide authority.

### Tests

- Existing `auth-session`, `admin-auth`, admin session, auth session, membership, employee, review-sidecar, media permission, and auth redirect tests
- New actor/policy unit tests
- New authorization-matrix and IDOR integration tests
- New direct-route and role-isolation Playwright tests
- Epic 1 and Epic 2 focused regression tests

### Documentation

- Phase A-specific sections in the Epic 3 Engineering Report, UX Review, Product Owner Demo, Lessons Learned, Technical Debt, Checklist Snapshot, Git Checkpoint, screenshot index, and Project Dashboard
- The full Epic 3 plan remains open after Phase A; Epic 3 is not marked Completed

## 11. API Protection Inventory Plan

Before route edits, create a working inventory of every active API route with these fields:

- route and methods;
- public/protected/internal classification;
- canonical actor scope;
- required ownership;
- required vendor membership and role;
- required employee assignment;
- required admin grant;
- required domain permission gate;
- consequential audit event;
- expected `401`, `403`, scoped `404`, `409`, `423`, or `429` result;
- Phase A change required;
- test ID.

### Required route-family outcomes

| Family | Phase A outcome |
|---|---|
| Auth challenge/login routes | Preserve behavior; ensure they do not grant authority from submitted role. |
| General/admin session introspection | Rebuild capability summaries from DB; admin requires admin-scoped cookie plus active DB grant. |
| Customer APIs | Current actor owns requested record or receives scoped denial. |
| Vendor APIs | Exact active membership; manager actions require exact current manager role. |
| Employee APIs | Exact active employee membership plus current assignment; existing gates preserved. |
| Admin APIs | Active database admin grant and admin scope on every protected route. |
| Consent/media/review/work-record APIs | Current actor policy first, then existing domain gate. |
| Public APIs | Remain public but return only active/Public fields. |
| Internal/dev APIs | Narrow internal authentication; production seed/reset/debug routes denied. |

## 12. IDOR Protection Plan

Every protected identifier receives a positive and negative test. At minimum:

- customer/user IDs;
- vendor IDs;
- booking/work-record IDs;
- service IDs;
- membership/employee IDs;
- assignment IDs;
- review IDs;
- media-session and media-asset IDs;
- device/assignment IDs;
- permission/consent IDs where Epic 1 permits authenticated access;
- admin audit/report/account IDs.

Required response behavior:

- `401` when no valid session identifies the actor.
- `423` or current approved restricted-state code when the actor/account cannot act.
- `403` for an explicit known role boundary where revealing the resource is not sensitive.
- scoped `404` when existence would reveal another customer/tenant resource.
- `409` when authority exists but current resource/workflow state conflicts.

No response may contain another tenant's name, contact, vendor, work-record title, media metadata, or audit details merely to explain denial.

## 13. Admin Isolation Plan

1. Add and backfill the database admin grant.
2. Resolve admin actor only from the admin-scoped signed session.
3. Remove fallback from admin session/API resolution to the general session.
4. Ignore `availableProfiles`, `userType`, email, phone, URL, and client role as admin authority.
5. Require current active DB grant on every protected admin request.
6. Keep admin authority separate from participant authority; admin cannot silently act as customer/vendor/employee.
7. Protect metadata/debug/admin operations consistently.
8. Audit consequential admin access/mutations and denied privilege attempts without secrets.

Phase A supports an admin tab and a general customer/vendor tab because the existing cookies are path-scoped, but Phase B remains responsible for cross-tab lifecycle synchronization and durable revocation.

## 14. Vendor and Employee Membership Plan

### Vendor

- Derive vendor from the protected resource or explicit current context.
- Require an active exact-vendor membership.
- Never fall back from an unauthorized requested vendor to another membership.
- Require `MANAGER` for profile, service, team, assignment, and other manager-only mutations.
- Treat pending, denied, revoked, malformed, or uncertain membership as no authority.

### Employee

- Use active `VendorMembership(role=EMPLOYEE)` as the authority source.
- Preserve legacy `Employee` rows only for current relational compatibility; do not treat them as account authority.
- Require current assignment for job/capture operations.
- Preserve Epic 1 permission, manager release, location, and stage gates.
- Reassignment/revocation policy is enforced from current DB state on the next protected request.
- Capture-token lifecycle redesign and invite acceptance remain Phase B, but a token cannot override current membership or assignment in Phase A.

## 15. Error and UX Plan

The Language Guide error order applies:

1. What happened.
2. Why the request cannot continue, without exposing protected details.
3. What the person can do next.
4. What remains protected where reassurance is useful.

Required states:

- Sign in required.
- Customer account required.
- Vendor membership required.
- Vendor manager required.
- Employee assignment required.
- Admin access required.
- Account restricted.
- Membership revoked/inactive.
- Protected record unavailable.
- Authorization could not be verified; retry safely.

The UI must not render another role's sidebar or protected fields before replacing the page with a denial. Loading states say Reliance is checking access, not that access is already granted.

## 16. Security and Privacy Considerations

- No production authentication from `userId`, `vendorId`, role, or profile compatibility cookies.
- No authorization from signed session role/profile claims.
- No raw session, permission, reset, OTP, invite, passkey, or capture secrets in API payloads added by Phase A, logs, audit metadata, screenshots, or documentation.
- Protected database reads happen only after actor/resource policy or use a minimal resource lookup that exposes nothing to the response before authorization.
- Authorization infrastructure failures fail closed.
- Public endpoints remain intentionally public but minimize fields and filter current Public/active state.
- Consequential denials and privilege changes use immutable audit evidence where the existing audit system supports it.
- No security artifact will include real customer data; tests use controlled synthetic fixtures.

## 17. Backward Compatibility

### Preserved

- Current credentials and valid signed sessions continue identifying the same user during Phase A.
- Existing customers, vendors, memberships, assignments, work records, media, permissions, reviews, and Trust Score evidence remain intact.
- Current MFA, passkeys, trusted devices, password reset, invite acceptance, logout, and cross-tab behavior remain unchanged except if a critical Phase A authorization hole cannot be fixed without narrowing access.
- Linked customer/vendor navigation remains available for the same user when current database membership supports it.
- Public routes and Public proof remain accessible.

### Intentional narrowing

- Unsigned/non-HttpOnly compatibility identity cookies no longer authenticate protected requests.
- Stale cached roles no longer authorize.
- Unauthorized direct routes/APIs that previously loaded a shell or metadata now deny access.
- Preferred vendor context no longer silently falls back to another vendor.
- Admin general-session fallback ends.

### Data compatibility

- Hard-coded owner identity remains only as migration bootstrap evidence, then runtime admin authority comes from DB.
- Legacy employee rows remain; no destructive cleanup in Phase A.
- Existing invites remain untouched in Phase A and are explicitly deferred to Phase B.

## 18. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Wide API surface creates missed route | Complete route inventory before edits; every protected route receives classification and test ID. |
| Existing client depends on bearer/user ID headers | Characterization tests; preserve signed bearer as temporary identity only; remove compatibility authority incrementally. |
| Admin is locked out during DB-grant cutover | Backfill and verify grant before runtime switch; fail deployment if verification fails. |
| Linked vendor/customer account loses valid navigation | Build capability summary from current DB; preserve role view while separating it from authorization. |
| Route returns 403 where UI expects 200 | Add stable typed denial handling and focused role-page tests before broad rollout. |
| Performance from DB rebuild per request | Query only current facts required by the action; request-local memoization only; add indexes and measure representative routes. |
| Current authorization helper has hidden fallback | Replace route family by family with tests; no global blind search/replace. |
| Phase A accidentally enters Phase B | Explicit file/scope review before commit; lifecycle files changed only when essential to Phase A identity boundary and documented. |
| Epic 1 recording gate bypass | Canonical order: actor policy first, existing permission gate second; run declined/pending/allowed regression matrix. |

## 19. Rollback Strategy

- One scoped Phase A application commit separate from Phase B.
- One additive admin-grant migration with no destructive data changes.
- Application rollback may leave the unused additive table safely in place.
- Keep old runtime authorization code available only until the new actor/policy tests pass; do not dual-authorize by accepting either result.
- If production/beta validation shows incorrect denial, roll back application package rather than broadening access.
- If authority cannot be verified, protect data and record a blocked state; never use cached roles as fallback.
- Do not roll back by restoring unauthenticated admin metadata, cross-vendor fallback, or compatibility-cookie authority.

## 20. Test Plan

### Characterization tests before edits

- Existing customer, vendor, employee, and admin sign-in/session introspection.
- Current linked customer/vendor role display.
- Existing admin scoped-cookie behavior.
- Existing membership manager/member checks.
- Epic 1 recording permission and media-session enforcement.

### Unit tests

- Canonical actor accepts valid signed identity and reloads current user.
- Canonical actor rejects missing, expired, unsigned, compatibility-cookie-only, and restricted identity.
- Session role/profile claims do not alter DB-derived capabilities.
- Database admin grant active/revoked/missing behavior.
- Exact vendor membership with active/pending/denied/revoked and manager/employee roles.
- Customer ownership and scoped denial.
- Current employee assignment and reassignment denial.
- Vendor context never falls back.
- Stable error and audit redaction.

### Integration authorization matrix

Each representative route runs as:

- anonymous;
- correct customer;
- wrong customer;
- correct vendor manager;
- other-vendor manager;
- active assigned employee;
- active unassigned employee;
- revoked employee;
- admin with DB grant;
- signed admin identity with revoked/missing DB grant;
- restricted account.

### Required IDOR tests

- Customer A substitutes Customer B's work-record/profile/review IDs.
- Vendor A substitutes Vendor B's route/body/query IDs.
- Employee A substitutes another employee's assignment/work/media IDs.
- Customer/vendor/employee call admin metadata and mutation routes.
- Public callers request Private media/service-record identifiers.
- Manager-only mutation attempted by employee.

### Direct URL and UI tests

- Wrong role opens customer/vendor/employee/admin URL directly.
- Refresh on each protected shell.
- Back/forward navigation after denial.
- Mobile protected-route denial and loading.
- No unauthorized sidebar/data flashes before denial.

### Regression tests

- Epic 1 pending, declined, expired, wrong-recipient, superseded, no-channel, and allowed states.
- Media-session creation remains locked/unlocked only by canonical permission plus unrelated gates.
- Customer review ownership, duplicate protection, moderation, and no-review neutrality.
- Trust Score unchanged by auth/role/denial events.
- Public/Private proof filtering.
- Epic 2 route smoke and proof-first navigation.

### Quality commands expected

- Focused Vitest actor/admin/membership/ownership/API suites.
- Focused Epic 1, review, Trust Score, employee, vendor, media, and route regressions.
- Full `npm test` if feasible.
- `npx tsc --noEmit --pretty false --incremental false`.
- `npm run build`.
- Focused Playwright direct-route/role/IDOR journeys and applicable full smoke suite.
- Approved dependency/security scan available in the environment.

Only executed commands and actual results will appear in the Engineering Report. The current repository has no lint script, so no lint success will be claimed unless an approved lint command exists at implementation time.

## 21. Screenshot Plan

Use synthetic controlled accounts and redact contact information.

### Desktop

- Correct customer dashboard identity.
- Correct vendor manager and exact vendor identity.
- Correct employee assignment identity.
- Correct database-granted admin identity.
- Customer direct vendor/admin denial.
- Vendor direct admin/other-vendor denial.
- Employee unassigned/revoked denial.
- Scoped not-found response without foreign resource details.
- Authorization verification loading and infrastructure-failure blocked state.

### Mobile

- Correct role dashboard header for all four roles.
- Sign-in required.
- Wrong role.
- Membership required/revoked.
- Assignment required.
- Admin access required.
- Protected record unavailable.

### Before/after

- Client-rendered wrong-role shell versus server-authorized blocked state.
- Vendor fallback/confusion versus exact-vendor denial.
- General-session admin fallback versus admin-scoped DB-grant denial.

## 22. Product Owner Demo Checklist

| Validate | Product Owner action and expected result |
|---|---|
| Customer ownership | Sign in as Customer A, open A's record, then substitute Customer B's ID. A opens; B returns protected not-found without B's details. |
| Vendor exact membership | Sign in as Vendor A manager and open A. Substitute Vendor B in route/API. Reliance denies and does not fall back to A or reveal B. |
| Manager boundary | As Vendor A employee, attempt manager profile/service/team/job mutations. Every mutation is denied while assigned employee work remains available. |
| Employee assignment | Open an assigned work record, then an unassigned record. Only assigned minimum data is available; existing permission/location/stage gates remain. |
| Revoked membership state | Use a controlled revoked membership fixture. Protected vendor/employee APIs deny from current DB state even if the session still contains an old role claim. |
| Admin isolation | Open admin with active DB grant. Remove/revoke the controlled grant and retry. Admin APIs deny even if session claims or UI still say Admin. Restore through controlled admin migration/fixture procedure. |
| General session cannot become admin | Sign in as vendor/customer and navigate directly to admin pages/APIs. No admin shell/data appears. |
| Cached role ignored | Modify controlled client/session role metadata in a test fixture while DB authority remains unchanged. Server result follows DB, not metadata. |
| Compatibility identity denied | Send a protected request with only `userId`/vendor compatibility cookies. It receives `401`. |
| Direct URL | Open protected customer/vendor/employee/admin URLs while anonymous or wrong role. Each shows the correct access state and no protected-data flash. |
| Epic 1 regression | Verify declined/pending/wrong-recipient remain recording-locked; allowed still requires assignment/release/location. |
| Review/Trust regression | Confirm authorization tests create no review/rating/Trust Score input and valid customer review access remains owner-only. |
| Database evidence | Confirm active admin grant, current membership/ownership facts, and consequential denial audit entries contain no raw secrets. |
| Screenshots | Review the indexed desktop/mobile/loading/failure/blocked and before/after package. |

### Expected participant states

- **Customer:** sees only own protected records plus Public content.
- **Vendor:** sees only exact active memberships and manager-authorized actions.
- **Employee:** sees only current assigned work and approved minimum context.
- **Admin:** sees admin tools only with active database grant and admin scope; never becomes a participant.
- **Trust Score:** unchanged.
- **Reviews:** no synthetic or cross-owner activity.
- **Audit:** consequential authorization evidence without raw secrets.

## 23. Phase A Deliverables

1. Implemented canonical actor and authorization foundation.
2. Complete protected-route authorization inventory.
3. One additive database-admin grant migration and verification evidence.
4. Unit, integration, security, Playwright, type-check, build, and focused regression results actually run.
5. Desktop/mobile screenshot package and index.
6. Four-role UX review focused on protected-access clarity.
7. Phase A Engineering Report with security/API/database/backward-compatibility/rollback impact.
8. Full `REGRESSION STATEMENT` distinguishing Phase A from unchanged behavior.
9. Product Owner Demo result.
10. Lessons Learned and Technical Debt, including remaining Phase B risks.
11. Checklist Snapshot and Project Dashboard showing Epic 3 Phase A awaiting Product Owner review, not Epic 3 Completed.
12. Scoped Phase A Git checkpoint separate from Phase B.

## 24. Regression Statement Plan

The report will explicitly state:

### Intentionally preserved

- Current credentials and identity records.
- Epic 1 permission and recording gates.
- Epic 2 proof-first shells and effective language.
- Valid work records, assignments, media, Private/Public state, reviews, and Trust Score evidence.
- Existing password reset, passkey, MFA, trusted-device, invite, logout, and cross-tab lifecycle pending Phase B.

### Intentionally changed

- Protected authorization becomes database-current on every request.
- Runtime admin authority becomes database-backed.
- General session cannot authorize admin.
- Compatibility identity cookies and cached roles cannot authorize.
- Exact vendor/resource ownership is required; silent fallback ends.
- Unauthorized metadata/direct-route exposure is closed.

### Verified unaffected

- Permission events create no review/rating/Trust Score/Public proof.
- Public content remains public and Private content remains restricted.
- Recording remains governed by all current non-auth gates.

### Known unrelated issues

Only proven unrelated issues will be listed; none will be silently fixed or staged.

## 25. Estimated Implementation Sequence

### Step 1 - Pre-change checkpoint

- Confirm repository, branch, commit, writable status, no index lock, staged files, and unrelated worktree changes.
- Preserve unrelated files untouched.

### Step 2 - Route and current-behavior inventory

- Classify every active API and protected page.
- Assign policy and test IDs.
- Add characterization tests before behavioral edits.

### Step 3 - Database admin authority

- Add the platform-role grant migration.
- Backfill and verify the exact beta owner-admin user.
- Add migration rollback/compatibility evidence.

### Step 4 - Canonical actor

- Implement request-scoped current-user resolution.
- Reject production compatibility identity sources.
- Ignore session/client role claims for authority.
- Add focused unit/integration tests.

### Step 5 - Authorization policies

- Implement customer ownership, exact vendor member/manager, assigned employee, platform admin, account status, and safe-error policies.
- Add policy matrix tests.

### Step 6 - Admin isolation

- Require admin-scoped signed session plus active DB grant.
- Remove general-session and hard-coded runtime grant fallback.
- Protect metadata/debug admin routes.
- Run admin/customer/vendor/employee denial matrix.

### Step 7 - Apply route-family protection

- Customer routes and pages.
- Vendor routes and pages.
- Employee routes and pages.
- Admin routes and pages.
- Consent/media/review/work-record protected routes.
- Confirm intentional public/internal routes.

Each family is tested before moving to the next; no blanket mechanical rewrite.

### Step 8 - UI alignment

- Derive displayed capabilities from current server results.
- Remove navigation-on-failed-role-switch behavior.
- Add clear loading/access/restricted/not-found states without redesigning the shells.

### Step 9 - Regression and security validation

- Run IDOR, direct URL, role matrix, Epic 1, Epic 2, review, Trust Score, proof, employee, and media tests.
- Run type check, build, and Playwright.
- Inspect API/log/audit output for protected data and raw secrets.

### Step 10 - Documentation, screenshots, and checkpoint

- Complete Phase A project records and screenshots.
- Update approved checklist rows only after tracker reconciliation.
- Create one scoped Phase A commit and push after gates pass.
- Mark Epic 3 as `Phase A awaiting Product Owner review`, not Completed.

### Step 11 - Hard stop

- Present Product Owner Demo.
- Record pass/fail and defects.
- Do not plan or implement Phase B corrections beyond Phase A defects until the Product Owner approves Phase A.

## 26. Approval and Stop Gate

No implementation begins until the Product Owner approves:

1. This Phase A plan.
2. The accompanying authorization architecture diagram.
3. The additive database-backed admin grant and one-time owner-admin backfill.
4. The rule that Phase A temporarily preserves current signed session formats only as identity evidence, while ignoring their role/profile claims for authority.
5. The deferral of password reset, passkeys, MFA, trusted devices, invite acceptance, durable revocation, logout everywhere, and cross-tab synchronization to Phase B.
6. The treatment of missing `SEC-*`/`ADM-*` checklist rows before implementation updates the tracker.

After Phase A is implemented and validated, work stops for Product Owner review. Phase B does not begin without a separate approval.
