---
content_key: reliance.customer-recording-authorization
content_class: POLICY
audience_role: CUSTOMER
version: reliance-customer-recording-authorization-2026-10-12-draft.1
governance_status: DRAFT
review_state: PRODUCT_OWNER_REVIEW
runtime_effective: false
counsel_approved: false
language: en-US
---
# DRAFT / PRODUCT OWNER REVIEW

> Not effective. Not counsel-approved. This draft does not change the current Customer recording authorization screen or any historical decision.

# Customer Recording Authorization

## Display title

Allow Reliance recording for this service?

## Scope summary

Reliance should display, in plain language, the exact current proposal for this Work Record:

- service and Vendor;
- service location or location category;
- recording boundary;
- intentional participant roles, such as Assigned Service Professional;
- whether audio is included;
- recording purpose; and
- required stages: Starting Condition, Work in Progress, and Final Result.

The displayed summary and submitted decision must resolve to the same current assessment ID, generation, and server-computed scope hash. Internal identifiers do not need to be exposed to the Customer.

## Core explanation

The Service Video is intended to document the service in three short stages and provide a Private Proof record after Reliance Audit. It does not certify workmanship, safety, code compliance, licensure, or professional quality.

Your choice controls recording for the exact scope shown. It does not decide whether any Employee personally agrees to be recorded, and it does not make the finished Service Video Public. If recording is allowed, each required Employee must separately decide whether to participate. An approved Service Video remains Private unless you later make a separate exact-package Share Publicly choice and all other Public requirements are satisfied.

If audio is included, recording must not begin until all legally required parties have authorized it. No minors, unrelated adults, bystanders, unrelated private conversations, private documents or screens, credentials, access codes, or security information should be captured.

## Choice A: Allow recording

**Choice label:** Allow recording

**Exact decision text:** I authorize Reliance recording for this Work Record within the exact location, boundary, intentional participant roles, audio setting, purpose, and three recording stages shown. I understand that required Employees decide separately whether they personally participate and that this authorization does not make the Service Video Public.

**Confirmation button:** Confirm Allow Recording

## Choice B: Decline recording

**Choice label:** Decline recording

**Exact decision text:** I do not authorize Reliance recording for the exact Work Record and recording scope shown. Reliance recording must remain blocked. I understand this choice concerns the Reliance recording workflow and does not by itself state whether the underlying real-world service is canceled.

**Confirmation button:** Confirm Decline Recording

Reliance may separately explain any existing Work Record consequence required by the disclosed product contract. The wording must not imply that the Customer made a legal conclusion about an independent service contract.

## Choice C: This request is not for me

**Choice label:** This request is not for me

**Exact decision text:** I am not the correct person or do not have authority to answer this recording request. I am asking Reliance to correct the recipient or authority record. I am not allowing or declining recording.

**Confirmation button:** Report Wrong Recipient

This choice must remain distinct from Decline and must not be counted as authorization, refusal, or cancellation.

## No passive choice

Closing the page, leaving the page, or taking no action must not authorize recording. This draft intentionally contains no Decide Later decision. Until a valid current choice exists, recording remains blocked.

## Evidence contract

For a consequential choice, Reliance should preserve the verified Customer principal and authority context, Work Record, current assessment and generation, scope hash, decision, timestamp, exact displayed text snapshot, text version and hash, verification method, and immutable evidence hash. Raw bearer tokens and one-time codes must not be stored as consent evidence.

## Material change and withdrawal

A material change to location category, recording boundary, intentional participant roles, audio mode, purpose, or other disclosed scope creates a new assessment. A prior Customer decision must not authorize the replacement scope. A verified prospective withdrawal stops new recording under the withdrawn authorization, subject to preservation of historical evidence and any separately authorized existing Private Proof.

## Activation dependencies

- Product Owner and attorney approval of exact text.
- Removal of the current Decide Later action if still present.
- Current assessment display and submit-time stale-context validation.
- Exact content snapshot/hash persistence through the dormant governed-content contract.
- Durable-copy and withdrawal/request pathways.
- Clear reconciliation with current Work Record decline handling before activation.
