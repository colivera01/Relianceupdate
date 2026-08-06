# Epic 7 Engineering Report

**Epic:** Withdrawal, Disputes, Retention and Final Disposition
**Status:** Completed and frozen; release gates pending
**Branch:** `codex/epic3-beta-admin-grant-correction`
**Starting commit:** `acd1ad07f60a36284244fe3edef6c6a79cd8fab1`
**Application commits:** `27fa324ddab3e39222d30b470b2fc42b643ff604`, `5b83125b3f04106c2c4a80365d906b81c1f3990f`
**Evidence package:** `f27a3ff2d23b5c5e873631ab67e18a63b1da8a5c`
**Report date:** 2026-08-05
**Product Owner decision:** Approved on 2026-08-05

## Objective

Deliver one canonical, least-exposure media lifecycle for recording withdrawal, Public withdrawal, likeness withdrawal, disputes, evidence holds, retention, deletion requests, verified physical deletion, appeals, and final disposition. Lifecycle state narrows access only; it never creates recording permission, publication approval, reviews, ratings, Trust Score inputs, or synthetic activity.

## Scope Delivered

- Canonical outcome order: `PUBLIC -> PRIVATE -> RESTRICTED -> HELD -> DELETED`.
- Recording withdrawal blocks the existing canonical recording gate.
- Public withdrawal invalidates active exact-media Public eligibility immediately.
- Privacy, identity, authority, safety, minor, and material-misrepresentation disputes restrict exposure while reviewed.
- Customer, vendor manager, assigned employee, and admin actions are role- and ownership-bound.
- Evidence holds prevent deletion; hold release requires an authorized admin decision.
- Deletion uses truthful `REQUESTED`, `QUEUED`, `ATTEMPTING`, `VERIFYING`, `RETRY_REQUIRED`, `HELD`, `FAILED`, and `COMPLETED` states.
- `COMPLETED` is written only after Azure Blob Storage independently reports the blob absent.
- Private-media retention schedules begin when manager approval creates customer-visible Private proof.
- Public and Private media reads and downloads re-evaluate lifecycle state server-side.
- Appeals preserve the original decision and require a second admin reviewer.
- Customer, vendor, employee, and admin surfaces expose current status, responsible participant, and next action.

## Files Changed

The application checkpoint changes 31 executable/schema/test files. The main ownership areas are:

| Area | Files | Purpose |
|---|---|---|
| Database | `prisma/schema.prisma`, `prisma/migrations/20260805233000_add_media_lifecycle_evidence/migration.sql` | Additive lifecycle, withdrawal, restriction, retention, hold, deletion, appeal, and audit evidence |
| Canonical rules | `src/lib/media-lifecycle.ts`, `src/lib/media-lifecycle.test.ts` | Least-exposure resolution, lifecycle mutations, retention and deletion workers |
| Existing gates | `src/lib/consent/recording-gate.ts`, `src/lib/service-video-evidence.ts`, `src/lib/service-video-publication.ts` | Fail closed when active lifecycle evidence narrows access |
| Role API | `src/app/api/bookings/[id]/lifecycle/route.ts`, `src/app/api/admin/media-lifecycle/route.ts` | Authorized lifecycle actions and admin decisions |
| Worker | `src/app/api/internal/media-lifecycle/process/route.ts` | Due retention and deletion processing behind the existing internal worker secret |
| Media serving | Public, customer, vendor, and admin media routes under `src/app/api/` | Canonical lifecycle checks before stream/download and shorter Public SAS lifetime |
| Manager approval | `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.ts` | Start/refresh retention schedules when Private proof becomes customer-visible |
| UI | `MediaLifecycleCard.tsx`, customer/vendor/employee pages, admin queue/dashboard | Truthful lifecycle states and scoped actions |
| Tests/evidence | lifecycle route tests, worker tests, vendor media integration test, `e2e/epic7-media-lifecycle.spec.ts` | Role, state, failure, mobile, and regression coverage |

## Migration

`20260805233000_add_media_lifecycle_evidence` is additive. It creates ten tables and indexes without deleting or rewriting existing media, publication evidence, Private grants, reviews, Trust Score records, or consent evidence.

The migration is not applied to beta by this checkpoint. Deployment must apply it before mounting the Epic 7 package. Rolling back application code leaves additive evidence tables unused; destructive down-migration is not recommended after lifecycle evidence exists.

## Security Impact

- Protected lifecycle requests rebuild the current actor and role authority from server-side account, ownership, membership, assignment, and platform-admin evidence.
- Customers may act only on their work record; vendor managers require active vendor authority; employees receive likeness-only scope for assigned work; admin actions require current platform-admin authority.
- Lifecycle state is re-evaluated before media access and is not trusted from UI metadata.
- Active restrictions and uncertain model state fail closed.
- Worker authentication uses constant-time comparison of hashed secret values; no secret is returned.
- Audit events store actor, role, prior/resulting state, request context, and a deterministic evidence hash.
- Public SAS lifetime is reduced from five minutes to two minutes and Public responses use `no-store`.

## API Impact

