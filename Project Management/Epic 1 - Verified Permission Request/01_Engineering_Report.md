# Epic 1 Engineering Report

**Epic:** Verified Permission Request
**Status:** Engineering implementation complete; migration deployment, live-provider validation, and Product Owner demo pending
**Branch:** `cursor-latest-build`
**Starting commit:** `2ddc4f31560da791330fa67f753593f3962ca544`
**Final commit:** This Epic 1 Git checkpoint; use `git log -1` after commit
**Report date:** 2026-07-31
**Owner:** Codex / Product Owner

## Objective

Deliver one secure recording-permission request for an existing eligible work record. The intended recipient can verify identity through a matching account or channel-specific OTP, state their authority, allow recording, decline, decide later, or report a wrong recipient. Recording remains locked unless the canonical decision is verified and allowed.

## Scope Delivered

- One canonical request with independently audited email and SMS delivery attempts.
- Forty-eight-hour action links, 10-minute OTPs, five-attempt limit, 20-minute decision sessions, and replay protection.
- Hash-only storage for action-link and OTP secrets; no raw secret in database fields, API responses, dashboards, booking metadata, or audit metadata.
- Matching-account or OTP identity verification plus authority-role/scope evidence.
- Wrong-recipient invalidation, recipient correction, resend/link rotation, supersession, expiry, and dead-letter recovery.
- Private initial audience, audio off, and explicit separation from later publication.
- Vendor and employee status/recovery copy plus a read-only admin Permission Audit.
- Canonical media-session gate that ignores client-supplied permission claims.
- Additive legacy normalization that preserves historical decisions as unverified legacy evidence while scrubbing raw permission secrets.

## Files Changed

| Area                    | Representative files                                                             | Change                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Database                | `prisma/schema.prisma`; two Epic migrations                                      | Add request, verification, decision, content-version, delivery-attempt, retry, and evidence structures.                         |
| Permission domain       | `src/lib/consent/**`                                                             | State machine, hashing, OTP, authorization, lookup, request, delivery, decision, session, summary, and admin evidence services. |
| Customer APIs           | `src/app/api/consent/**`                                                         | Safe lookup, verification, allow/decline, wrong recipient, resend, correction, status, and authorization.                       |
| Vendor/work record APIs | booking, dashboard, job action, and media-session routes                         | Canonical request creation/status and verified recording gate.                                                                  |
| Notifications           | `src/lib/notifications/**`; internal notification worker                         | Minimum-data templates, OTP delivery, attempts, retry leases, dead-letter, and secret-separated worker access.                  |
| UI                      | permission page/CSS, vendor jobs, employee jobs, admin Permission Audit, sidebar | Education-first permission flow and truthful cross-role status/recovery.                                                        |
| Tests                   | consent unit/integration tests, booking/media/notification tests, Playwright     | Security, state, authorization, notification, recording-lock, and responsive UX coverage.                                       |
| Project records         | Epic 1 folder, dashboard, Beta Readiness tracker                                 | Evidence, UX critique, demo steps, regression statement, debt, screenshots, and checkpoint.                                     |

## Migrations

| Migration                                               | Purpose                                                                                                                           | Data treatment                                                                                                                                      | Rollback                                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `20260731201500_add_verified_permission_infrastructure` | Add verified-permission schema, indexes, evidence, decision session, challenge, content version, and durable notification fields. | Additive; existing consent rows are not converted into verified decisions.                                                                          | Disable the feature flag first. A schema rollback must preserve decision evidence exported after deployment. |
| `20260731203000_normalize_legacy_permission_secrets`    | Normalize legacy consent rows and remove recoverable raw secrets.                                                                 | Existing terminal decisions remain historical `legacyEvidence`; old pending rows are superseded; token/metadata/event secret remnants are scrubbed. | Restore only from a protected pre-migration backup. Raw secret restoration is intentionally not supported.   |

The migrations were validated and generated locally but were not deployed to the configured database. `prisma migrate status` reports both Epic migrations pending.

## Security Impact

- Vendor mutation routes require a signed-in user with an active membership and permission-management authority for the booking's canonical vendor.
- Customer allow/decline requires a verified decision session; possession of the action link is insufficient.
- Public lookups return only masked, minimum-necessary summaries.
- Permission and OTP secrets are generated with cryptographic randomness and stored only as hashes.
- OTPs are channel-bound, expire, are single-use, and enforce a maximum attempt count.
- Decision evidence records verified contact, role, scope, content version/hash, IP, user agent, and decision state.
- Concurrent decisions use database uniqueness and convert a race into a stable `PERMISSION_ALREADY_DECIDED` response.
- The internal worker uses a separate worker secret.
- Dependency audit found 25 known production dependency advisories (1 critical, 16 high, 7 moderate, 1 low). They are pre-existing release debt.

