# Epic 6 Engineering Report

**Epic:** Exact-Media Public Proof and Admin Moderation
**Status:** Engineering complete; Product Owner review and release gates pending
**Branch:** `codex/epic3-beta-admin-grant-correction`
**Starting commit:** `2f3bcece9bff3b42ada75bd24b03cf04f88a9787`
**Application commit:** `d6edf5cee81b11d9c1eb9fc5ee9bbbe4fbe96e5d`
**Report date:** 2026-08-05

## Objective

Allow a vendor manager to propose exact media from a manager-approved Private package, collect the customer's exact-stage choice and applicable participant/vendor decisions, require admin moderation, and expose only the unchanged approved version as a Public Service Video.

## Scope Delivered

- Final Result is the default proposal; other stages require an intentional selection.
- Customer can approve all, approve selected stages, keep all proof Private, or request correction.
- Employee-likeness and audio decisions are recorded per exact stage when required.
- Minor, unresolved-bystander, fallback-media, stale-version, and incomplete-chain cases fail closed.
- Vendor representation and admin decisions are bound to the same proposal hash.
- Public reads revalidate the complete evidence chain on every request.
- Any media or presentation change requires a new proposal and approval chain.
- Legacy `public` metadata is restricted to Private by migration because it lacks exact-media evidence.

## Files Changed

| Area | Principal files | Change |
|---|---|---|
| Evidence | `prisma/schema.prisma`; `prisma/migrations/20260805213000_add_exact_media_publication_evidence/migration.sql` | Add immutable proposal, stage, decision, eligibility, audit, and legacy-restriction records. |
| Canonical rules | `src/lib/service-video-publication.ts` | Add the exact-media state machine and canonical Public resolver. |
| Role APIs | publication routes under vendor, customer, employee, and admin APIs | Enforce ownership, membership, exact decisions, and moderation. |
| Public media | `src/app/api/public/media/[assetId]/route.ts`; public service/vendor/favorite APIs | Serve only canonically eligible exact media through short-lived storage access. |
| UI | `PublicationWorkflowCard.tsx`; vendor/customer/employee/admin pages | Add role-specific publication decisions and evidence review. |
| Compatibility | legacy admin moderation routes | Block legacy direct-Public shortcuts while preserving Private moderation. |
| Tests | Epic 6 unit/API/Playwright files and affected public-route tests | Cover evidence, stale versions, authorization, and Public filtering. |

## Migrations

| Migration | Purpose | Data treatment | Rollback |
|---|---|---|---|
| `20260805213000_add_exact_media_publication_evidence` | Add exact-media publication evidence and eligibility tables. | Existing media with raw `public` visibility is inventoried in `legacy_public_restriction_evidence` and returned to `private`; media and historical moderation facts are retained. | Restore the pre-migration database for full rollback. Dropping additive tables alone does not restore former Public exposure and is not an approved rollback. |

The migration was generated and reviewed but was not applied to beta in this checkpoint.

## Security Impact

- Vendor actions require current manager membership for the exact vendor.
- Customer actions require the signed-in owner of the work record.
- Employee decisions require current account status, membership, and matching capture evidence.
- Admin moderation requires the isolated admin session and database-backed authority.
- Public access no longer trusts raw `visibilityStatus`; it resolves package, proposal, exact stage, hashes, decisions, and active eligibility.
- Public playback redirects to a five-minute SAS URL only after canonical revalidation.
- No raw token, OTP, secret, private blob URL, or private customer data is stored in publication audit metadata.

## API Impact

New role APIs provide publication reads and decisions. New `/api/public/media/[assetId]` provides canonically checked playback. Existing public service, discover, category, favorites, and vendor-profile payloads now return only eligible media URLs. Legacy direct-Public moderation requests return `409`.

## Database Impact

Nine additive evidence/projection models are introduced. Content, package, proposal, presentation, decision, and eligibility hashes bind decisions to the exact version. No existing genuine decision is rewritten or fabricated.

## Notification Impact

No notification transport or template was changed. The final Product Owner instruction preserved Notifications for their later alignment epic. Publication state is immediately available in the role views; transactional publication delivery remains a documented follow-up and is not claimed as complete here.

