# Epic 4 Engineering Report

**Epic:** Universal Work Record and Recording Gates

**Status:** Implemented and validated locally; migration, deployment, and Product Owner replay pending

**Branch:** `codex/epic3-beta-admin-grant-correction`

**Starting commit:** `c40bd55c87d14a783856a113dfdfbde8f7ba6c88`

**Final commit:** Recorded by the scoped Git checkpoint at repository HEAD

**Report date:** 2026-08-04
**Owner:** Codex / Product Owner

## Objective

Deliver one universal work-record and recording-gate experience for vendor business, customer residence, and customer business locations. Recording now depends on the actual planned subject and scope, verified authority, current permission basis, active assignment, employee certification, and durable location evidence. Every runtime boundary uses the same server decision and every blocked decision explains why, who acts next, and what resolves it.

## Scope Delivered

- Mandatory server-derived recording subject and scope assessment.
- Authority requirements tied to the current assessment generation.
- Vendor-property notice path and verified customer permission path.
- Immutable work-record location snapshot and durable verification attempts.
- Employee certification tied to assignment generation and scope hash.
- Admin-only alternate-location decisions; managers may request but not self-approve.
- Material scope changes supersede stale assessment, authority, permission, certification, and release state.
- Canonical recording gate applied to vendor release, employee work view/start/stage, media-session creation, upload init/proxy/complete, vendor dashboard, and admin evidence.
- Internal `RecordingGateMetric` stores only the canonical block code and operational context. It has no review, Trust Score, permission, publication, or dashboard effect.
- Reason-specific employee and vendor blocked states.
- Customer recording notices with worker retry/dead-letter handling.

## Files Changed

| Area | Representative files | Change |
|---|---|---|
| Database | `prisma/schema.prisma`; two Epic 4 migrations | Added assessment, authority, certification, location attempt/exception, and diagnostic metric evidence. |
| Canonical gate | `src/lib/consent/recording-gate.ts` | Added the aggregate server decision and reason-specific blocks. |
| Assessment/notices | `src/lib/recording/*` | Added scope classification, hashing, validation, and customer notice delivery. |
| Work records | `src/app/api/bookings/route.ts`; vendor job actions | Persisted assessment/authority data, controlled release, material-change supersession, and location exceptions. |
| Employee boundaries | employee jobs/start/stage/certification/location routes and page | Enforced assignment, certification, location, permission, and clear recovery UI. |
| Media boundaries | media session and upload routes | Enforced the same canonical decision before session or blob operations. |
| Role evidence | vendor dashboard/jobs and admin permission audit | Exposed consistent state without granting override authority. |
| Notifications | notification worker and recording-notice helper | Added retryable customer recording notices while preserving permission-request processing. |
| Tests/evidence | focused Vitest and Playwright files | Added decision-matrix, mutation, location, media-boundary, and responsive UX evidence. |

## Migrations

| Migration | Purpose | Data treatment | Rollback |
|---|---|---|---|
| `20260804231500_add_recording_scope_authority` | Adds recording assessment and authority evidence. | Additive only; no historical consent or media is rewritten. | Remove only after application rollback and evidence export; not applied in this checkpoint. |
| `20260804233000_add_recording_gate_evidence` | Adds employee certification, location attempts/exceptions, and diagnostic metrics. | Additive only; existing jobs remain locked until current evidence is created. | Same application-first rollback rule; not applied in this checkpoint. |

`prisma validate` and `prisma generate` passed. No migration was applied to beta or any live database.

## Security Impact

- The session identifies the candidate actor; current database membership, ownership, assignment, evidence generation, and permission determine authority.
- Uncertainty fails closed. A missing assessment, authority, current assignment, certification, location result, or verified permission prevents recording.
- Vendor managers cannot approve their own location exception.
- Raw permission tokens, OTPs, credentials, or media URLs were not added to gate metrics or dashboard payloads.
- Diagnostic metric writes are best-effort and cannot alter authorization results.

## API Impact

New endpoints support employee certification, durable location verification, vendor location-exception requests, and admin location-exception decisions. Existing release, start, stage, media-session, upload, dashboard, consent, and notification endpoints retain their routes but now derive recording access from the canonical gate. Blocked recording responses use a structured code, reason, responsible participant, resolution, and service-continuation flag.

## Database Impact

Six additive evidence models were introduced. Current-generation constraints and indexes support work-record lookup without changing existing review, Trust Score, media visibility, or consent-decision records. Historical evidence is retained rather than rewritten when scope changes.

## Notification Impact

Customer recording notices can be delivered and retried through the existing worker. Permission requests remain separate. Retry limits and dead-letter behavior are preserved. No SMS provider validation was attempted and no live notification was sent in this checkpoint.

