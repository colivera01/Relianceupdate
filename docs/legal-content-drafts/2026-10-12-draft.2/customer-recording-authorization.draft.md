---
content_key: reliance.customer-recording-authorization
content_class: POLICY
audience_role: CUSTOMER
version: reliance-customer-recording-authorization-2026-10-12-draft.2
supersedes_version: reliance-customer-recording-authorization-2026-10-12-draft.1
governance_status: DRAFT
review_state: PRODUCT_OWNER_REVIEW
runtime_effective: false
counsel_approved: false
language: en-US
---
# DRAFT / PRODUCT OWNER REVIEW

> Not effective. Not counsel-approved. This draft does not change the current Customer recording authorization screen or any historical decision.

## PROSPECTIVE USER-FACING COPY
<!-- BEGIN PROSPECTIVE USER-FACING COPY -->
# Allow Reliance recording for this service?

## Recording request

- **Service:** [service]
- **Vendor:** [Vendor]
- **Location:** [service location or location category]
- **Recording boundary:** [boundary]
- **Intentional participant roles:** [roles, such as Assigned Service Professional]
- **Audio:** [included or not included]
- **Purpose:** [recording purpose]
- **Stages:** Starting Condition, Work in Progress, and Final Result

The Service Video is intended to document the service in three short stages and provide a Private Proof record after Reliance Audit. It does not certify workmanship, safety, code compliance, licensure, or professional quality.

Your choice controls recording for the exact scope shown. It does not decide whether any Employee personally agrees to be recorded, and it does not make the finished Service Video Public. If recording is allowed, each required Employee must separately decide whether to participate. An approved Service Video remains Private unless you later make a separate exact-package Share Publicly choice and all other Public requirements are satisfied.

If audio is included, recording must not begin until all legally required parties have authorized it. No minors, unrelated adults, bystanders, unrelated private conversations, private documents or screens, credentials, access codes, or security information should be captured.

## Allow recording

**Choice label:** Allow recording

**Decision text:** I authorize Reliance recording for this Work Record within the exact location, boundary, intentional participant roles, audio setting, purpose, and three recording stages shown. I understand that required Employees decide separately whether they personally participate and that this authorization does not make the Service Video Public.

**Confirmation button:** Confirm Allow Recording

## Decline recording

**Choice label:** Decline recording

**Decision text:** I do not authorize Reliance recording for the exact Work Record and recording scope shown. Reliance recording must remain blocked. I understand this choice concerns the Reliance recording workflow and does not by itself state whether the underlying real-world service is canceled.

**Confirmation button:** Confirm Decline Recording

## This request is not for me

**Choice label:** This request is not for me

**Decision text:** I am not the correct person or do not have authority to answer this recording request. I am asking Reliance to correct the recipient or authority record. I am not allowing or declining recording.

**Confirmation button:** Report Wrong Recipient

This choice is different from Decline. It does not authorize or refuse recording and does not cancel the service.

## No passive authorization

Closing the page, leaving the page, or taking no action does not authorize recording. Until a valid current choice exists, recording remains blocked.

## Changes and withdrawal

If the displayed recording scope materially changes, Reliance will present a new request. A prior choice does not authorize the replacement scope. A verified prospective withdrawal stops new recording that depends on the withdrawn authorization, while preserving historical evidence and any separately authorized existing Private Proof.
<!-- END PROSPECTIVE USER-FACING COPY -->

## INTERNAL ACTIVATION NOTES - NOT USER-FACING
<!-- BEGIN INTERNAL ACTIVATION NOTES -->
- The display and submitted decision must resolve to the same current Work Record, assessment ID/generation, and server-computed scope hash. Internal identifiers need not be displayed.
- Material fields include location category, boundary, intentional participant roles, audio mode, purpose, and other disclosed scope. A material change creates a new assessment.
- Preserve verified Customer principal and authority context, Work Record, assessment/generation, scope hash, decision, timestamp, exact publishable snapshot/version/hash, verification method, and immutable evidence hash.
- Never store raw bearer tokens or OTPs as consent evidence.
- Keep Allow, Decline, and Not-for-Me distinct. Not-for-Me cannot count as authorization, refusal, or cancellation.
- Decide Later is retired as a recording-consent decision and remains an activation blocker in current runtime. Remove or retire the remaining runtime action only under separate authorization, without rewriting historical evidence.
- Reconcile current Work Record decline consequences, provide a durable receipt and withdrawal path, and obtain Product Owner/counsel approval before activation.
- This internal section is excluded from the accepted text snapshot.
<!-- END INTERNAL ACTIVATION NOTES -->
