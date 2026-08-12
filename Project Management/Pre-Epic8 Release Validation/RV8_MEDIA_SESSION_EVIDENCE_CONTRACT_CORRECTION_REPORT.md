# RV-8 Media Session Evidence Contract Correction Report

## Scope

This checkpoint corrects only the RV-8 media-session creation failure observed after the physical Android Starting Condition capture. RV-8 remains paused until the corrected package is validated and deployed. RV-9 and Epic 8 were not started.

## Root Cause

`persistAllowedRecordingGateDecision` built a canonical runtime snapshot containing `audioAllowed: false` and spread the entire snapshot into `RecordingGateDecisionEvidence.create`. The approved Prisma model does not define a top-level `audioAllowed` column, so the real Prisma client rejected the unsupported property and rolled back the media-session transaction.

The earlier media-session mock accepted arbitrary objects and therefore did not enforce the generated Prisma create-data contract.

## Approved Model Decision

The governing design requires audio to remain off by default. It does not require a second standalone `audioAllowed` column on `RecordingGateDecisionEvidence`.

The current evidence design already preserves the audio decision in two durable places:

1. `RecordingScopeAssessment.audioRequested` and `RecordingScopeAssessment.audioAllowed` are typed durable fields tied to the assessment generation and `scopeHash`.
2. `RecordingGateDecisionEvidence.snapshotJson` is immutable, hashed by `evidenceHash`, and records `audioAllowed: false` for the exact allowed gate decision.

The canonical server gate independently returns `audioAllowed: false` and blocks recording with `AUDIO_NOT_SUPPORTED` if an assessment requests or allows audio. Removing the unsupported top-level create property therefore fixes the contract without weakening audio enforcement or losing durable evidence.

No schema change or migration is appropriate for this correction.

## Files Changed

| File | Change |
|---|---|
| `src/lib/service-video-evidence.ts` | Replaced the broad snapshot spread with an explicit Prisma create payload containing only generated-model fields. The immutable snapshot still includes `audioAllowed: false`. |
| `src/lib/service-video-evidence.contract.test.ts` | Added a generated-Prisma-model contract test that rejects unsupported create fields and verifies audio-off remains in `snapshotJson`. |
| `src/lib/consent/canonical-recording-gate.test.ts` | Added a regression proving an assessment that requests or allows audio remains locked with `AUDIO_NOT_SUPPORTED`. |
| `src/app/api/vendors/[vendorId]/media/sessions/media-sessions-consent.integration.test.ts` | Made location fixtures conform to the previously approved immutable location-snapshot contract and replaced obsolete recording-time geocoding expectations with fail-closed assertions. |
| `src/app/api/employee/jobs/[jobId]/recording-certification/recording-certification.integration.test.ts` | Added the required immutable vendor-business location snapshot to the existing certification fixture. |

## Exact Payload Correction

The Prisma create data is now constructed explicitly from the canonical gate decision:

- booking, vendor, assessment, and assessment generation;
- scope hash;
- permission basis and evidence identifiers;
- employee certification and membership;
- assignment generation;
- location attempt or approved exception;
- surface, actor kind, and `ALLOWED` decision;
- immutable snapshot JSON and its SHA-256 evidence hash.

`audioAllowed` is not sent as an unsupported top-level Prisma property. It remains present as `false` inside the immutable hashed snapshot.

## Regression-Test Improvement

The new contract test derives the allowed field names from `Prisma.dmmf.datamodel.models` for `RecordingGateDecisionEvidence`. The test fails if any unsupported property is passed to `create`, including a future broad object spread that reintroduces this defect.

The successful media-session integration path runs with a deliberately narrow mocked Prisma surface. It creates only the required media session and gate evidence; it has no review, rating, Trust Score, publication, public-media, or customer-access model path.

## Validation Results

| Validation | Result |
|---|---|
| Focused contract, gate, and media-session tests | Passed: 23/23 |
| Epic 4/5 affected regression package | Passed: 73/73 across 14 files |
| Prisma validate | Passed |
| Prisma generate | Passed, Prisma Client 6.19.0 |
| TypeScript | Passed |
| Production build with 6 GB heap in the prepared validation worktree | Passed, Next.js 15.5.21; 205 generated App Router entries plus `/support` and `/notifications` |
| Fresh detached packaging worktree at correction commit `813204a717772cd3865340ae2678c909db234250` | `npm ci` passed; the clean production build compiled application source, then failed type checking because active source imports undeclared `@radix-ui/react-toast` |
| `git diff --check` | Passed; line-ending conversion notices only |

One unrelated existing assertion in `src/lib/employee-stage-capture.test.ts` expects `Paired phone` while the untouched implementation returns `This phone`. That file is unchanged by this checkpoint and is not part of the media-session contract correction.

## Behavior and Data Impact

- The transaction boundary is unchanged.
- Recording remains fail-closed unless the canonical gate is allowed.
- Audio remains off and cannot be enabled by this correction.
- No database schema or migration changed.
- No review, rating, Trust Score input, publication proposal, public eligibility, Public media, customer-access grant, or duplicate media session is created by this correction.
- Location verification, permission authority, employee certification, and assignment checks remain unchanged.

## Deployment Status

The correction was committed as `813204a717772cd3865340ae2678c909db234250` with message `fix: correct recording gate evidence payload` and pushed to `origin/codex/rv8-residence-location-correction`.

Deployment is blocked by a separate clean-build reproducibility defect discovered while building the required deterministic package. `src/components/ui/toast.tsx` imports `@radix-ui/react-toast`, but the package is absent from both `package.json` and `package-lock.json`; `npm ls @radix-ui/react-toast --depth=0` is empty after a clean `npm ci`. The build therefore stops with `Cannot find module '@radix-ui/react-toast' or its corresponding type declarations`.

No ZIP was assembled, uploaded, or mounted, and beta was not changed. Under the mandatory stop rule, this checkpoint cannot add the missing dependency without separate Product Owner approval. RV-8 remains paused, and RV-9 and Epic 8 have not begun.
