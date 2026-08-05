# Epic 5 Engineering Report

**Epic:** Safe Capture Through Private Service Videos
**Status:** Engineering complete; Product Owner replay pending
**Branch:** `codex/epic3-beta-admin-grant-correction`
**Starting commit:** `98c50ae727839d353f0eb357b39ca5c5761bf7ac`
**Final commit:** Recorded after the scoped checkpoint
**Report date:** 2026-08-05
**Owner:** Codex / Product Owner

## Objective

Deliver the complete Private proof experience from an Epic 4 allowed recording decision through employee capture, truthful upload recovery, package submission, stage-specific manager correction, manager approval, and authorized customer access. Every customer-visible package must have the approved evidence chain:

`Work Record -> Assessment Generation -> Permission Evidence -> Recording Gate Decision -> Employee -> Capture -> Package Version -> Manager Decision -> Customer Access`

## Scope Delivered

- Three-stage Starting Condition, Work in Progress, and Final Result capture with audio excluded by default.
- Canonical gate evidence bound to each session and accepted upload.
- Truthful upload states: `Uploading`, `Saved`, `Retry Required`, and `Rejected`.
- SHA-256 content identity, capture provenance, stage version, and replacement lineage.
- Idempotent package submission and exact package-version manager decisions.
- Stage-specific correction requests that preserve unaffected stages.
- Manager approval that atomically creates customer-only Private proof and its access grant.
- Customer and vendor-manager access that fails closed when any evidence-chain link is missing or inconsistent.
- No Public publication, review, rating, Trust Score, AI, or permission side effects.

## Files Changed

| Area | Files | Change |
|---|---|---|
| Schema/migration | `prisma/schema.prisma`; `prisma/migrations/20260805193000_add_private_service_video_evidence/migration.sql` | Additive evidence, upload-attempt, package, manager-decision, and access records. |
| Evidence policy | `src/lib/service-video-evidence.ts`; `src/lib/consent/recording-gate.ts` | Reconstruct and validate the canonical chain; submit/approve packages atomically. |
| Upload/session APIs | Vendor media session, upload init/proxy/complete/status routes | Bind actor, assignment, gate, stage, attempt, content hash, provenance, and state. |
| Package review APIs | Employee complete; vendor approve/reject routes | Idempotent submission, Private approval, and stage-specific correction. |
| Private access APIs | Customer claim/register and booking media/download routes; vendor download route | Transfer access during claim and enforce customer or manager authority plus complete evidence. |
| UI | Employee jobs, vendor jobs, customer booking detail | Truthful upload/retry copy, Private review actions, and Private customer notice. |
| Tests | Epic 5 service, route, integration, and Playwright files plus affected fixtures | Positive, negative, idempotency, access, and responsive recovery coverage. |

## Migrations

| Migration | Purpose | Data treatment | Rollback |
|---|---|---|---|
| `20260805193000_add_private_service_video_evidence` | Add evidence-chain, upload-attempt, package-version, manager-decision, and Private-access records; extend media/session identity. | Additive only. Existing assets remain and use `LEGACY_UNKNOWN` where provenance cannot be proven. No historical customer or manager activity is invented. | Roll back the application first. Preserve evidence and blobs; database object removal requires a separately reviewed compensating migration. |

The migration was generated and validated locally. It was not applied to beta and no package was deployed.

## Security Impact

- Every protected mutation rebuilds actor, membership, assignment, ownership, and manager authority from current database state.
- Session creation and every upload boundary require the Epic 4 canonical allowed decision.
- Private access fails closed unless the exact current package, manager decision, stage versions, hashes, sessions, employee, gate decision, and access grant agree.
- Raw blob URLs, permission tokens, OTPs, and secrets are not added to responses or audit metadata.
- Customer access is customer-only; vendor download requires manager authority; employee download after submission remains denied.

## API Impact

- Media upload responses now expose a truthful persisted state and attempt evidence.
- A new upload-status route supports recovery without claiming success before server confirmation.
- Package approval produces Private customer access rather than Public/admin-moderation state.
- Existing route shapes remain compatible where possible; new evidence fields are additive.

## Database Impact

The schema adds immutable or append-oriented evidence for canonical recording decisions, upload attempts, accepted stages, package versions, manager decisions, and Private access. `MediaAsset` gains content identity, provenance, stage version, replacement lineage, Public eligibility, and upload state. `MediaSession` gains canonical gate and employee membership references.

## Notification Impact

Existing notification infrastructure remains unchanged. State transitions continue to use current submission, correction, and customer-ready paths. No new SMS provider dependency was introduced and no live-provider delivery was claimed in this checkpoint.

## AI Impact

None. AI receives no media-analysis authority and no Epic 5 event creates an AI decision.

## Dashboard Impact

- Employee: server-confirmed stage state, preserved preview on failure, explicit retry, and package submission.
- Vendor: exact package review, stage-specific correction, and Private approval.
- Customer: Private Service Video appears only after complete evidence and authorized access.
- Admin: no Public moderation item is created by Private approval.

## Legal Impact

