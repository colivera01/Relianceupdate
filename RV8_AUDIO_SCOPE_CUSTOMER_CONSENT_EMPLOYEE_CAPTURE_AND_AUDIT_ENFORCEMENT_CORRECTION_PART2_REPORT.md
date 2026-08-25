# RV-8 Audio Scope, Customer Consent, Employee Capture, and Audit Enforcement Correction - Part 2

## Root Cause

The prior V1 contract treated every Service Video as audio-off. Recording scope, permission evidence, employee capture constraints, durable media evidence, package construction, manager attestation, and Reliance Audit therefore had no single end-to-end field proving whether audio was approved and whether uploaded media actually conformed.

That left two risks when audio became a legitimate service-evidence requirement:

- enabling a microphone only in the browser would not bind customer permission or durable evidence to the audio choice;
- trusting client-declared media metadata would allow direct, stale, or malformed requests to bypass the approved scope.

Part 2 closes both gaps with a versioned package-wide audio contract and server-side inspection at the durable upload boundary.

## Final Audio Scope Model

New corrected-V1 assessments use recording-scope version 3. Audio is one package-wide boolean choice:

- `Video only` is the default and means audio is not authorized;
- `Video and audio` means audio is required as part of the complete three-stage Service Video evidence package.

The choice is included in the assessment generation, scope hash, permission content version, recording gate evidence, media-session contract, stage evidence, package evidence, manager attestation checks, Admin Audit checks, Private Proof, and package-level Public authorization.

The employee cannot choose or change audio independently for a stage.

## Vendor Audio Choice

Add Work Record and the material-edit workflow now present a plain-language package-wide audio question with `No - Video only` selected by default and `Yes - Video and audio` as the explicit alternative.

The Vendor View Job surface presents the selected audio scope as read-only lifecycle evidence. It does not expose a recording-time override.

## Permission Derivation

Permission request creation derives `audioAllowed` from the current canonical recording assessment, not from a caller-provided value or stale consent row. The resulting recording-permission content version distinguishes video-only from video-and-audio and is bound to the exact assessment generation and scope hash.

Customer Allow Recording therefore authorizes the exact disclosed audio scope. Existing expected-versus-claimed authority validation remains unchanged and fail-closed.

## Customer Audio Disclosure

The customer permission page now states either:

- audio will not be recorded; or
- sound is included because it is part of documenting the service, while conversations and unrelated private information must not be intentionally recorded.

The disclosure is rendered from canonical permission evidence. Customer acceptance cannot silently authorize a different audio scope.

## Material Audio-Scope Change

Changing video-only to video-and-audio, or the reverse, is an evidence-bearing material change.

After permission, the change:

- preserves prior evidence;
- supersedes the prior permission;
- invalidates stale employee certification;
- creates a new assessment generation and scope hash;
- requires a new customer permission request when customer permission applies;
- keeps recording locked until the new scope passes the normal canonical gates.

Once a stage has been durably saved, the audio contract cannot be rewritten in place. The edit fails with `AUDIO_SCOPE_LOCKED_AFTER_RECORDING`.

## Employee Audio Enforcement

The employee workspace clearly displays `Audio: Off` or `Audio: On - Customer approved`.

For video-only work, capture requests video without intentionally requesting microphone access. For audio-required work, capture requests microphone access and records the authorized audio in the same local draft used by Preview, Retake, and Confirm & Save.

No employee audio toggle exists. Session creation and upload initialization carry the canonical audio expectation, and stale sessions whose scope no longer matches are rejected.

## Device Permission Behavior

Video-only capture does not request microphone permission. Audio-required capture requests microphone permission; a denial or unavailable audio track fails closed with a clear recording error instead of silently producing video-only evidence.

The live camera preview remains muted to avoid feedback. The recorded local preview preserves authorized sound so the employee can intentionally review the actual draft before saving.

## Actual Audio Detection

The durable upload-completion boundary downloads the exact uploaded blob and inspects its container. The parser supports the application capture formats used by MP4/QuickTime and WebM/Matroska, including unknown-length EBML containers.