- `GET/POST /api/bookings/[id]/lifecycle`: status plus scoped withdrawal, dispute, deletion, hold, and appeal actions.
- `GET/POST /api/admin/media-lifecycle`: read-only queue plus case, hold, appeal, and deletion decisions.
- `POST /api/internal/media-lifecycle/process`: authenticated retention/deletion worker.
- Existing media routes keep their paths and add fail-closed lifecycle checks.
- Legacy vendor delete now creates a deletion request; it no longer reports physical deletion before verification.

## Database Impact

Lifecycle evidence is append-oriented. Operational status may advance, but withdrawal/audit/attempt history remains. Existing valid media remains available at its prior audience unless a verified lifecycle event narrows it. Retention schedules are idempotently upserted for completed work records and refreshed at manager approval.

## Notification Impact

No notification transport, template, recipient rule, or scheduler was redesigned. Current in-app role surfaces update from canonical lifecycle state. Lifecycle-specific outbound notification alignment remains assigned to Epic 10; it must not be inferred from this implementation.

## AI, Reviews, Trust Score, and Legal Impact

- AI has no decision authority and no AI code changed.
- No lifecycle event creates or modifies a review, rating, or Trust Score input.
- Frozen policies, agreements, consent architecture, workflow specifications, and language documents were not changed.
- Permission to record and exact-media approval remain separate from lifecycle withdrawal and disposition.

## Backward Compatibility

- Existing URLs and role pages remain.
- Existing Private grants and exact-media Public evidence remain authoritative until lifecycle evidence narrows access.
- Existing `deletedAt`/`archiveStatus` fields remain as compatibility markers, but are set to deleted only after verified blob absence.
- Historical records are not fabricated, converted, or silently deleted.

## Rollback Considerations

Before deployment, rollback is application-only. After lifecycle evidence is created, roll back the package only if the prior package also fails closed on active restrictions; otherwise keep Epic 7 mounted or disable affected media serving. Never remove audit, withdrawal, hold, or deletion-attempt evidence to restore visibility.

## Testing

| Validation | Result | Notes |
|---|---|---|
| Prisma validate/generate | Pass | Schema and generated client valid |
| Focused lifecycle/API tests | Pass | 22 tests in the initial focused package; final manager-approval/lifecycle package 13/13 |
| Epic 7 Playwright | Pass | 4/4 desktop/mobile lifecycle scenarios |
| TypeScript `npx tsc --noEmit` | Pass | Final source state |
| Production build | Pass | Next 15.5.21, 8 GB heap; 205 static-generation steps |
| Full Vitest suite | Partial | 850 passed; five pre-existing unrelated failures remain |
| `git diff --check` | Pass | Line-ending warnings only |
| Lint | Not run separately | No repository lint script; Next build validation completed |
| Live Azure Blob deletion | Not run | Requires migration/deployment and controlled beta Blob fixture |

The five unrelated failures are employee wording expectations, email-verification development bypass expectation, and two existing admin route fixture failures. None imports or exercises Epic 7 code.

## Screenshot Package

See `08_Screenshots/README.md`. Eight controlled screenshots cover desktop customer states, admin queue, mobile customer/employee states, loading, and failure recovery. No real customer data is present.

## Known Limitations and Release Gates

- Additive migration and application are not deployed.
- Azure Logic App/worker scheduling for the lifecycle worker is not configured or validated.
- Live Blob delete, absence verification, retry, cache invalidation, and rollback are pending controlled beta validation.
- Four-role signed-in Product Owner replay is pending.
- Lifecycle-specific email/SMS/in-app notification alignment is deferred to Epic 10.
- Existing completed records receive schedules when lifecycle status is read or the approval path is replayed; a deployment backfill/worker reconciliation must be verified before release.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

Epic 1 permission, Epic 3 authorization, Epic 4 recording gates, Epic 5 Private proof, Epic 6 exact-media approval, optional reviews, Trust Score inputs, and current notification delivery remain. Focused route tests, cross-epic full-suite execution, TypeScript, build, and browser checks exercised these shared boundaries.

### Existing functionality intentionally unchanged

Registration, onboarding, recording assessment design, stage capture, manager correction, publication proposal creation, review submission/moderation, Trust Score calculation, notification templates, AI, and policy text were not redesigned.

### Potential regression risks reviewed

| Contract | Risk | Mitigation | Remaining exposure |
|---|---|---|---|
| Public media serving | stale Public cache after withdrawal | canonical read-time check, two-minute SAS, `no-store` | live CDN/cache test pending |
| Private media serving | broad denial from uncertain state | role ownership tests and fail-closed resolver | beta DB migration required |
| Deletion | false success after provider acceptance | independent `getBlobProperties` verification | live provider replay pending |
| Manager approval | proof visible without retention schedule | approval now awaits idempotent schedule creation | requires Epic 7 migration |
| Legacy delete | callers expect immediate archive | truthful request response and integration tests | beta UX replay pending |

### Known unrelated issues

Five baseline Vitest failures remain outside Epic 7. Unrelated modified/untracked worktree files were not staged or rewritten.

**Closing declaration:** No known regression attributable to Epic 7 remains after the executed local validation. Deployment-dependent acceptance criteria remain open and are not claimed.

## Completion Decision

**Engineering status:** Complete locally
**Product Owner approval:** Pending
**Next epic authorized:** No
