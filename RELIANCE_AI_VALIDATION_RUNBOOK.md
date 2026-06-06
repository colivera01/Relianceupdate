# Reliance AI Validation Runbook

Date: 2026-06-02

## Purpose

This runbook is the operational gate for Reliance AI changes.

Use it whenever any of these change:

- AI prompt text
- OpenAI model selection
- output schema fields
- moderation/dispute/coaching normalization rules
- AI route behavior
- feature-flag rollout scope

Do not treat a prompt-only change as "too small to test." Prompt changes can still regress recommendation quality.

## Current AI Surface Area

The saved baseline currently covers:

1. AI Moderation Assistant
2. AI Dispute Summary Assistant
3. Optional AI Vendor Coaching Summary

Trust Score math is intentionally out of scope.

- The 4-part Trust Score stays deterministic.
- AI can explain or coach.
- AI does not calculate or override score values.

## Commands

### 1. Fast failure-state smoke

Use this when you want a quick route-level check:

```bash
npm run test:ai:smoke
```

What it proves:

- the AI routes still respond with the correct shaped success or failure contract
- transient DB outages return a truthful retryable `503`
- the app does not collapse into a vague `500`

This is useful, but it is not the release gate.

### 2. Focused AI test suite

Use this when you want the deterministic local checks only:

```bash
npm run test:ai:focused
```

What it covers:

- output guards
- moderation normalization rules
- dispute confidence controls
- vendor coaching summary contracts
- AI eval matcher behavior
- route-level AI tests

### 3. Full AI gate

This is the command to use before merging AI changes:

```bash
npm run test:ai:gate
```

It runs:

1. `npm run test:ai:focused`
2. `npx tsc --noEmit --pretty false --incremental false`
3. `npm run test:ai:evals`

### 4. Saved live eval baseline

You can also run the saved baseline directly:

```bash
npm run test:ai:evals
```

Current baseline cases:

- 3 live moderation cases
- 1 temporary privacy dispute case that auto-dismisses after evaluation
- 1 vendor coaching case

## Expected Pass Criteria

`npm run test:ai:gate` should finish green.

The current live baseline expectation is:

- moderation cases normalize to conservative human-review outcomes when evidence is ambiguous
- dispute thin-evidence cases do not overclaim confidence
- vendor coaching stays advisory and grounded

## How To Interpret Failures

### If `test:ai:focused` fails

Treat this as a code or contract regression first.

Common causes:

- schema drift
- prompt-output mismatch
- removed guardrails
- normalization logic drift
- route response shape changes

Do not move on to prompt tuning until the local contract is green again.

### If `tsc` fails

Treat this as a release blocker.

Even if the AI output itself looks good, type drift means the product surface is no longer trustworthy.

### If `test:ai:evals` fails

Treat this as a quality regression unless proven otherwise.

Work through it in this order:

1. Check whether the failure came from Azure SQL availability rather than AI quality.
2. If infra is healthy, compare the new output to the saved acceptance criteria.
3. Decide whether the model/prompt changed in a way that is actually better or whether quality drift occurred.
4. If the new behavior is intentionally better, update the eval fixture carefully and document why.

Do not loosen evals just to get back to green.

## When It Is Acceptable To Update The Saved Baseline

Update the saved baseline only when:

- the new behavior is clearly better
- the change is intentional
- the rationale is written down
- the route still stays conservative about limited evidence

Examples of acceptable updates:

- reducing overconfident moderation confidence on ambiguous metadata
- downgrading thin-evidence dispute certainty
- improving vendor coaching grounding without changing Trust Score math

## Release Rules

Before enabling broader AI rollout:

1. `npm run test:ai:gate` is green
2. feature flags remain intentional
3. no Trust Score math changed
4. outputs remain advisory only
5. a human can still override every AI recommendation

## Notes

- `scripts/dev/ai-admin-smoke.cjs` is primarily a route-hardening check.
- `scripts/dev/ai-admin-evals.ts` is the saved live quality baseline.
- If Azure SQL is unstable, rerun once after recovery before calling a quality regression.
