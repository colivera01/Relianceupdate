---
content_key: reliance.retention-and-disposition-policy
content_class: POLICY
audience_role: INTERNAL_AND_ALL_USERS
version: reliance-retention-2026-10-12-draft.1
governance_status: DRAFT
review_state: PRODUCT_OWNER_REVIEW
runtime_effective: false
counsel_approved: false
language: en-US
---
# DRAFT / PRODUCT OWNER REVIEW

> Not effective. Not counsel-approved. The periods below are intended targets, not live deletion promises. No scheduler, lifecycle worker, retention date, or deletion behavior is activated by this draft.

# Reliance Retention and Disposition Policy

## Principles

Reliance should retain personal information and evidence only as long as reasonably needed for the authorized purpose, security, auditability, disputes, legal obligations, and enforcement. Disposition must be verifiable, scoped, reversible where required by a guard, and blocked by a valid legal hold or unresolved dependency.

Historical consent, assent, audit, visibility, report, and case evidence must not be rewritten to make a newer policy appear retroactive. Deleting media does not necessarily permit deletion of the minimum evidence required to prove what was authorized and what Reliance did.

## Intended targets

These targets require operational proof before they may become effective commitments:

| Information class | Intended target | Conditions and exceptions |
| --- | --- | --- |
| Private Service Video media | About 12 months after the relevant Private Proof lifecycle closes | Longer if Public, reported, disputed, on legal hold, needed for an active case, or otherwise required by law or contract. |
| Minimum consent, assent, assessment, package, audit, visibility, report, and case evidence | About 7 years after the relevant relationship or record closes | Preserve exact text/version/hash, actor/context, decision, timestamps, chain history, and evidence necessary to interpret the record. |
| Raw precise-location values | About 30 days after the needed stage evidence is derived and verified | Preserve the minimum derived evidence and integrity proof; extend only for security, dispute, legal hold, or legal duty. |
| Security and operational logs | A documented period proportionate to detection, investigation, and platform reliability | Minimize personal data and restrict access. Different logs may require different periods. |
| Support and privacy cases | For the case lifecycle plus a documented evidence period | Preserve request, verification class, actions, notices, exceptions, outcome, and legal holds. |
| Public Service Video media | While current Public authorization and all dependencies remain valid, plus controlled removal/backup transition time | Making Private stops controlled Public access but does not remove outside copies. Private/evidence retention rules then apply. |
| Transactional communication evidence | For delivery, suppression, dispute, and compliance needs | Do not retain raw OTPs as consent evidence. Preserve opt-out and delivery history as needed. |

## Required lifecycle controls

Before activation, Reliance should implement and prove:

1. An inventory mapping each stored object and provider copy to an information class and authoritative record.
2. A dry-run report that identifies eligible items without changing them.
3. Legal-hold, report, dispute, security-incident, active-Public, and restoration guards.
4. Current-state and evidence-chain validation immediately before disposition.
5. Idempotent, observable workers with bounded retries and no silent success.
6. Provider and backup propagation appropriate to the system.
7. An immutable disposition receipt containing class, reason, rule version, source identity, action, timestamp, and integrity evidence, without recreating deleted sensitive content.
8. Monitoring, exception queues, access controls, and human approval for exceptional deletion.
9. Tested restoration and disaster-recovery behavior that does not silently revive expired Public access or invalidate evidence history.

## Minimum evidence after media deletion

Where lawful and necessary, Reliance may retain identifiers, hashes, stage/package relationships, decision snapshots, policy versions, audit outcomes, visibility history, reports, and disposition evidence after raw media or location values are removed. The remaining record should not contain more sensitive content than needed to prove integrity and respond to a dispute.

## Archive and historical evidence

Evidence archives must be private, access-controlled, integrity-hashed, tagged with purpose and review date, and excluded from ordinary application use. A retention review date is not automatic deletion authorization. Archived evidence requires a future explicit authorized disposition.

## Activation dependencies

- Complete current provider/storage inventory and data-class mapping.
- Proven worker, dry-run, guard, receipt, monitoring, and restoration controls.
- Attorney review of legal holds, limitation periods, employment evidence, consumer requests, and contractual obligations.
- Product Owner approval of final periods after operational testing.
- No backfill that changes historical evidence meaning.
