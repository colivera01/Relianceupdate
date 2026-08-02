# Epic 2 Engineering Report

**Epic:** Proof-First Platform Shell
**Status:** Implementation complete; Product Owner review pending
**Branch:** `cursor-latest-build`
**Starting commit:** `abe9d0d6fdd54f5942cb0f4511527b64bd04e1c0`
**Final commit:** This scoped Epic 2 checkpoint; hash reported after commit
**Report date:** 2026-08-02

## Objective

Make Reliance immediately understandable as a proof-of-service platform while preserving working service-request, account, permission, review, Trust Score, publication, and role behavior. Effective copy was preserved; text changed only where it conflicted with frozen standards or caused demonstrable first-time confusion.

## Scope Delivered

- Reframed the homepage first viewport around real completed work and trust evidence.
- Renamed visible public/customer navigation from Browse Services to Explore Proof without changing routes.
- Distinguished Public Service Videos, customer reviews, Reliance Trust Score, and Services Offered.
- Reframed public browse, service detail, and provider profile surfaces around proof and credibility.
- Aligned supporting vendor/admin/help/AI guidance terms while preserving decisions and contracts.
- Added focused content and Playwright tests plus a controlled desktop/mobile/state screenshot package.

## Files Changed

| Area | Files | Change |
|---|---|---|
| Public/customer pages | `src/app/page.tsx`, `browse`, `discover`, customer dashboard/profile/favorites/records/service pages, vendor public profile | Proof-first hierarchy and plain-language state copy. |
| Shared navigation | `PublicSiteHeader`, `PublicSiteFooter`, `UserSidebar`, `SidebarLayout` | Role-appropriate labels; stable hrefs preserved. |
| Vendor/admin surfaces | vendor dashboard and admin promotion/publish/reporting pages | Visible marketplace/promotion terminology aligned to proof. |
| Shared/API guidance | discover/admin publish APIs, `auth-next`, `user-guidance`, promotion/vendor coaching helpers and prompts | Human-facing explanations aligned; response shape and decisions unchanged. |
| Tests | `src/lib/proof-first-platform-shell.test.ts`, `e2e/proof-first-platform-shell.spec.ts` | Purpose, terminology, route stability, role blocks, and mobile overflow coverage. |
| Project evidence | Epic 2 plan, reports, checklist snapshot, screenshot index/package | Required implementation record. |

## Migrations

None. No schema, data, seed, or migration file changed.

## Security Impact

No authentication, authorization, session, token, OTP, permission, media access, or role-resolution logic changed. Signed-out vendor/admin access was tested as blocked. Epic 1 declined-recording gates passed on desktop and mobile.

## API Impact

No endpoint, status code, request field, response field, or route path changed. A few human-facing API error/explanation strings were aligned to the product language. Internal route names such as `/booking` and engineering identifiers remain for compatibility.

## Database Impact

None. The configured local database is missing `ConsentRecord.lifecycleStatus`, which blocks Playwright global database setup; no migration was applied because that is outside Epic 2.

## Notification Impact

No notification trigger, recipient, retry, delivery, or template behavior changed.

## AI Impact

Two recommendation-only prompts received terminology alignment. AI authority, inputs, outputs, guards, and decision boundaries were unchanged.

## Dashboard Impact

Customer, vendor, and admin shell labels now use proof-first terminology. Metrics, Trust Score values, work-record states, and actions are unchanged.

## Legal Impact

None. Frozen documents and active Terms, Privacy Policy, SMS Policy, consent, and publication rules were not changed.

## Backward Compatibility

All existing route paths, deep links, API contracts, service-request flows, booking-support routes, role checks, and public/private visibility rules remain. Only visible hierarchy and wording changed.

## Rollback Considerations

Rollback is a code-only revert of this Epic 2 checkpoint. No migration or data repair is required. Trigger rollback if proof-first labels break route discovery, role boundaries, or public filtering.

## Testing

