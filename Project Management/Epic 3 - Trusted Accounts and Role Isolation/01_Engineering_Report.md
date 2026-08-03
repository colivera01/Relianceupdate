# Epic 3 Phase A Engineering Report

**Epic:** Trusted Accounts and Role Isolation
**Phase:** A - Identity Foundation
**Status:** Implemented and validated locally; deployment blocked by unrelated build defects
**Branch:** `cursor-latest-build`
**Starting commit:** `43c18f9282d14567ce4c40b1fab32bfb97126817`
**Report date:** 2026-08-02
**Owner:** Codex / Product Owner

## Objective

Make the signed session evidence of who made a request while rebuilding current authority from the database for every protected request. Phase A covers current account status, customer ownership, exact vendor membership, manager authority, employee membership/assignment, database-backed administrator authority, direct-route protection, and IDOR resistance.

## Scope Delivered

- Added a canonical database actor resolver and fail-closed authorization errors.
- Added server role boundaries for customer and vendor route trees.
- Rebuilt vendor and employee authority from active `VendorMembership` records.
- Added database-backed administrator grants with strict admin-scoped session separation.
- Removed runtime authorization dependence on email, phone, browser role, URL role, request role, `availableProfiles`, and general-session fallback for admin.
- Tightened affected customer-owned, vendor-member, vendor-manager, employee, and admin APIs.
- Preserved legacy employee records for compatibility; they are not the authority source.
- Inventoried protected routes and added characterization, unit, integration, and browser coverage.
- Did not enter Phase B.

## Files Changed

| Area | Representative files | Change |
|---|---|---|
| Canonical actor | `src/lib/request-actor.ts`, `src/lib/membership-auth.ts`, `src/lib/vendor-context.ts` | Database actor, exact membership, ownership, and role policies |
| Sessions/login | `src/lib/auth-session.ts`, `src/lib/auth-login-user.ts`, `src/app/api/auth/login/route.ts` | Candidate identity retained; capability summaries rebuilt from current DB state |
| Admin | `src/lib/admin-auth.ts`, `src/lib/admin-client.ts`, `src/app/admin/session/route.ts`, selected admin APIs | Admin-scoped signed session plus active DB grant required |
| Route boundaries | `src/components/auth/*`, customer/vendor route layouts | Direct URL access fails closed before protected content renders |
| APIs | Selected bookings, customer profile, services, favorites, reports, vendor profile/context/session, device routes | Current actor, ownership, membership, and minimum-data checks |
| Tests | `src/lib/request-actor.test.ts`, Phase A characterization tests, affected integration tests, `e2e/epic3-phase-a-role-isolation.spec.ts` | Positive, negative, IDOR, wrong-role, and mobile coverage |
| Evidence | This Epic 3 folder | Inventory, plan, screenshots, UX review, demo, debt, and checkpoint |

The complete file list is recorded by the Phase A Git checkpoint.

## Migrations

| Migration | Purpose | Data treatment | Rollback |
|---|---|---|---|
| `20260802193000_add_platform_role_grants` | Add current database authority for platform roles | Additive table, indexes, foreign keys, and one verified beta admin grant | Revoke the grant first; drop only the new table if application rollback is required |

The exact approved admin user was verified by a unique active database lookup before migration. No credentials are recorded here. All 35 repository migrations are applied and Prisma reports the schema is current.

## Security Impact

- Protected authorization now derives from the current `User`, account status, `VendorMembership`, resource ownership/assignment, and `PlatformRoleGrant` records.
- General sessions cannot authorize admin routes or APIs.
- Compatibility role/profile cookies and client-supplied role/vendor fields do not grant authority.
- Suspended users, inactive memberships, wrong vendors, wrong customers, and employee attempts at manager actions fail closed.
- Responses avoid returning broader account data merely to explain a denial.
- No raw permission token, OTP, private key, password, or connection string was added to code, responses, screenshots, or audit metadata.

## API Impact

Affected protected endpoints now return `401` for missing/invalid candidate identity, `403` for insufficient current authority, and `404` where resource-first lookup must avoid cross-tenant disclosure. Public APIs remain public. No consent, review, Trust Score, publication, or media contract was redesigned.

## Database Impact

`PlatformRoleGrant` is additive and records role, status, grant/revocation times, grantor, and reason. Existing users, vendors, memberships, employees, work records, consent evidence, media, reviews, Trust Score records, and publication records were not migrated or rewritten.

## Notification Impact

None. Phase A does not add, remove, or change notification triggers or templates.

## AI Impact

None. AI gained no identity, authorization, or decision authority.

## Dashboard Impact

Customer, vendor, employee, and admin shells now render only after their server boundary confirms current authority. Existing dashboard content, metrics, work states, and actions remain unchanged.

## Legal Impact

No frozen document, policy, agreement, consent language, or legal acceptance workflow was changed.

## Backward Compatibility

