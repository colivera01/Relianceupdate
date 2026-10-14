---
content_key: reliance.retention-and-disposition-policy
content_class: POLICY
audience_role: INTERNAL_AND_ALL_USERS
version: reliance-retention-2026-10-13-draft.3
supersedes_version: reliance-retention-2026-10-12-draft.2
governance_status: DRAFT
review_state: PRODUCT_OWNER_REVIEW
runtime_effective: false
counsel_approved: false
language: en-US
---
# DRAFT / PRODUCT OWNER REVIEW

> Not effective. Not counsel-approved. These are intended targets, not live deletion promises. No scheduler, lifecycle worker, retention date, or deletion behavior is activated by this draft.

## PROSPECTIVE USER-FACING COPY
<!-- BEGIN PROSPECTIVE USER-FACING COPY -->
# Reliance Retention and Disposition Policy

Reliance retains personal information and evidence only as long as reasonably needed for the authorized purpose, security, auditability, disputes, legal obligations, and enforcement.

Historical consent, assent, audit, visibility, report, and case evidence is not rewritten to make a newer policy appear retroactive. Removing media does not necessarily remove the minimum evidence needed to prove what was authorized and what Reliance did.

## Intended retention targets

The intended targets are:

| Information class | Intended target |
| --- | --- |
| Private Service Video media | Approximately 12 months |
| Minimum consent, assent, assessment, package, audit, visibility, report, and case evidence | At least 7 years |
| Raw precise-location values | Approximately 30 days |
| Security and operational logs | A documented period proportionate to detection, investigation, and platform reliability |
| Support and privacy cases | The case lifecycle plus a documented evidence period |
| Public Service Video media | While current Public authorization and all required dependencies remain valid, plus controlled removal and backup transition time |
| Transactional communication evidence | As needed for delivery, suppression, disputes, and compliance |

The exact lifecycle event that starts each period will be defined by the final versioned retention schedule after operational validation. Valid legal holds, reports, disputes, security needs, active cases, Public dependencies, restoration requirements, and other legal or contractual duties may require longer preservation.

Making a Service Video Private stops controlled Public access but does not remove copies made outside Reliance. Raw one-time codes are not retained as consent evidence.

## Minimum evidence after media removal

Where lawful and necessary, Reliance may retain identifiers, hashes, stage/package relationships, decision snapshots, policy versions, audit outcomes, visibility history, reports, and disposition evidence after raw media or location values are removed. Reliance limits the remaining record to what is needed to prove integrity and respond to a dispute.

## Historical evidence archives

Evidence archives are private, access-controlled, integrity-verified, and excluded from ordinary application use. A retention review date is not automatic deletion authorization. Archived evidence requires a future authorized disposition.
<!-- END PROSPECTIVE USER-FACING COPY -->

## INTERNAL ACTIVATION NOTES - NOT USER-FACING
<!-- BEGIN INTERNAL ACTIVATION NOTES -->
- The 12-month, minimum 7-year, and approximately 30-day periods are Product Owner targets only. Their exact lifecycle triggers remain a separate Product Owner decision after operational validation.
- Before activation, map every stored object/provider copy to an information class and authoritative record.
- An irreversible disposition may occur only after validated guards, a dry run and review, legal-hold checks, current-state/evidence-chain validation, and creation of an immutable disposition receipt. Archive or hold steps may be reversible where designed; irreversible deletion is not described as reversible.
- Workers must be idempotent and observable, use bounded retries, propagate appropriately to providers/backups, and never report silent success.
- The disposition receipt must record class, reason, rule version, source identity, action, timestamp, and integrity evidence without recreating deleted sensitive content.
- Implement monitoring, exception queues, access controls, human approval for exceptional deletion, and restoration tests that do not revive expired Public access or invalidate evidence history.
- Complete provider/storage inventory, counsel review, and Product Owner approval of final periods/triggers before activation. Do not backfill a new meaning onto historical evidence.
- This internal section is excluded from the accepted text snapshot. No lifecycle schedule is active.
<!-- END INTERNAL ACTIVATION NOTES -->
