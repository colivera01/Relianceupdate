# Reliance Current Consent, Privacy, and Recording Audit

Audit date: 2026-07-30

This folder documents the current Reliance implementation for account agreement, customer consent, employee recording, location verification, staged video capture and upload, moderation, publication, notifications, reviews, retention, deletion, and related privacy controls.

This is a current-state implementation audit. It does not provide legal advice, rewrite legal terms, change database records, or change production behavior. No existing application file was modified to produce it.

## Primary documents

- [RELIANCE_CURRENT_CONSENT_PRIVACY_AND_RECORDING_AUDIT.md](./RELIANCE_CURRENT_CONSENT_PRIVACY_AND_RECORDING_AUDIT.md) contains the findings, user journeys, gap matrix, unknowns, and current-state verdict.
- [evidence-index.md](./evidence-index.md) identifies the repository evidence reviewed and how each source was used.
- [source-snapshots](./source-snapshots/) contains readable, labeled excerpts of the most important current materials.

## Source-of-truth rule

Only the current executable implementation is authoritative for this audit: active application code, routes, React components, API endpoints, middleware, configuration use, database schema, storage logic, notification logic, and current rendered UI.

Historical conversations, archived specifications, planning documents, prototypes, TODOs, and prior design concepts are not evidence of current behavior. If documentation conflicts with executable code, the implementation wins.

## Finding classifications

Every numbered finding in the primary report uses exactly one of these labels:

- **CURRENT IMPLEMENTATION**: behavior is present in current executable code and is enforced or rendered.
- **PARTIALLY IMPLEMENTED**: part of the workflow exists, but it is incomplete, unenforced, mocked, or disconnected.
- **DOCUMENTED BUT NOT IMPLEMENTED**: a statement exists in current rendered policy or interface text without corresponding implementation, or only in non-executable material.
- **HISTORICAL / OBSOLETE**: an older behavior has clearly been replaced or removed and is excluded from the current baseline.

When repository evidence cannot establish a behavior, the report says: **Unable to verify in the current implementation.**

Live provider settings, production records, cloud-console configuration, contracts held outside the repository, and legal sufficiency require separate verification.