| Command / validation | Result | Notes |
|---|---|---|
| `npx tsc --noEmit --pretty false --incremental false` | Pass | Type check passed. |
| Focused Vitest (4 files) | Pass, 36/36 | Shell, proof card, promotions, auth-next. |
| Broader focused Vitest | 46 pass, 1 fail | Existing admin promotion mock lacks a Prisma method; changed route logic was not involved. |
| `e2e/proof-first-platform-shell.spec.ts` | Pass, 5/5 | Desktop purpose, proof distinction, profile, role blocks, mobile overflow. |
| Epic 1 Playwright regression | Pass, 9/9 | Declined recording remains locked; permission UX/recovery intact. |
| `e2e/route-smoke.spec.ts` | Blocked | Required local account `e2e-trust-manager@reliance.test` is not registered. |
| `npm test` | 755 pass, 13 fail | Nine files fail on pre-existing stale fixtures/mocks/wording; no focused Epic 2 failure. |
| `npm run build` | Pass with 6 GB heap | Default 2 GB run exhausted heap; established 6 GB Node setting compiled 197 app routes. |
| Lint | Not run | Repository has no lint script or configured standalone lint command. |
| Visual review | Pass for captured scope | Desktop and 390px mobile, loading/success/empty/failure/blocked. |

## Known Limitations

- The independent five-person five-second/thirty-second comprehension test remains for Product Owner execution.
- Route smoke requires the missing registered local account fixture.
- Full release accessibility, tablet/wide viewport, and four-role screenshot matrices remain later release work.
- Full Vitest has 13 unrelated failures documented in Technical Debt.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

- Stable `/browse`, `/discover`, `/service/[id]`, `/vendors/[id]`, `/booking/[id]`, and role-area routes.
- Public filtering and service/provider data contracts.
- Customer optional review and Trust Score behavior.
- Epic 1 canonical permission and recording locks.

### Existing functionality intentionally unchanged

Authentication/session architecture, consent, recording, reviews, Trust Score calculation, notifications, publication, moderation, retention, and deletion were out of scope and not redesigned.

### Areas verified unaffected

| Area | Validation | Result |
|---|---|---|
| Authentication/authorization | Signed-out vendor/admin Playwright block | Pass |
| Work records/recording | Epic 1 permission-gate replay | 9/9 pass |
| Reviews/Trust Score | Focused unit tests and no logic diffs | Focused pass; full-suite stale tests noted |
| Public/private access | Public route E2E and source diff | Pass for Epic 2 scope |
| Notifications/storage/policies | Source diff confirms no behavior/file changes | Unchanged |

### Potential regression risks reviewed

| Risk | Mitigation | Evidence | Remaining exposure |
|---|---|---|---|
| Label and href diverge | Kept stable paths and asserted hrefs | Unit + Playwright | Full route smoke fixture blocked |
| Public shell overflows mobile | Fixed responsive constraints and measured page width | Playwright + screenshots | Tablet/wide release matrix pending |
| Copy change alters decisions | Changed strings only in shared/API helpers | Type/build/focused tests | Full suite has unrelated failures |
| Marketplace framing remains visible | Controlled active-source string scan | No active matches for audited phrases | Future notification/legal epics own other channels |

### Known unrelated issues

| Issue | Evidence | Status |
|---|---|---|
| Local DB lacks `ConsentRecord.lifecycleStatus` | Playwright global setup error before tests | Existing environment mismatch; no Epic 2 migration |
| Route smoke account absent | Login returns `USER_NOT_FOUND` for registered-fixture expectation | Test fixture debt |
| Full Vitest failures | 13 failures across stale mocks/fixtures/wording unrelated to changed behavior | Tracked in `05_Technical_Debt.md` |
| Browserslist data stale | Production build warning | Non-blocking maintenance |

**Closing declaration:** No known regression attributable to this epic remains after the executed validation.

## Completion Decision

**Engineering status:** Complete for scoped implementation
**Product Owner approval:** Pending
**Next epic authorized:** No