## AI Impact

No AI prompt, model, decision, or authority changed. AI cannot approve publication.

## Dashboard Impact

Vendor work detail, customer service record, employee assigned-work view, and admin sidebar/queue expose the canonical publication state and next action. General dashboard metric reconciliation remains outside this epic.

## Legal Impact

No policy or agreement text changed. The implementation adds durable operational evidence but does not claim legal-document alignment.

## Backward Compatibility

Epic 1 permission, Epic 2 shell, Epic 3 authorization, Epic 4 recording gates, Epic 5 Private proof, genuine reviews, and Trust Score logic are preserved. Existing raw Public flags intentionally cease authorizing Public access after migration.

## Rollback Considerations

Do not mount this application before the additive migration is applied. Roll back the application package and database together if migration verification fails. Because former raw Public flags are not valid exact-media approvals, rollback must not silently republish them.

## Testing

| Validation | Result | Notes |
|---|---|---|
| Prisma format, validate, generate | Pass | SQL Server schema validated with a non-secret validation URL. |
| Epic 6 focused tests | Pass, 45/45 | Seven test files. |
| Epic 1-6 focused regression | Pass, 331/331 | 129 suites. |
| Full repository tests | 835/840 | Five untouched known failures; no Epic 6 test failed. |
| TypeScript | Pass | `npx tsc --noEmit --pretty false --incremental false`. |
| Epic 6 Playwright | Pass, 5/5 | Isolated visual/interaction fixture. |
| Production build | Pass | `NODE_OPTIONS=--max-old-space-size=8192`; 201 App Router entries plus legacy Support/Notifications. |
| Production smoke | Partial | Homepage and admin shell passed; local public-media smoke lacked `DATABASE_URL`, while route unit tests passed. |
| Standalone package inspection | Pass | 2,913 files; no sensitive-name match. |
| `npm audit --omit=dev` | 0 Critical, 17 High, 7 Moderate, 1 Low | Existing dependency findings; no dependency changed. |
| Lint | Not run | Repository has no lint script. |
| Physical-device/live beta replay | Not run | Release gate after migration and deployment. |

## Screenshot Package

Nine controlled screenshots cover vendor, customer, employee, admin, Private, loading, success, and failure states. See `08_Screenshots/README.md`.

## Known Limitations

- Migration application, beta deployment, and live four-role replay remain pending release gates.
- Publication lifecycle notifications are not added in this checkpoint.
- Public eligibility resolution favors correctness over query count and should be profiled under beta traffic.
- Legacy media remains stored as Private; later retention/deletion work owns physical disposition.
- Full accessibility and physical-device testing remain release-wide gates.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

Permission and recording locks, role isolation, assessment/location gates, three-stage capture, retry/correction, manager-approved Private access, optional reviews, and valid Trust Score inputs remain unchanged. The 331-test cross-epic package passed.

### Existing functionality intentionally unchanged

Registration, location verification, recording permission, reviews, Trust Score calculation, AI, notifications, withdrawal, disputes, retention, deletion, and policy text were not redesigned.

### Areas verified unaffected

| Area | Result |
|---|---|
| Authentication/authorization/role isolation | Focused regressions passed. |
| Work records and recording | Epic 4/5 regressions passed. |
| Private proof | Remains complete and customer-only without publication. |
| Reviews and Trust Score | No publication event creates either input. |
| Public/private access | New canonical filtering tests passed. |
| Admin tools | Private moderation preserved; direct Public shortcut blocked. |

### Potential regression risks reviewed

Public cache exposure, stale exact versions, legacy moderation routes, unauthorized role access, package replacement, and direct media access were covered by focused tests or fail-closed checks. Live cache and storage behavior remain deployment gates.

### Known unrelated issues

The full test suite has five pre-existing failures in email-verification wording, two employee runtime/capture fixtures, promoted listings, and the review moderation queue. They are outside Epic 6 and were not modified.

`No known regression attributable to this epic remains after the executed validation.`

## Completion Decision

**Engineering status:** Complete locally
**Product Owner approval:** Pending evidence review
**Deployment:** Not performed
**Next epic authorized:** No