No policy, agreement, consent text, or frozen governing document changed. Epic 5 records operational evidence already required by the frozen workflow.

## Backward Compatibility

Existing media remains intact. Legacy media is not assigned invented provenance. Existing permission, registration, authorization, review, Trust Score, AI, and Public-media behavior is intentionally unchanged. New evidence rules apply to new Epic 5 package transitions; incomplete legacy chains fail closed for new Private-proof authorization.

## Rollback Considerations

Roll back the application package before any schema action. The additive schema can remain safely while the older application runs. Do not delete evidence rows or blobs during rollback. Triggers include failed migration, incorrect cross-role access, package approval without a full chain, or any upload represented as Saved before verification.

## Testing

| Command / validation | Result | Notes |
|---|---|---|
| `npx prisma format` | Pass | Schema formatted. |
| `npx prisma validate` | Pass | Validated with a non-secret SQL Server URL. |
| `npx prisma generate` | Pass | Client generated. |
| `npx tsc --noEmit --pretty false --incremental false` | Pass | No type errors. |
| Epic 5 focused/service/route suites | Pass, 58/58 plus 20/20 | Evidence, upload, access, idempotency, and corrected fixtures. |
| Epic 1-5 focused regression | Pass, 108/108 | 22 files. |
| Final focused regression | Pass, 85/85 | 14 files after final retry UX adjustment. |
| Epic 5 Playwright | Pass, 2/2 | Desktop/mobile Saved and Retry Required states. |
| Production build | Pass | Next.js 15.5.21; 198 App Router generation entries plus legacy `/notifications` and `/support`. |
| `npm audit --omit=dev --json` | Advisory exit | 0 Critical, 17 High, 7 Moderate, 1 Low; inherited release-hardening debt, no Epic 5 dependency changes. |
| Full `npm test -- --reporter=dot` | 8 pre-existing failures | Untouched email-bypass copy, employee wording fixtures, three admin-media tests, promoted listings, and admin review queue. No Epic 5 test failed. |
| `git diff --check` | Pass | Line-ending warnings only. |

Physical Android/iOS camera, weak-network, and denied-permission testing was not available in this environment and remains a Product Owner/RR-1A replay requirement.

## Screenshot Package

| Role | State | Viewport | Evidence |
|---|---|---|---|
| Employee | Three stages Saved | Desktop/mobile | `08_Screenshots/Desktop/01-employee-three-stages-saved.png`; mobile equivalent |
| Employee | Retry Required with preserved preview | Desktop/mobile | `08_Screenshots/Desktop/02-employee-retry-required-draft-preserved.png`; mobile equivalent |

The controlled screenshot index is `08_Screenshots/README.md`. Vendor/customer screenshots require a migrated, role-authenticated environment and remain in the manual demo.

## Known Limitations

- Additive migration is pending an approved deployment checkpoint.
- No beta deployment or live Product Owner replay was performed.
- Real Android/iOS camera and weak-network validation remains open.
- Full-suite inherited failures and dependency advisories remain release-hardening work.
- Customer/vendor role screenshots are not represented by browser mocks because doing so would bypass the server-side boundaries being tested.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

- Epic 1 permission lifecycle and Epic 4 canonical recording gate.
- Epic 3 database-derived role, membership, ownership, and IDOR protections.
- Three location selections, employee assignment, location evidence, and certification.
- Genuine optional reviews, Trust Score inputs, Public filtering, and admin authorization.

### Existing functionality intentionally unchanged

Permission requests, registration policy, authentication/session design, reviews, Trust Score, publication, AI, retention, deletion, disputes, and frozen documents were outside scope.

### Areas verified unaffected

| Area | Validation | Result |
|---|---|---|
| Authentication/authorization | Epic 3 focused regression and protected route tests | Pass |
| Permission and recording gate | Epic 1 and Epic 4 focused regression | Pass |
| Work records and assignment | Employee/vendor integration tests | Pass |
| Reviews and Trust Score | No-side-effect assertions and focused regression | Pass |
| Public/private access | Private-chain route tests and existing filtering regression | Pass |
| Storage/upload | MIME, duration, proxy, completion, status, and retry tests | Pass |
| Production routing | Production build | Pass |

### Potential regression risks reviewed

| Contract | Risk | Mitigation | Remaining exposure |
|---|---|---|---|
| Additive schema | Application mounted before migration | Migration-first deployment gate | Beta deployment pending |
| Private authorization | Incomplete chain accidentally visible | Central fail-closed `loadAuthorizedPrivateProof` | Legacy packages need deliberate treatment |
| Upload recovery | UI claims Saved before verification | Persisted attempt states and status route | Physical weak-network replay pending |
| Package approval | Partial state committed | One database transaction | Beta migration/replay pending |

### Known unrelated issues

The eight full-suite failures listed under Testing predate or concern untouched modules. They are documented rather than silently changed. Existing dependency advisories remain release-hardening work.

### Required closing declaration

`No known regression attributable to this epic remains after the executed validation.`

## Completion Decision

**Engineering status:** Complete and ready for Product Owner replay
**Product Owner approval:** Pending
**Next epic authorized:** No