## AI Impact

None. AI receives no new authority and cannot classify identity, authority, permission, scope, or recording access.

## Dashboard Impact

- Vendor work records display the canonical current block and next responsible participant.
- Employee assigned work displays approved scope and reason-specific recording status.
- Admin permission evidence includes assessment, authority, certification, and location exception context.
- No Trust Score, review, publication, or business-performance metric was added.

## Legal Impact

No frozen policy or agreement was modified. The implementation records operational evidence required by the frozen workflow but does not claim to replace future Vendor or Employee Agreements.

## Backward Compatibility

- Existing permission records remain valid evidence and are reused by the canonical gate.
- Existing stage names, media routes, assignment links, and location-specific error codes remain supported.
- Existing genuine reviews, ratings, Trust Score inputs, media visibility, and publication behavior are unchanged.
- Jobs without Epic 4 evidence fail closed until assessed rather than being silently unlocked.

## Rollback Considerations

Roll back the application before removing additive schema objects. Do not delete evidence rows during an incident. If the new application cannot be deployed with the migrations, keep the current beta package mounted and do not apply the migrations. A diagnostic-metric outage is non-blocking; an evidence-store outage keeps recording locked.

## Testing

| Command / validation | Result | Notes |
|---|---|---|
| `npx prisma validate` | Passed | Dummy local SQL Server URL used only for schema validation. |
| `npx prisma generate` | Passed | Prisma Client 6.19.0 generated. |
| Focused Epic 4 Vitest package | 76/76 passed | Canonical gate, three-location behavior, booking creation, vendor actions, media sessions, location, and scope changes. |
| Additional focused/regression suites | Passed | Earlier execution: 56/56 Epic 4, 50/50 permission, 31/31 booking/notice, 20/20 canonical boundaries, 18/18 consent route files, 4/4 worker. |
| `e2e/epic4-recording-gates.spec.ts` | 4/4 passed | Controlled local fixtures; desktop/mobile blocked plus loading, empty, failure, and unlocked success. |
| `npx tsc --noEmit` | Passed | Final tree. |
| `npm run build` with 6 GB heap | Passed | Next.js 15.5.21; 198 App Router pages plus `/support` and `/notifications`. |
| `npm audit --omit=dev --json` | Completed with existing advisories | 0 Critical, 17 High, 7 Moderate, 1 Low; no dependency changed by Epic 4. |
| `git diff --check` | Passed | Line-ending notices only. |
| Full repository test run | Existing failures remain | Earlier run reproduced unrelated legacy failures; see Technical Debt. |
| Lint | No standalone lint script | Build performed its configured lint/type validity stage. |

The first Playwright attempt connected to an unrelated server already occupying port 3000 and was discarded. The accepted run used an isolated temporary port and this worktree.

## Screenshot Package

Indexed at `08_Screenshots/README.md`. Controlled test names and masked contact data only; no credentials, tokens, OTPs, or customer data appear.

## Known Limitations

- Migrations are not applied and application code is not deployed to beta.
- Physical-device GPS/camera/upload replay belongs to Epic 5 and the deferred consolidated RR-1A replay.
- Customer/vendor/admin screenshot coverage is not release-complete; this package focuses on the new employee gate and state inventory.
- Existing rejected-correction lifecycle tests remain unrelated failures.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

- Epic 1 verification, permission decisions, wrong-recipient handling, correction, and supersession.
- Epic 2 product language and role shell.
- Epic 3 database-derived actor and role isolation.
- Three-stage capture routes, assignment links, location error codes, manager review, and current notification worker.

### Existing functionality intentionally unchanged

- Reviews, ratings, Trust Score, publication, media visibility, retention, deletion, withdrawal, disputes, AI, and identity lifecycle.

### Areas verified unaffected

- Permission route regression, booking CRUD, vendor job actions, media sessions, worker behavior, authorization boundaries, type checking, and production build.

### Potential regression risks reviewed

- Legacy records without current assessment now fail closed.
- Added Prisma relations require migrations before mounting the application package.
- Notification candidate selection was widened carefully while retaining permission-request dead-letter behavior.
- Canonical gate query cost was reduced by reusing dashboard consent data where already loaded.

### Known unrelated issues

- Two rejected-correction lifecycle expectations disagree with current established manager-review behavior.
- The broader suite contains pre-existing dev-bypass, review/moderation, promoted-listing, employee copy, and admin media-fixture failures.
- Existing dependency advisories remain tracked outside Epic 4.

## Completion Gate

Engineering implementation, local tests, build, UX review, screenshot package, and documentation are complete. Beta migration/deployment and the Product Owner manual demo are intentionally pending separate approval. Epic 5 was not started.
