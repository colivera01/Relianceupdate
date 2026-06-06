# Reliance AI Phased Implementation Plan

Date: 2026-06-02

## Purpose

This document turns the current Reliance AI strategy into a phased implementation plan tied to the existing codebase.

It is intentionally conservative:

- Trust Score remains separate from customer reviews
- Trust Score keeps the current 4 measured topics and current weights
- AI assists operators and vendors; AI does not become the authority for Trust Score or final moderation decisions in Phase 1
- OpenAI usage should start with the smallest high-ROI workflows, not a broad platform rewrite

## Current Trust Score Position

Do not change the current Trust Score topics or weights right now.

Current implementation already matches the intended 4-part model:

1. Verified Workflow Completion Rate - 30%
2. Video Verification Success Rate - 25%
3. Dispute-Free Completion Rate - 30%
4. Operational Reliability Rate - 15%

Current source of truth:

- [src/lib/trust-score-calculator.ts](src/lib/trust-score-calculator.ts)
- [src/lib/trust-score-read.ts](src/lib/trust-score-read.ts)
- [src/lib/trust-score-outcome-foundation.ts](src/lib/trust-score-outcome-foundation.ts)

Important current behavior to preserve:

- Trust Score never reads from `Review`
- Trust Score only uses finalized outcomes
- pending moderation and pending disputes do not reduce score

Recommended later enhancement:

- Add a confidence / coverage layer for low-volume vendors
- Do not alter the 4 score topics just to add confidence handling

## Current Reliance Surfaces AI Can Reuse

The codebase already has strong integration points for AI assistance.

### Moderation

- Media moderation queue:
  - [src/app/api/admin/media/moderation-queue/route.ts](src/app/api/admin/media/moderation-queue/route.ts)
  - [src/lib/admin-media-moderation-queue.ts](src/lib/admin-media-moderation-queue.ts)
- Package moderation action:
  - [src/app/api/admin/media/packages/[bookingId]/moderate/route.ts](src/app/api/admin/media/packages/[bookingId]/moderate/route.ts)
- Review moderation queue:
  - [src/app/api/admin/reviews/moderation-queue/route.ts](src/app/api/admin/reviews/moderation-queue/route.ts)

### Disputes / reported content

- Reported content queue:
  - [src/app/api/admin/reported-content/route.ts](src/app/api/admin/reported-content/route.ts)
- Current Trust Score dispute bridge:
  - `resolved_action_taken` can become `VALIDATED_DISPUTE`

### Trust Score

- Calculation:
  - [src/lib/trust-score-calculator.ts](src/lib/trust-score-calculator.ts)
- Snapshot shaping:
  - [src/lib/trust-score-read.ts](src/lib/trust-score-read.ts)
- Admin read/recalc routes:
  - [src/app/api/admin/vendors/[vendorId]/trust-score/route.ts](src/app/api/admin/vendors/[vendorId]/trust-score/route.ts)
  - [src/app/api/admin/vendors/[vendorId]/trust-score/recalculate/route.ts](src/app/api/admin/vendors/[vendorId]/trust-score/recalculate/route.ts)

### Telemetry / device operations

- Vendor telemetry surface:
  - [src/app/vendor/telemetry/page.tsx](src/app/vendor/telemetry/page.tsx)
- Device event ingestion:
  - [src/lib/device-events.ts](src/lib/device-events.ts)
  - [src/app/api/device/events/route.ts](src/app/api/device/events/route.ts)

### Promotions / advertising

- Promotion rules and inventory:
  - [src/lib/promoted-listings.ts](src/lib/promoted-listings.ts)
- Admin promotion operations:
  - [src/app/api/admin/promoted-listings/route.ts](src/app/api/admin/promoted-listings/route.ts)
- Vendor promotion requests:
  - [src/app/api/vendor/promotion-requests/route.ts](src/app/api/vendor/promotion-requests/route.ts)

## Recommended AI Roadmap

Add a Phase 0 before Phase 1.

### Phase 0: AI Foundation

Goal: make Reliance safe and testable for AI work before any end-user AI feature ships.

Build:

1. OpenAI integration foundation
2. AI feature flags
3. AI request/response audit logging
4. Redaction and safe-input shaping
5. Strict structured output schemas
6. Eval fixtures for moderation and disputes
7. Admin-only rollout surfaces

Do not ship customer-facing AI in Phase 0.

### Phase 1: Highest ROI

1. AI Moderation Assistant
2. AI Dispute Summary Assistant

These two features have the clearest immediate operator value and best reuse of existing Reliance systems.

### Phase 2

1. Deterministic Trust Score explanations
2. AI Vendor Coach
3. Internal Support Assistant

### Phase 3

1. Fraud detection
2. Advertising optimization
3. Autonomous operations center concepts

## Model Recommendations

