# Reliance Audit Standard

Date: 2026-06-02

## Purpose

This document defines the minimum audit standard for Reliance product changes.

The goal is simple: a task is not done just because code compiles or a test passes. It also has to behave correctly for the person actually using the platform.

## Required Validation Layers

Every meaningful product change should be checked across all applicable layers:

1. Code validation
- TypeScript passes
- relevant unit/integration tests pass
- no obvious regressions in the touched files

2. Route and API validation
- touched routes return the expected status codes
- error states are truthful and recoverable where appropriate
- real data shape matches the UI's expectations

3. Real browser-path validation
- click through the feature like a real user would
- confirm the page is discoverable from the role that needs it
- confirm visible labels, buttons, links, and helper copy make sense
- fill fields and submit actions when the flow includes forms
- verify the resulting page state, saved data, and follow-up surfaces

This browser-path check is required for the role that actually uses the feature:
- admin
- vendor
- customer
- employee when relevant

## Done Criteria

Do not mark a slice done unless all applicable checks below are true:

- the feature is visible where a real user would expect to find it
- the click path works, not just the direct URL
- the rendered page looks coherent and complete
- the data shown is the right data for that role
- success and failure states both read cleanly
- downstream pages update correctly after the action

## Audit Notes

- If browser-path validation catches an issue that code/tests missed, fix the product first and then keep the browser check as part of the final verification.
- If a route is admin- or vendor-only, test both:
  - authorized experience
  - unauthorized experience
- If a feature depends on real-world constraints that are not live yet, document the limitation clearly instead of pretending the workflow is fully ready.

## Current Working Rule

For Reliance, "tested" now means:

- code/test validation
- regression checks
- real browser validation from the relevant role perspective

That is the standard to use for future audits, launch-readiness checks, and feature hardening.