## API Impact

- `POST /api/consent/request` creates or rotates a canonical request and returns masked status, never an action secret.
- `GET /api/consent/[token]` resolves only by hash and returns an identity-safe summary.
- Verification start/verify routes establish a short-lived HttpOnly decision session.
- Allow and decline consume verified identity/authority evidence and enforce one terminal decision.
- Wrong-recipient is distinct from decline.
- Resend and recipient-correction routes are vendor-manager operations with canonical booking/vendor checks.
- Status is owner/manager scoped and redacted.
- `POST /api/internal/notifications/process` is a worker-only retry endpoint.
- Media-session creation queries canonical verified permission instead of trusting request payload fields.

## Database Impact

New evidence models are additive. `ConsentRecord.token` becomes nullable for legacy compatibility and is no longer used for new requests. Current-request uniqueness is represented by the canonical current record. Existing submitted decisions are preserved as historical facts but do not gain verified status. Operational retry fields may change; decision evidence and content versions remain durable.

## Notification Impact

- Email and SMS explain purpose, three recording stages, Private initial audience, audio-off state, decline/decide-later, and separate later publication.
- Every channel attempt stores channel, masked target, state, provider reference/error, attempt count, and timing.
- Retries use idempotency, leases, backoff, maximum attempts, and dead-letter state.
- Delivery failure never creates permission and keeps recording locked.
- Live provider delivery was not executed in this run.

## AI Impact

No AI behavior was added or changed. AI has no authority to create, infer, recommend, or override permission. No permission event creates an AI input.

## Dashboard Impact

- Vendor: canonical permission state, masked recipient, recovery, and no ability to assert the customer decision.
- Employee: clear recording lock when verified permission is absent; camera access is withheld.
- Customer: education, verification, authority, allow/decline/later/wrong-recipient, success, expiry, and unavailable states.
- Admin: read-only permission evidence and delivery history; no override control.

## Legal Impact

Frozen legal and design documents were not edited. Epic 1 stores the exact presented permission content/version and reconstructable decision evidence. It does not treat recording permission as Terms acceptance, Privacy acceptance, publication approval, audio permission, or review activity.

## Backward Compatibility

- Existing terminal decisions remain historical; they are not fabricated as newly verified.
- Legacy incomplete/pending rows cannot unlock recording and may be superseded by a verified request.
- Existing booking creation remains successful if request delivery fails; the safe result is a locked work record with visible recovery.
- Existing review, rating, Trust Score, media publication, location, manager review, retention, and deletion rules were not redesigned.
- `VERIFIED_PERMISSION_REQUESTS_ENABLED` provides a fail-closed rollback boundary.

## Rollback Considerations

1. Disable `VERIFIED_PERMISSION_REQUESTS_ENABLED`.
2. Stop the internal notification worker.
3. Keep recording locked while the verified path is unavailable.
4. Roll application code back without deleting evidence written by the new schema.
5. Restore a protected pre-migration backup only if schema rollback is unavoidable.
6. Trigger rollback for secret exposure, unauthorized decision, recording unlock without verified evidence, or destructive migration behavior.

## Testing