It records `PRESENT`, `ABSENT`, or an unverifiable result with track count, codec when available, detection method, evidence version, and detection timestamp.

The server rejects:

- video-only media that contains audio;
- audio-required media with no audio track;
- audio-required media whose audio presence cannot be authoritatively verified.

The server does not strip audio, infer conformity from the UI, or trust caller-declared metadata.

## Media Evidence Binding

Audio expectation and detected presence are persisted across upload attempts, media sessions, media assets, stage evidence, and package evidence. Package construction includes the exact audio contract and stage conformance in the package hash/version evidence.

Upload size, duration, content identity, duplicate protection, exact stage versioning, and existing hash protections remain in force. A blocked mismatch is rejected before stage evidence or an accepted package mutation becomes durable.

## Manager Review

Manager review displays the approved package audio scope and each stage's detected audio state.

Submission to Reliance Audit revalidates the exact current gate evidence, media asset, stage evidence, and package audio contract. A package with unauthorized audio, missing required audio, unverifiable required audio, or stale audio scope cannot be attested or submitted.

## Reliance Admin Audio Audit

The Reliance Audit queue and candidate view expose the approved package audio scope and each submitted stage's detected audio state.

Admin PASS independently revalidates audio conformance. An authorized audio package can PASS; unauthorized audio, missing required audio, or unverifiable required audio cannot PASS. The existing `PRIVACY_OR_SCOPE` rejection category remains appropriate, so no parallel category was introduced.

## Admin REJECT Behavior

Admin REJECT remains the existing terminal Core Audit decision. This correction does not reopen rerecording, correction, replacement, retry, or resubmission after rejection and does not change the approved notification or terminal evidence behavior.

## Customer Private Proof With Audio

Admin PASS still releases the exact Admin-approved complete package as customer Private Proof. When that exact package contains authorized audio, Private Proof plays the same media asset with its audio; no derivative, mute operation, or replacement package is created.

Exact package ID/version/hash and exact stage identity/version/hash binding remain required.

## Keep Private

`Keep Private` retains the exact approved package, including authorized audio, as customer-private evidence. It creates no Public proposal and changes no media.

No customer visibility action also remains Private by default.

## Share Publicly With Audio

When the exact Admin-approved package contains audio, `Share Publicly` requires an additional affirmative confirmation explaining that the approved video and audio may become publicly viewable only if Reliance Public review later approves it.

The confirmation and proposal bind to the exact audio-containing package and exact three stage hashes. Partial-stage authorization and muted or edited derivatives are not created.

## Public Moderation Boundary

Core Reliance Audit, the customer's package-level visibility choice, and Public publication moderation remain separate decisions and evidence chains.

Admin PASS does not make media Public. Customer authorization does not bypass Public moderation. Existing Public eligibility continues to require the exact Admin-passed package, active matching Private Proof grant, affirmative package-level customer authorization, and the remaining canonical publication evidence.

## Vendor View Job

Vendor detail now includes a concise recording-scope summary with package audio scope and read-only stage audio evidence where available. The vendor can inspect the contract but cannot alter audio during recording or select a Public subset.

Part 1 lifecycle priority, package-level visibility, and read-only customer visibility presentation remain intact.

## Privacy & Governance

Part 2 does not remove or weaken withdrawal, concern reporting, deletion request, retention, legal hold, or other privacy-governance behavior. The dedicated role-appropriate governance surface established in Part 1 remains unchanged.

Audio is authorized only through the disclosed customer permission contract and is rejected when it exceeds that contract.

## Historical Compatibility

Historical content and evidence are not rewritten. Version-aware behavior treats existing audio-off records as the legacy video-only contract, accepts their `LEGACY_UNKNOWN` audio-presence evidence where that original contract permits it, and keeps old permission copy and Decide Later behavior scoped to its original content version.

New version-3 packages must provide the stronger audio evidence and cannot downgrade to the historical compatibility path.

## Current Journey 1 Compatibility

Journey 1 record `cmt84a5yi0001qifh115sk2zs` remains valid as historical video-only/audio-off evidence and can continue through Reliance Audit after an eventual approved deployment and migration.