Cryptographically signed session formats remain candidate identity evidence. Existing active vendor memberships continue to work. Legacy employee rows remain intact. Vendor onboarding remains available only through its explicit profile boundary. Durable session records, revocation, logout everywhere, cross-tab synchronization, password reset, passkeys, MFA, trusted devices, and invite redesign remain Phase B.

## Rollback Considerations

Rollback the application to the starting commit while leaving the additive table in place, or revoke grants before dropping the table. A rollback must restore the prior admin bootstrap path in the same deployment; otherwise admin access intentionally fails closed.

## Testing

| Command / validation | Result | Notes |
|---|---|---|
| Focused latest auth/security suite | Pass: 42/42 | Eight files |
| Broad Phase A suite | Pass: 109/109 | Seventeen files |
| Epic 1, review, and Trust Score regression | Pass: 97/97 | Twenty files; no side effects |
| Vendor context focused suite | Pass: 4/4 | Exact membership behavior |
| Phase A Playwright | Pass: 5/5 | Desktop/mobile, four role conditions |
| `npx tsc --noEmit --pretty false --incremental false` | Pass | Clean type check |
| `npx prisma migrate status` | Pass | 35 migrations; schema current |
| Full `npm test -- --run` | Partial: 12 known unrelated failures | Phase A-focused suites pass; failures cataloged below |
| `npm run build` with 6 GB heap | Blocked after compile/type/lint | Legacy `pages/support` and `pages/notifications` lack default React component exports; neither was changed by Phase A |
| `npm audit --omit=dev --audit-level=high` | Blocked by existing advisories | 25 advisories: 1 critical, 16 high, 7 moderate, 1 low; dependency remediation is outside Phase A |
| `git diff --check` | Pass | No whitespace errors |

## Screenshot Package

See `08_Screenshots/SCREENSHOT_INDEX.md`. Controlled synthetic data only; no credentials or private customer media.

## Known Limitations

- Phase B identity lifecycle remains intentionally unimplemented.
- Full deployment validation cannot start until the unrelated production-build blocker is approved for repair.
- Repository dependency advisories require a separately approved upgrade plan and regression cycle.
- Full suite has 12 known unrelated failures in stale copy/fixture and non-Phase-A workflow tests.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

- Epic 1 permission decisions and recording gates: 97/97 cross-epic tests passed.
- Genuine reviews and neutral no-review Trust Score behavior: focused regression passed.
- Existing vendor-manager access: authorized Playwright manager reached the current dashboard.
- Existing customer access and public/private media filtering: focused regression passed.

### Existing functionality intentionally unchanged

- Login lifecycle, password reset, MFA, passkeys, trusted devices, invite acceptance, logout everywhere, and cross-tab synchronization.
- Work-record state logic, consent decisions, recording, location verification, media, publication, reviews, Trust Score, notifications, AI, retention, deletion, and legal pages.

### Areas verified unaffected

| Area | Validation | Result |
|---|---|---|
| Authentication | Login/session unit and integration tests | Pass in focused suite |
| Authorization | Actor, ownership, membership, admin, direct-route, and browser matrices | Pass |
| Work records/recording | Epic 1 regression | Pass |
| Reviews/Trust Score | No-side-effect regression | Pass |
| Notifications | No Phase A changes; related regression included | Pass in focused suite |
| Admin tools | Scoped admin session and DB grant browser test | Pass |
| Policies | Git scope review | Unchanged |
| Public/private access | Focused filtering regression | Pass |

### Potential regression risks reviewed

| Risk | Mitigation | Evidence | Remaining exposure |
|---|---|---|---|
| Signed role claim accidentally authorizes | DB actor ignores claim for authority | Unit and browser denial tests | Durable session lifecycle is Phase B |
| Cross-vendor IDOR | Exact active membership and resource-first policy | Matrix tests | Remaining route inventory must be maintained |
| Admin leaks into general session | Admin path-scoped cookies plus active DB grant | Unit/browser tests | Phase B revocation remains open |
| Pending onboarding blocked | Explicit onboarding-only profile boundary | Focused route tests | Only profile route supports this exception |

### Known unrelated issues

| Issue | Evidence | Blocks Phase A deployment? |
|---|---|---|
| Legacy `pages/support` and `pages/notifications` invalid exports | Build reaches compile/type/lint, then fails on untouched files | Yes |
| 12 full-suite failures | Failures are outside changed Phase A authorization surfaces; focused suites pass | No for local Phase A correctness; must remain visible |
| Dependency advisories | Existing lockfile audit; no dependency files changed | Yes for release security gate; requires separate approval |

No known regression attributable to this epic remains after the executed validation.

## Completion Decision

**Engineering status:** Phase A implemented and locally validated
**Deployment status:** Blocked by unrelated production-build defects
**Product Owner approval:** Pending
**Epic 3 completed:** No
**Phase B authorized:** No
**Next epic authorized:** No