| Command / validation                                                                                            | Result                       | Evidence / notes                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Focused Vitest command covering 15 Epic files                                                                   | **Pass: 99 tests**           | Permission, authorization, OTP, booking, notification, worker, media gate, and beta-gate coverage.     |
| `node scripts/dev/run-playwright-live-aware.cjs --skip-global-db-setup e2e/verified-permission-request.spec.ts` | **Pass: 5 tests**            | Desktop/mobile loading, education, failure, authority, success, blocked, unavailable, wrong recipient. |
| `npm test -- --reporter=dot`                                                                                    | **Fail: 13 unrelated tests** | Stale copy expectations and unrelated fixtures/mocks.                                                  |
| `npx tsc --noEmit --pretty false --incremental false`                                                           | **Fail: 1 unrelated error**  | Existing `vendor-job-actions.integration.test.ts:696`: `json.job` is `unknown`.                        |
| `npx prisma format` / `validate` / `generate`                                                                   | Pass                         | Schema formatted, valid, client generated.                                                             |
| `npx prisma migrate status`                                                                                     | Pending                      | Two Epic migrations are not deployed.                                                                  |
| Migration hash verification                                                                                     | Pass                         | `a52a21a38b3832cc0d9b7cc6d4a430e593e6276b54a76cfe833a9ef9eb10cf0a`.                                    |
| `npm run build` with 8 GB heap                                                                                  | **Pass**                     | Compiled; 197/197 static pages.                                                                        |
| `git diff --check`                                                                                              | Pass                         | No whitespace errors.                                                                                  |
| `npm audit --omit=dev --json`                                                                                   | Findings                     | 25 known advisories.                                                                                   |
| Lint                                                                                                            | Not run                      | No lint script/configured ESLint command.                                                              |
| Live provider delivery                                                                                          | Not run                      | Controlled provider credentials/recipients were not used.                                              |

## Screenshot Package

Generated binaries remain untracked under `output/epic1-screenshot-package/`. The committed index is `08_Screenshots/README.md`. It covers desktop/mobile loading, education, verification failure, authority, success, blocked, unavailable, and wrong-recipient states.

## Known Limitations

- Migrations are pending and not validated against deployed beta data.
- Live email/SMS, callbacks, and production retry scheduling are not validated.
- Product Owner demo is not yet run.
- Dedicated vendor, employee, and admin screenshots remain part of the broader release package.
- Guardian/minor authorization remains blocked.
- Full test/type gates contain unrelated failures listed above.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

- Booking creation and assignment remain intact; delivery failure locks rather than deletes the booking.
- Three stages, location verification, manager review, and upload behavior are unchanged except for the stronger permission prerequisite.
- Reviews, ratings, Trust Score inputs, and publication receive no permission-event side effects.
- Existing providers remain transports; Epic 1 adds verified content/evidence and retry orchestration.

### Existing functionality intentionally unchanged

Customer registration, vendor onboarding, global account/session isolation, location policy, audio enablement, exact-media approval, withdrawal, disputes, retention/deletion, reviews, Trust Score, and policy text.

Unrelated deleted frozen-document entries, `tsconfig.tsbuildinfo`, and `output/` were not staged, restored, or treated as Epic changes.

### Areas verified unaffected

| Area                         | Validation                                                   | Result                                        |
| ---------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| Authentication/authorization | Account/OTP, membership, customer session, admin guard tests | Epic path passes; global isolation unchanged. |
| Work records                 | Booking integration and assignment tests                     | Pass in focused suite.                        |
| Recording                    | Canonical media-session tests                                | Pass; uncertainty remains locked.             |
| Reviews / Trust Score        | Static side-effect search and assertions                     | No permission-side writes.                    |
| Notifications                | Template/delivery/worker/failure tests                       | Pass; live providers pending.                 |
| Admin                        | Permission Audit tests/build                                 | Pass; no override added.                      |
| Policies                     | Scoped diff review                                           | Frozen text unchanged.                        |
| Public/Private               | Private-default and media-gate tests                         | Pass; no Public media created.                |
| Storage                      | Scope review                                                 | Media blob/storage behavior unchanged.        |

### Potential regression risks reviewed

| Contract         | Risk                                    | Mitigation                                                      | Remaining exposure                     |
| ---------------- | --------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| Prisma schema    | Migration affects active rows           | Additive models, explicit legacy evidence, backup/flag rollback | Production-like rehearsal required.    |
| Booking creation | Notification failure rolls back booking | Request runs after booking; failure locks                       | Live failure path pending.             |
| Media sessions   | Client claim unlocks recording          | Server ignores claims; queries canonical evidence               | Migration must deploy first.           |
| Retry worker     | Duplicate sends/decisions               | Idempotency, lease, generation, terminal checks                 | Scheduler/provider validation pending. |

### Known unrelated issues

- 13 full-suite failures outside the focused Epic suite.
- One standalone type error in an unrelated integration test.
- 25 production dependency advisories.
- Malformed `.gitignore` patterns affecting search tooling.

### Required Closing Declaration

No known regression attributable to this epic remains after the executed validation. Migration deployment, live-provider delivery, Product Owner demo, and unrelated repository-wide failures remain open gates.

## Completion Decision

**Engineering status:** Implemented and evidence-complete locally
**Product Owner approval:** Pending demo
**Next epic authorized:** No