Part 2 performed no beta runtime action and did not query with or obtain a writable beta database connection. The latest live read-only reconciliation, captured in the Part 1 report, remains the authoritative runtime baseline: `AWAITING_ADMIN_REVIEW`, exact manager attestation and submitted package intact, zero Admin decisions, zero Private Proof grants, zero customer video-ready notifications, and zero Public proposals/media/approvals. No Part 2 action advanced or mutated the record.

Historical-compatibility and Admin Audit regression coverage confirms that the additive defaults (`audioExpected = false`, legacy unknown stage/asset presence, and legacy video-only package conformance) preserve this record's existing contract rather than requiring evidence rewriting.

## Migration

- Part 1 migration `20260825190000_add_package_visibility_decisions` is unchanged and was not applied.
- Part 2 adds `20260825213000_add_service_video_audio_evidence`.
- The Part 2 migration additively stores audio contract and detection evidence on gate decisions, sessions, upload attempts, assets, stages, and packages, with historical video-only defaults and targeted indexes.
- No migration was applied to beta or any other database.
- No seed, reset, backfill, or historical evidence rewrite was performed.

## Trust Score

Trust Score formulas, weights, penalties, recalculation, evidence processing, and UI were unchanged.

## Files Changed

The correction changes 48 files before this report, grouped as follows:

- Prisma schema and one additive Part 2 migration;
- recording assessment, permission content/request/decision, material edit, and canonical gate logic;
- employee job payload and capture UI;
- media session, upload initialization, durable upload completion, container audio inspection, and evidence/package construction;
- manager submission, Reliance Audit candidate/PASS validation, and Admin presentation;
- customer package visibility confirmation and Vendor detail presentation;
- focused unit, integration, contract, route, and Playwright regression coverage.

Key new files are:

- `prisma/migrations/20260825213000_add_service_video_audio_evidence/migration.sql`
- `src/lib/server-video-audio.ts`
- `src/lib/server-video-audio.test.ts`
- `src/lib/service-video-audio-capture.ts`
- `src/lib/service-video-audio-capture.test.ts`
- `src/lib/consent/content-version.test.ts`

## Validation

- Focused broad Part 2 regression: **213 passed** across 39 files.
- Focused compatibility regression: **33 passed** across 4 files.
- Additional Admin/evidence/material-change regression runs: **43 passed**.
- Full Vitest repository suite: **1,103 passed** across 219 files.
- Playwright package visibility: **3 passed**.
- Playwright Vendor/Product Owner replay coverage: **12 passed**.
- Playwright customer permission/audio disclosure: **10 passed** after correcting an obsolete historical copy assertion.
- Playwright employee Audio Off and Audio On presentation: **passed**.
- Playwright microphone-denied fail-closed behavior: **passed**.
- TypeScript `tsc --noEmit --incremental false`: **PASS**.
- Prisma `validate`: **PASS**.
- Prisma `generate`: **PASS**.
- Production `next build`: **PASS**.
- `git diff --check`: **PASS**.

Playwright used intercepted/local fixture behavior and did not create destructive shared-beta data. No physical-device result is claimed. Build output contained only expected local missing-service warnings and the known non-blocking Windows standalone trace symlink warning after successful compilation and static generation.

## Git

- Isolated working branch: `codex/rv8-package-visibility-part1-work`
- Target branch: `codex/rv8-residence-location-correction`
- Starting commit: `d01909920b35b76827b9714f6be3135f050f862e`
- Final commit: this report's scoped Part 2 commit; the exact hash is reported in the completion response because a commit cannot contain its own final hash
- Push status, remote match, and final worktree status: reported in the completion response after commit and remote verification

## Deployment

Deployment was **NOT performed**. Neither migration was applied. No beta App Setting, record, package, evidence row, notification, permission, media asset, Public proposal, or Trust Score state was changed.

## Next Recommended Action

Stop for Product Owner review of Part 2. After code and migration review, authorize a separate controlled deployment checkpoint if approved.

Do not deploy during this correction. Do not Admin PASS or REJECT Journey 1. Do not begin Journey 2, RV-9, or Epic 8.