These recommendations assume new work uses the Responses API and structured outputs.

### 1. Moderation pre-filter

Use `omni-moderation-latest` for text and image safety classification.

Why:

- purpose-built moderation model
- multimodal
- free moderation endpoint

Use it only as an initial safety signal, not the full Reliance business-policy decision.

### 2. AI Moderation Assistant

Primary model:

- `gpt-5-mini`

Escalation model for difficult packages:

- `gpt-5.2`

Why:

- moderation assistant output needs structured triage, rationale, and consistent classification
- most package triage should be cost-sensitive
- high-severity or ambiguous cases can escalate

### 3. AI Dispute Summary Assistant

Primary:

- `gpt-5-mini`

Escalate when:

- high-value dispute
- many artifacts
- cross-surface inconsistency
- legal/safety sensitivity

Escalation:

- `gpt-5.2`

### 4. Trust Score explanations

Primary recommendation:

- start deterministic, not generative

The first explanation layer should come from existing Trust Score snapshot inputs. AI should not be the first explanation engine for this area.

If later expanded:

- `gpt-5-mini`

but only with tightly grounded inputs from the snapshot payload and no authority to alter score values.

### 5. Vendor coaching

Primary:

- `gpt-5-mini`

Escalation:

- `gpt-5.2`

Reason:

- this is insight generation from existing vendor metrics, not deep research

### 6. Advertising / promotions assistant

Copy, campaign explanation, and variants:

- `gpt-5-mini`

Later visual creative work:

- image generation can be considered later if there is real business demand

## OpenAI API Integration Recommendation

Use the Responses API for all new Reliance AI work.

Reasons:

- OpenAI recommends Responses for new projects
- easier path to structured outputs
- easier path to function calling
- clean fit for grounded tool-based workflows

Current OpenAI account setup completed locally:

- funded platform account
- dedicated project: `Reliance`
- local `.env.local` contains:
  - `OPENAI_PROJECT_ID`
  - `OPENAI_API_KEY`

## Proposed Architecture

### New foundation modules

Recommended new files:

- `src/lib/openai/client.ts`
- `src/lib/ai/feature-flags.ts`
- `src/lib/ai/redaction.ts`
- `src/lib/ai/schemas.ts`
- `src/lib/ai/audit.ts`
- `src/lib/ai/errors.ts`
- `src/lib/ai/moderation-assistant.ts`
- `src/lib/ai/dispute-summary.ts`

Recommended env additions for team-facing documentation later:

- `OPENAI_API_KEY`
- `OPENAI_PROJECT_ID`
- `OPENAI_MODEL_MODERATION_ASSISTANT`
- `OPENAI_MODEL_DISPUTE_ASSISTANT`
- `OPENAI_MODEL_VENDOR_COACH`
- `AI_ENABLED`
- `AI_MODERATION_ASSISTANT_ENABLED`
- `AI_DISPUTE_ASSISTANT_ENABLED`

### Audit and persistence recommendation

Before shipping any AI feature, add persistence for:

- input fingerprint
- model used
- feature name
- prompt version
- structured output
- operator override decision
- latency
- token usage
- failure reason

Prefer a dedicated AI audit table rather than only console logs.

Suggested schema additions later:

- `AiRun`
- `AiPromptVersion`
- `AiEvaluationCase`
- `AiEvaluationResult`

## Phase 0 Implementation Scope

Build this first.

### 0.1 OpenAI client

Add the official `openai` SDK and a small wrapper that:

- reads env safely
- enforces timeouts
- enforces model allow-lists
- centralizes error handling

### 0.2 Structured output schemas

For every AI decision, define JSON schema first.

Phase 1 schemas should include:

- `ModerationAssistantResult`
- `DisputeSummaryResult`

Example moderation output fields:

- `recommendedTier`
- `recommendedAction`
- `confidence`
- `policySignals`
- `humanReviewRequired`
- `vendorVisibleReason`
- `internalReason`

Example dispute summary output fields:

- `summary`
- `timeline`
- `evidenceConsidered`
- `openQuestions`
- `recommendedNextStep`
- `trustScoreImpactCandidate`

### 0.3 Redaction

Strip or minimize:

- unnecessary customer PII
- phone numbers
- email addresses
- exact street addresses
- unneeded raw account identifiers

Only send the minimum needed evidence to the model.

### 0.4 Feature flags

AI features must be:

- disabled by default in production until validated
- enabled first for admin-only routes

### 0.5 Eval harness

Create a small evaluation set from real Reliance-like cases:

- approved package
- obvious reject
- ambiguous package
- harassment report
- fraud report
- resolved no-action report
- validated dispute

Store expected outputs and compare drift over time.

## Phase 1A: AI Moderation Assistant

### Product role

AI should not auto-publish customer-visible content in the first release.

It should:

- analyze package metadata
- analyze moderation-relevant text context
- optionally analyze representative stage frames or image evidence when available
- recommend:
  - Tier 1: likely safe
  - Tier 2: review queue
  - Tier 3: escalate immediately

### Recommended Reliance integration points

Read path:

- [src/app/api/admin/media/moderation-queue/route.ts](src/app/api/admin/media/moderation-queue/route.ts)
- [src/lib/admin-media-moderation-queue.ts](src/lib/admin-media-moderation-queue.ts)

Action path:

- [src/app/api/admin/media/packages/[bookingId]/moderate/route.ts](src/app/api/admin/media/packages/[bookingId]/moderate/route.ts)

Suggested first implementation:

- add an admin-only `Analyze with AI` action
- return recommendation only
- admin still clicks final approve/reject/flag

### Phase 1A safety rule

AI may recommend.
Admin decides.

## Phase 1B: AI Dispute Summary Assistant

### Product role

Summarize evidence and operator context for reported content and finalized service issues.

The goal is speed and consistency, not autonomous resolution.

### Recommended Reliance integration points

- [src/app/api/admin/reported-content/route.ts](src/app/api/admin/reported-content/route.ts)
- [src/lib/trust-score-outcome-foundation.ts](src/lib/trust-score-outcome-foundation.ts)

Suggested output:

- concise summary
- evidence timeline
- disputed facts vs confirmed facts
- recommended operator next step
- whether the case appears likely to become:
  - no action
  - moderation action
  - validated dispute

### Phase 1B safety rule

AI may summarize evidence and suggest next actions.
AI may not directly finalize disputes.

## Trust Score AI Guidance

Do not let AI compute Trust Score.

Trust Score remains deterministic and code-owned:

- [src/lib/trust-score-calculator.ts](src/lib/trust-score-calculator.ts)

Near-term improvement path:

1. deterministic explanation from snapshot data
2. optional AI rewriting for readability later

If AI is used later for explanation, it must receive:

- current score
- component percentages
- component numerators/denominators
- improvement hints

It must not receive authority to infer hidden penalties or rewrite score math.

## Vendor Coach Recommendation

Do not build this before moderation assistant and dispute summary.

When Phase 2 starts, use existing vendor signals:

- Trust Score components
- moderation history
- completion patterns
- lateness
- dispute patterns
- telemetry reliability where meaningful

Coach outputs should be:

- concrete
- action-oriented
- non-punitive
- grounded in measurable vendor history

## Fraud Detection Recommendation

Do not make this an early build target.

Reliance needs more labeled events first.

Future fraud scoring can later combine:

- content report patterns
- dispute patterns
- repeated moderation failure
- booking anomalies
- device / telemetry anomalies

For now, capture the data cleanly rather than forcing an immature fraud model.

## Promotions / Advertising Recommendation

This is Phase 3 unless the business urgently needs ad-copy generation sooner.

Low-risk earlier use:

- admin-only campaign summary generation
- vendor-facing campaign copy suggestions
- campaign explanation text

Do not build autonomous budget allocation until real promotion volume exists.

## Security and Hardening Requirements

These are required before shipping any AI feature.

1. No raw OpenAI responses directly to end users without server validation
2. All AI outputs parsed through strict schema validation
3. Prompt versioning
4. Feature flags
5. Audit logging
6. Token/cost ceilings
7. Timeouts and graceful fallback
8. Minimal PII to model
9. Human override path
10. No Trust Score mutation by AI

## Validation and Regression Requirements

Every AI feature must pass:

### Unit tests

- schema parsing
- refusal handling
- malformed output handling
- redaction
- fallback behavior

### Integration tests

- route returns deterministic shape
- AI timeout produces safe fallback
- admin override still works
- Trust Score remains unchanged unless existing deterministic route changes it

### Evaluation tests

- stored sample cases
- expected recommendation bands
- false positive review
- false negative review

### Launch checks

- audit log written
- tokens tracked
- errors observable
- feature flag can disable instantly

## Recommended Immediate Next Step

Build only Phase 0 and Phase 1A first.

Recommended exact order:

1. add official OpenAI SDK and client wrapper
2. add AI feature flags and audit persistence
3. add structured schema layer
4. build AI Moderation Assistant on admin media moderation
5. validate and harden
6. then build AI Dispute Summary Assistant

Do not start with:

- Trust Score AI changes
- fraud detection
- advertising optimization
- customer-facing autonomous support

## Go / No-Go Summary

### Go now

- Phase 0 foundation
- AI Moderation Assistant
- AI Dispute Summary Assistant

### Wait

- Trust Score AI beyond explanations
- Vendor Coach
- Fraud Detection
- Advertising Optimization

### Preserve

- current Trust Score topics
- current Trust Score weights
- separation between Trust Score and customer reviews
