# RELIANCE RECORDING AND CONSENT WORKFLOW SPEC V1

**Document type:** Product workflow specification

**Status:** Proposed future workflow for product-owner approval

**Implementation status:** Design only. Nothing in this document changes current production behavior.

**Official baselines:**

1. `RELIANCE_CURRENT_CONSENT_PRIVACY_AND_RECORDING_AUDIT.md`
2. `RELIANCE_CONSENT_ARCHITECTURE_V1.md`

## Scope and governing rules

This specification converts the approved Reliance consent architecture into one operational workflow. It uses the current executable build as the current-state baseline and clearly identifies future requirements. Historical or obsolete concepts are excluded.

The governing rules are:

- Reliance is a proof-of-service platform, not a marketplace.
- Permission to perform a service, permission to record, and permission to publish are separate decisions.
- Private proof is a complete and valid outcome.
- Public visibility is never inferred from recording consent.
- Public approval occurs only after the customer can review the exact completed media.
- Audio is off by default and requires separate permission when used.
- Affirmative permission governs recording across all states. Reliance does not rely on one-party recording-law exceptions.
- Reviews are independent of recording and publication decisions.
- The former 72-hour review-window concept has no place in the future workflow.
- No automatic review, rating, five-star rating, silence-based approval, review expiration, or review deadline is included.
- The rules respond to what will actually be recorded, not merely where the service occurs.

This is a product specification, not legal advice and not a claim of compliance with every jurisdiction.

---

## 1. Definitions

| Term | Operational meaning |
|---|---|
| **Vendor** | The service business accountable for the work record, service purpose, assigned workforce, accuracy of the business representation, and compliance with customer recording and publication decisions. |
| **Vendor manager** | A vendor member authorized to create and manage work records, identify the planned recording scope, assign or reassign employees, send or resend consent requests, review submitted proof, request corrections, approve the vendor's official representation, and respond to disputes. |
| **Employee** | The currently assigned person authorized by the vendor to perform or document the service. Assignment permits work-record activity but does not transfer customer, guardian, bystander, or publication authority. |
| **Customer** | The Reliance account holder or service recipient associated with the work record. The customer may or may not be the person with authority to make every recording decision. |
| **Authorized customer representative** | A person identified by the customer or vendor who is permitted to make defined decisions for the customer, premises, or customer-owned property. Their authority must be confirmed for the specific work record and does not automatically extend to other people. |
| **Authority holder** | The person who has the right to decide whether a defined person, property, location, activity, or private interest may be recorded or published. Depending on the subject, this may be the customer, an authorized business representative, a guardian, the vendor, or an identifiable employee deciding about personal likeness. |
| **Guardian** | An adult whose identity and authority to act for a minor have been affirmatively confirmed for the work record. An adult's presence or customer status alone does not establish guardian authority. |
| **Protected non-participant** | A bystander, household member, visitor, customer-business employee, contractor, neighbor, child, or other person affected by recording who is not the active customer decision-maker. Their privacy and likeness may not be authorized by assumption. |
| **Work record** | The service-specific record connecting the vendor, customer, service, location selection, assigned employee, planned recording scope, staged proof, decisions, reviews, publication state, and final disposition. |
| **Recording consent** | An affirmative, scope-specific decision allowing defined service activity to be captured for an identified work record. It does not authorize audio or publication unless those are separately approved. |
| **Audio consent** | Separate affirmative permission to capture identifiable speech or other audio. Audio remains off unless the approved scope requires it and all affected authority requirements are satisfied. |
| **Private proof** | Completed service media available only to the customer, vendor manager, authorized vendor participants, and Reliance personnel with a defined support, safety, moderation, or dispute need. Private proof is not publicly searchable or publicly viewable. |
| **Customer-visible proof** | Completed service media delivered to the verified customer or authorized representative. It may remain private and does not become public merely because the customer can view it. |
| **Public proof** | Exact media that has received every required participant approval and admin moderation and is intentionally available to the public through Reliance. Public viewers should be assumed to include anyone. |
| **Publication approval** | A post-completion decision authorizing identified media for a stated audience. It is separate from recording consent and must not occur before the media exists. |
| **Exact-media approval** | Approval tied to the precise media version, selected clips, audio state, redactions, captions, labels, and intended audience shown to the decision-maker. Changing any material element ends the approval for the earlier version. |
| **Withdrawal** | A participant's decision to stop future recording, narrow future use, or end a previously authorized audience. Withdrawal adds a new historical event and does not erase the fact that earlier permission existed. |
| **Dispute** | A recorded disagreement about identity, authority, consent, recording scope, media accuracy, privacy, publication, review, deletion, or final disposition. A dispute narrows access while the relevant authority is evaluated. |
| **Evidence-only retention** | Restricted preservation of the minimum media and decision history needed for an active dispute, safety review, fraud inquiry, legal hold, deletion verification, or other legitimate proof purpose. It is not customer-visible or public publication. |
| **Vendor business address** | The vendor-controlled business location saved to the work record as the service location. Vendor control of the premises does not establish authority over customer-owned property, customer likeness, conversations, or protected non-participants. |
| **Customer residence** | A home or residential location selected for service. Affirmative customer or authorized-representative recording consent is always required before recording begins. |
| **Customer business address** | A customer-controlled commercial location selected for service. An authorized business representative may authorize the premises and business property but cannot automatically authorize every employee, visitor, customer, contractor, or bystander. |

### Customer and decision-maker distinction

The customer account identifies who owns or receives the work record. The actual decision-maker may be:

- the customer;
- an authorized customer representative;
- an authorized customer-business representative;
- a verified guardian;
- an authority holder for a particular property or subject; or
- an identifiable employee deciding about personal likeness.

Every decision record must identify both the associated customer and the person who actually made the decision.

**Baseline references:** Current Audit Sections 1, 4-6, 14, and 21; Consent Architecture Sections 1-5.

---

## 2. Universal Workflow Overview

### End-to-end sequence

```text
Vendor creates work record
-> service-location selection
-> recording-subject assessment
-> authority-holder identification
-> customer notice or consent request
-> employee assignment
-> employee pre-recording certification
-> recording unlock
-> Starting Condition recording
-> Work in Progress recording
-> Final Result recording
-> employee submission
-> manager review
-> customer delivery
-> exact-media publication decision
-> admin moderation
-> private, limited, or public outcome
-> later withdrawal, dispute, deletion, or restricted retention
```

### Steps 1-9: creation through first recording

| Step | Responsible participant | Trigger | Information shown | Decision required | System result |
|---|---|---|---|---|---|
| 1. Create work record | Vendor manager | A real service is scheduled or accepted | Customer, service, proposed date, service purpose, and current vendor identity | Confirm the record accurately represents a legitimate service | Draft work record created; recording remains locked |
| 2. Select service location | Vendor manager | Work record exists | Vendor business address, customer residence, or customer business address, including the saved address | Select the actual place where proof will be recorded | Location type and address become part of the work-record scope |
| 3. Assess recording subject | Vendor manager | Location selected | Short branching assessment covering people, property, private spaces, identifiers, sensitive information, minors, protected non-participants, and audio | Identify every reasonably expected subject and sensitivity | Risk level, required authority, and capture restrictions are determined |
| 4. Identify authority holder | Vendor manager; Customer or representative confirms | Assessment completed | Subjects requiring authority and the person proposed to decide | Confirm role, relationship, and scope of authority | Correct decision-maker identified or workflow paused |
| 5. Send notice or consent request | Vendor manager | Authority requirement determined and valid contact exists | Recording purpose, subject, people/audio scope, initial private audience, and separate later-publication decision | No customer decision for a notice-only vendor-owned subject; customer grants or declines when customer-controlled interests require consent | Notice delivery is recorded or permission becomes pending, granted, or declined; recording remains locked until every applicable gate is satisfied |
| 6. Assign employee | Vendor manager | Work record is ready for assignment | Service, location, scope restrictions, and current consent state | Select an active authorized employee | Employee becomes responsible; any former employee loses authority |
| 7. Verify location when required | Employee | Employee arrives and opens assigned record | Saved work-record location and verification status | Confirm current service location | Pass allows certification to continue; failure keeps recording locked |
| 8. Complete pre-recording certification | Employee | Assignment, authority, and any location gate are valid | Approved scope, prohibited subjects, audio state, current consent, and stop conditions | Confirm the operational facts and recording duties | Certification recorded; unresolved mismatch requires manager intervention |
| 9. Unlock recording | Reliance | All required gates pass | Approved stages, scope, audio state, audience, and active restrictions | No new participant decision; Reliance evaluates existing decisions | Camera access becomes available only to the assigned employee for the approved work record |

### Steps 10-18: staged proof through final disposition

| Step | Responsible participant | Trigger | Information shown | Decision required | System result |
|---|---|---|---|---|---|
| 10. Starting Condition | Employee | Recording unlocked and pre-service condition is ready | Stage purpose, scope reminder, audio state, visible recording status | Capture, preview, confirm, retake, or report accidental capture | Confirmed Starting Condition clip saved as private pending proof |
| 11. Work in Progress | Employee | Work has begun and stage is appropriate | Stage purpose and current restrictions | Capture, preview, confirm, retake, or report changed conditions | Confirmed Work in Progress clip saved as private pending proof |
| 12. Final Result | Employee | Service work is complete | Stage purpose and current restrictions | Capture, preview, confirm, retake, or report changed conditions | Confirmed Final Result clip saved as private pending proof |
| 13. Submit package | Employee | Required clips are confirmed | All three stage previews, missing-stage warnings, replacements, and incident reports | Certify that clips belong to this job and submit to manager | Package becomes read-only for employee except an authorized correction flow |
| 14. Manager review | Vendor manager | Employee submits package | Exact clips, scope, incident reports, location result, consent state, and employee certification | Approve private proof, request correction, restrict a clip, or escalate a concern | Approved package is delivered privately; correction returns only affected work to employee |
| 15. Customer delivery | Reliance | Manager approves private proof | All approved private stages and service context | Customer may view, dispute, download if permitted, or keep private; no publication decision is required | Customer-visible private proof becomes available |
| 16. Exact-media publication decision | Customer or authority holder; Vendor; identifiable Employee; Guardian when a minor is involved | Public or limited sharing is proposed after delivery | Exact clips, redactions, audio state, captions, labels, audience, and consequences | Approve all, some, none, limited audience, or request correction/redaction | Approved media version and audience recorded; private proof remains valid regardless |
| 17. Admin moderation | Admin | All required participant approvals exist for proposed media | Exact approved version, authority evidence, restrictions, audience, and service context | Approve, reject, flag, restrict, or request correction | Reliance eligibility determined; admin cannot expand participant permission |
| 18. Final and later disposition | Reliance; affected participant initiates later action | Moderation completes or a later withdrawal/dispute/deletion event occurs | Current private/public state and decision history | Apply approved audience or the narrowest active restriction | Media remains private, becomes limited/public, is unpublished, disputed, deleted, or retained as restricted evidence |

### Evidence, notifications, failure behavior, and service continuation

| Step | Audit evidence created | Notification sent | Failure or decline behavior | May service still continue? |
|---|---|---|---|---|
| 1 | Creator, vendor, customer, service, time, initial scope | Vendor confirmation | Invalid or incomplete record remains draft | Yes, but no Reliance recording |
| 2 | Location selection, address snapshot, selector, time | Vendor status | Unclear or changing address blocks recording setup | Yes |
| 3 | Assessment answers, resulting risk level, version, time | Vendor status; employee later sees result | Unanswered material question blocks recording | Yes |
| 4 | Decision-maker identity, claimed role, authority method | Proposed decision-maker and vendor | Authority uncertainty blocks consent and recording | Yes |
| 5 | Request, content/version, channel attempts, verification, decision, time | Customer, vendor, assigned employee when relevant | On a consent path, no response, decline, expiry, wrong recipient, or failed verification keeps recording locked. On a notice-only path, recorded delivery attempts satisfy the notice gate without creating customer consent | Yes, subject to the recording-decline rule below |
| 6 | Assignment/reassignment and prior access termination | New employee, replaced employee, vendor | No authorized employee means no recording | Yes |
| 7 | Location target, attempt, result, accuracy, exception decision | Employee and vendor on failure | Failure blocks camera; no quiet override | Yes |
| 8 | Employee identity, certification version, scope, audio state, time | Vendor on mismatch or refusal | Refusal or mismatch blocks camera | Yes |
| 9 | Gate results and unlock time | Employee; vendor status | Any failed gate leaves locked state | Yes |
| 10-12 | Start/end, stage, employee, media identity, preview confirmation, incidents | Vendor status; customer only for material incident | Stop, retake, quarantine, or escalate when scope changes | Yes; recording may stop while service continues |
| 13 | Submission certification and package version | Vendor manager | Missing or unconfirmed stage prevents submission | Service may already be complete; proof remains pending |
| 14 | Manager decision, reasons, exact version | Employee and vendor; customer for material delay if needed | Correction or escalation keeps proof private | Yes |
| 15 | Delivery event and customer access status | Customer | Delivery failure is retried and escalated; no public effect | Yes |
| 16 | Exact-media decision, actor, authority, audience, version, time | Customer/representative, vendor, affected employee/guardian | No response or decline leaves proof private | Yes; completion is unaffected |
| 17 | Admin decision, reasons, version, restrictions | Vendor; customer if audience is affected | Rejection leaves proof private or correction pending | Yes |
| 18 | Audience change, withdrawal, dispute, unpublishing, deletion, retention outcome | Every directly affected participant | Narrow access first; preserve minimum evidence | Yes, unless an independent service or account restriction applies |

### Service continuation rule

- Declining **public publication** never affects the customer's service or completed private proof.
- Declining **recording** means Reliance recording cannot occur.
- The service normally continues without Reliance recording.
- A vendor may decline or reschedule the underlying service only when private documentation is genuinely essential for safety, warranty, insurance, regulatory, or service-integrity reasons and that requirement was clearly disclosed before the customer accepted the service.
- A vendor may not introduce an essential-recording condition after work has begun.
- No customer may be penalized for choosing private proof over public proof.

**Baseline references:** Current Audit Sections 5-11, 15-18, and 21; Consent Architecture Sections 1, 6-12, and 15-16.

---

## 3. Recording-Subject Assessment

The assessment must be short enough for a small business to complete but strong enough to detect high-risk recording. It occurs once when the vendor creates the work record and must be reopened whenever location, subject, audio, or expected people change.

### Practical branching assessment

#### Question 1: What is the main subject?

Choose every expected category:

- vendor-owned property or vendor work area only;
- customer-owned property;
- a customer's body, face, hair, voice, likeness, or personal activity;
- a vendor employee's face, voice, or personal identity; or
- another person, minor, bystander, visitor, household member, or customer-business employee.

#### Question 2: What setting or information could appear?

Choose every expected category:

- residence interior;
- customer-business interior;
- documents, screens, records, or confidential operations;
- addresses, license plates, account numbers, keys, access codes, or security equipment;
- medical, financial, educational, employment, or similarly sensitive information; or
- none of these.

#### Question 3: Will audio or conversation be captured?

- No. Audio remains off.
- Yes. Audio is necessary for the stated proof purpose.

#### Question 4: Can the planned frame avoid unapproved people and sensitive details?

- Yes, the frame can remain limited to the approved subject.
- No or uncertain, additional authority, redaction planning, or a no-recording outcome is required.

### Resulting workflow levels

| Level | Assessment result | Recording requirement | Identity standard | Employee restrictions |
|---|---|---|---|---|
| **Level 1: Vendor-only property proof** | Vendor-owned subject/work area only; no identifiable customer; no protected person; no sensitive information; no audio | Vendor authorization plus customer notice when tied to a customer work record | Confirmed vendor manager; notice delivery is recorded, but no customer decision is required when no customer-controlled interest appears | Frame limited to vendor property and service activity |
| **Level 2: Customer property proof** | Customer-owned object or asset; no person, home interior, audio, minor, confidential information, or unnecessary identifier | Affirmative customer or authorized-representative recording consent | Verified contact through account or one-time code; service-detail challenge may supplement | Avoid people and identifiers; private initial audience |
| **Level 3: Person, residence, business-interior, or sensitive proof** | Any identifiable person, residence interior, customer-business interior, document, screen, identifier, confidential activity, or sensitive information | Affirmative scope-specific consent from each required authority holder | Verified account or one-time code plus authority declaration; guardian review for a minor or representative review when the decision-maker is not the customer | Narrow framing, no audio by default, stop on changed conditions |
| **Level 4: Audio, minor, or unresolved protected-person risk** | Audio, identifiable minor, or likely protected non-participant who cannot be avoided | Separate audio/guardian/individual authority or no recording; identifiable minor public proof prohibited by default | Strong verified identity and role; signed link alone is never sufficient | Manager review before unlock; mandatory stop/retake if scope is exceeded |

### Answer-to-action rules

| Assessment answer | Required action |
|---|---|
| Only vendor-owned property/work area | Vendor authorization may support private capture. Customer notice remains required for a customer-specific work record. |
| Customer-owned property | Customer or authorized-representative recording consent required even at the vendor's business. |
| Customer body, face, hair, voice, likeness, or personal activity | Person-centered consent required before capture; exact-media approval required before any broader audience. |
| Employee face, voice, or personal identity | Vendor employment authority does not automatically grant public likeness use; separate employee publication decision required when personally identifiable. |
| Minor | Verified guardian authority required for necessary private capture; public identifiable-minor proof prohibited by default. |
| Bystander or protected non-participant | Avoid, remove from frame, retake, redact, or keep unusable for broader access until authority exists. |
| Residence interior | Customer or authorized-resident consent always required; narrowest framing and location verification required. |
| Business interior | Authorized business representative required for premises/property; individual people remain separately protected. |
| Confidential documents or screens | Reframe or remove before capture; accidental capture is quarantined for retake/redaction. |
| Address, plate, account number, key, code, or security system | Exclude unless essential to proof; if essential, private only unless specifically redacted before publication. |
| Audio or conversation | Audio stays off unless separately necessary and authorized for every identifiable speaker. |
| Medical, financial, educational, employment, or other sensitive information | Exclude by default; manager intervention and heightened consent required if essential. |

Public approval is never decided during this assessment. The assessment determines recording gates and restrictions only.

**Baseline references:** Current Audit Sections 6, 8-10, 18-19, and 22; Consent Architecture Sections 1, 6-7, 13-14, and 17-18.

---

## 4. The Three Location Selections

All three selections use the same architecture:

1. Identify the planned subject.
2. Identify every authority holder.
3. Separate recording from publication.
4. Keep audio off unless separately authorized.
5. Require employee certification.
6. Start private.
7. Obtain exact-media approval before broader use.
8. Preserve decisions without preserving unnecessary public access.

The location determines some gates, but it never replaces the subject assessment.

### A. Vendor Business Address

#### Full workflow

1. The vendor manager selects the saved vendor business address and confirms that the service will actually occur there.
2. Reliance saves the work-record location so later business-address changes cannot silently change the proof location.
3. The vendor completes the recording-subject assessment.
4. Vendor authorization is sufficient for private recording only when the planned media is limited to vendor-owned property or a vendor-controlled work area and contains no customer-controlled property, identifiable customer, protected non-participant, audio, confidential information, or sensitive identifier.
5. A customer-specific work record always generates customer notice, even when vendor authorization is sufficient.
6. Customer recording consent is required when the planned proof includes customer-owned property, a customer or other person, customer identity, personal activity, audio, sensitive information, or a customer-specific identifier.
7. Person-centered services, including barbering and salon services, always require affirmative consent from the person being recorded or an authority holder before camera access.
8. Property-centered services, including vehicle or appliance repair at the vendor's shop, may use a simplified property-only consent path. The customer still affirmatively authorizes recording of customer-owned property. Unnecessary plates, paperwork, customer names, keys, access codes, and people remain outside the frame.
9. The assigned employee verifies presence at the saved vendor address and completes pre-recording certification.
10. Employees, customers, mirrors, conversations, and bystanders are treated according to what is actually visible or audible. Vendor control of the premises does not authorize every person's likeness or voice.
11. If a person unexpectedly enters the frame, the employee stops, discards or quarantines the affected clip, and retakes after the frame is clear. The employee may continue only when the approved scope still applies.
12. If recording consent is declined, recording remains locked. The service normally continues without Reliance recording under the service continuation rule.
13. Completed clips remain private after manager approval.
14. Any public or limited-audience use requires post-completion exact-media approval from the customer or authority holder, vendor approval, applicable employee/guardian approval, and admin moderation.

#### Vendor business address decision table

| Decision point | Rule |
|---|---|
| Customer consent required? | Yes for customer-owned property, identifiable people, customer identity/activity, audio, sensitive information, or protected-person risk. No only for vendor-owned subject/work area with no customer-controlled interest. |
| Customer notice required? | Yes for every customer-specific work record. |
| Authority verification required? | Vendor manager always; customer/representative when customer-controlled interests are recorded; guardian for a minor; individual for intentional likeness or audio. |
| Location verification required? | Yes, against the vendor-address snapshot saved to the work record. |
| Employee certification required? | Yes, before initial unlock and a scope reminder before each stage. |
| Audio allowed? | Off by default. Allowed only when necessary and separately authorized for identifiable speakers. |
| Exact-media publication approval required? | Yes for any customer-associated public or limited publication. |
| Vendor manager approval required? | Yes before customer delivery and before proposed public use. |
| Admin moderation required? | Yes before public publication; available for private safety/support disputes. |
| Decline result | Recording remains locked; service normally continues without Reliance recording. |
| Withdrawal result | Future recording stops; public access is removed if previously approved; minimum evidence may remain restricted. |

### B. Customer Residence

#### Full workflow

1. The vendor manager selects customer residence and enters or confirms the service address.
2. Reliance treats the residence as a high-privacy setting. Affirmative consent from the customer or an authorized representative is always required before recording.
3. The intended decision-maker confirms identity and authority over the premises and service subject. A tenant, owner, resident, property manager, or other representative may have different scope; the claimed role is recorded.
4. Consent describes the planned service stages, location, subject, people, initial private audience, audio-off state, and the separate later-publication decision.
5. Household members, children, private rooms, documents, screens, security equipment, addresses, possessions, and conversations are not included merely because the customer consented to service recording.
6. A guardian must separately authorize any necessary recording involving an identifiable minor. Public identifiable-minor proof remains prohibited by default.
7. The assigned employee verifies the saved residence location and completes pre-recording certification.
8. Failed location verification keeps the camera locked. Poor accuracy triggers retry or an approved alternate verification path; a manager cannot silently override the result.
9. The employee records only the defined service area and stops if a new person enters, a private item appears, audio becomes active, or the service moves outside the approved area.
10. A new person entering the area is not covered by the customer's general consent. The employee waits, reframes, or obtains the required additional authority.
11. A material scope change, such as moving to another room, adding a new service subject, or capturing a security system, returns the work record to manager review and may require a new consent decision.
12. If consent is declined, recording remains locked. The service may continue without recording under the service continuation rule.
13. After manager approval, the customer receives private access to all approved stages.
14. Public use requires exact-media approval after completion. The customer may approve all, selected clips, a limited audience, or none.
15. Withdrawal before or during recording stops future capture. Withdrawal after publication promptly removes Reliance-controlled public access while preserving the decision history and any justified restricted evidence.

#### Customer residence decision table

| Decision point | Rule |
|---|---|
| Customer consent required? | Always, before any recording. |
| Customer notice required? | Yes; the notice is part of the affirmative consent request. |
| Authority verification required? | Yes for the customer or representative; guardian authority separately verified for minors. |
| Location verification required? | Yes, against the residence snapshot saved to the work record. |
| Employee certification required? | Yes, before initial unlock and a scope reminder before each stage. |
| Audio allowed? | Off by default. Separate necessity and permission required for every identifiable speaker. |
| Exact-media publication approval required? | Always before limited or public publication. |
| Vendor manager approval required? | Yes before customer delivery and any publication request. |
| Admin moderation required? | Yes before public publication. |
| Decline result | No recording; service normally continues without Reliance recording. |
| Withdrawal result | Stop future capture, promptly unpublish affected media, preserve minimum restricted evidence when justified. |

### C. Customer Business Address

#### Full workflow

1. The vendor manager selects customer business address and confirms the service location and business identity.
2. The proposed decision-maker identifies their business role and confirms authority over the premises and business-owned service subject.
3. Reliance distinguishes authority over the business location from authority over people. A business owner or manager cannot automatically consent for every employee, visitor, customer, contractor, or bystander.
4. Affirmative recording consent from the authorized business representative is always required for the business premises and business property.
5. Any identifiable individual whose face, voice, personal activity, or private information is intentionally captured requires separate authority or must be avoided, de-identified, or excluded.
6. The subject assessment identifies confidential screens, records, customer information, access controls, keys, codes, security systems, production methods, and other sensitive operations.
7. Audio remains off. General business-premises consent does not authorize employee, visitor, or customer conversations.
8. The assigned employee verifies the saved customer-business location and completes pre-recording certification.
9. The employee limits the frame to the approved service area. If a visitor or employee enters, the employee pauses, reframes, or retakes.
10. If the service moves to another area, exposes new confidential information, or adds a new subject, recording stops until the manager confirms whether a new consent decision is required.
11. If consent is declined, recording remains locked. The service normally continues without Reliance recording under the service continuation rule.
12. After manager approval, the authorized customer or representative receives private proof.
13. Public publication requires exact-media approval from the customer-business authority holder, vendor approval, applicable individual/employee/guardian approval, and admin moderation.
14. Approval of the business premises does not make unapproved people or confidential operations publishable.

#### Customer business address decision table

| Decision point | Rule |
|---|---|
| Customer consent required? | Always from an authorized business representative for the premises and business-owned subject; separate authority for intentionally identifiable individuals. |
| Customer notice required? | Yes; the notice is part of the affirmative consent request. |
| Authority verification required? | Yes for the representative's role and scope; separate authority for people where required. |
| Location verification required? | Yes, against the customer-business snapshot saved to the work record. |
| Employee certification required? | Yes, before initial unlock and a scope reminder before each stage. |
| Audio allowed? | Off by default. Business representative authority does not cover every speaker. |
| Exact-media publication approval required? | Always before limited or public publication. |
| Vendor manager approval required? | Yes before customer delivery and any publication request. |
| Admin moderation required? | Yes before public publication. |
| Decline result | No recording; service normally continues without Reliance recording. |
| Withdrawal result | Stop future capture, promptly unpublish, and preserve only justified restricted evidence. |

### Three-location comparison

| Gate | Vendor business address | Customer residence | Customer business address |
|---|---|---|---|
| Recording basis | Subject-dependent vendor authorization or customer consent | Customer/representative consent always | Authorized business-representative consent always |
| Vendor-only private path | Available only for vendor-owned subject/work area with no customer-controlled interest | Not available | Not available |
| Customer notice | Always for customer-specific work | Always | Always |
| Person-centered recording | Person's affirmative consent required | Customer/person/guardian authority required | Individual authority required unless person is avoided/de-identified |
| Customer-owned property | Customer consent required | Customer consent required | Business-representative consent required for business property |
| Location verification | Required | Required | Required |
| Audio | Off by default | Off by default | Off by default |
| Initial audience | Private | Private | Private |
| Public path | Exact-media participant approvals plus admin moderation | Exact-media participant approvals plus admin moderation | Exact-media participant approvals plus admin moderation |

**Baseline references:** Current Audit Sections 1, 6, 8-10, 15, 18-19, 21-22; Consent Architecture Sections 6-8, 13-18.

---

## 5. Customer Consent Request by SMS and Email

### Notice-only path

When the assessment establishes Level 1 vendor-only property proof:

- the customer receives an informational notice through available channels;
- the notice explains that private proof will be limited to vendor-owned property or a vendor-controlled work area;
- no OTP or customer recording decision is required because no customer-controlled interest is within scope;
- delivery attempts are recorded;
- a delivery failure is shown to the vendor but does not become customer consent or automatically block otherwise valid vendor-only recording;
- the vendor manager reconfirms that no customer-owned property, person, identifier, audio, or sensitive information will be captured; and
- if the customer reports that the assessment is wrong, recording locks until the subject is reassessed and any required consent is obtained.

### Request generation

The recording-consent request is generated only after:

1. a vendor manager has created a valid work record;
2. a service location has been selected;
3. the recording-subject assessment is complete;
4. the correct authority-holder role has been identified;
5. the customer or representative contact information has been reviewed; and
6. the work record is still in a pre-recording state.

Only a vendor manager or a vendor member expressly granted work-record consent authority may generate or resend the request. An assigned employee may see status but may not create, redirect, approve, or resend customer consent on the customer's behalf.

### One request, multiple delivery channels

- SMS and email are delivery channels for the same consent request, not separate consent decisions.
- When both are available and belong to the same intended decision-maker, Reliance sends both.
- Each message identifies the vendor, service, work record, location type, planned subject, audio state, and action required.
- Duplicate messages lead to the same current request and status.
- A resend does not create a second active consent record.
- A resend invalidates prior action links while preserving their historical delivery evidence.
- The current secure link may be reopened to view status until the work record reaches final disposition, but a completed decision cannot be changed through the earlier action without starting a new superseding request.

### Secure-link behavior

The secure link identifies the work record and opens the correct request. The link alone is not enough to approve, decline, or change consent.

Before a decision, Reliance requires:

- a logged-in customer account that matches the intended recipient; or
- a one-time code sent to the verified decision channel.

The decision-maker then confirms:

- whether they are the customer, authorized representative, business representative, guardian, or another authority holder;
- what subject they are authorized to control;
- whether the request describes the correct service and location; and
- whether another person's authority is also required.

### Expiration

The proposed default is:

- the action link expires 48 hours after issuance or at the scheduled service start, whichever occurs first;
- a new request may be sent if recording has not begun;
- expiration never becomes approval;
- expired requests remain viewable as historical status after identity verification; and
- any change to location, subject, audio, or authority holder supersedes the old request and requires a new decision.

The final duration is an open product-owner decision in Section 19.

### Content required in the request

The request must describe, in plain language:

- the vendor and service;
- the selected service location;
- the planned recording subject;
- whether people may intentionally appear;
- whether minors or protected non-participants are expected;
- whether audio is included, with audio shown as off unless separately requested;
- the three proof stages;
- the initial private audience;
- the customer's ability to decline recording;
- whether the service can proceed without recording;
- the fact that public publication is a separate later decision involving exact-media review;
- the request expiration; and
- how to report a wrong recipient or lack of authority.

This section defines required content and behavior, not final consent language.

### Channel and recipient rules

| Situation | Required behavior |
|---|---|
| Phone and email belong to the same person | Send both channels; one verified decision applies to the request |
| Phone and email belong to different people | Pause the request; vendor manager identifies the intended authority holder and corrects or separates contacts before a decision |
| Only email is available | Send email; require email one-time code or matching logged-in account |
| Only mobile phone is available | Send SMS; require SMS one-time code or matching logged-in account |
| Neither channel is available | Recording remains locked unless Reliance adopts the verified in-person alternative described as an open decision in Section 19 |
| Shared family email | Recipient identifies the actual authority holder; a shared address alone does not prove authority |
| Shared business phone | Recipient identifies role and individual identity; business-phone possession alone does not authorize the premises or people |
| Delivery fails on one channel | Continue through the other verified channel and notify the vendor of the failed channel |
| Delivery fails on every channel | Keep recording locked; vendor corrects contact details or service proceeds without recording |
| Wrong recipient | Recipient reports the mismatch without approving or declining; Reliance invalidates the action link and notifies the vendor to correct the contact |

### Pending, acceptance, decline, and correction behavior

#### While pending

The employee sees:

- consent pending;
- recording locked;
- the approved scope is not yet active; and
- no customer contact details beyond what is needed for operational identification.

The vendor sees:

- intended recipient;
- channels attempted;
- delivery status;
- verification pending;
- expiration time;
- resend availability; and
- wrong-recipient or correction status.

The customer sees:

- the request purpose;
- vendor and service identity;
- location and planned subject;
- audio state;
- initial private audience;
- separate later publication decision;
- identity and authority confirmation; and
- approve, decline, wrong-recipient, or not-authorized outcomes.

#### Acceptance

Acceptance records the actor, verified contact, role, authority scope, recording scope, audio state, location, service, time, and the exact consent and policy versions presented. The customer receives confirmation through every verified available channel.

#### Decline

Decline immediately keeps or returns recording to locked status. The vendor and assigned employee are notified. The service may proceed without Reliance recording under Section 2's service continuation rule.

#### Wrong recipient or not authorized

This is not recorded as the intended customer's decline. It invalidates the request, notifies the vendor, and requires corrected recipient information or a newly identified authority holder.

#### Authorized representative

The representative identifies:

- relationship to the customer;
- authority over the location or subject;
- any limit on that authority; and
- whether another person's permission is required.

The vendor may correct the recipient, but the vendor may not certify the representative's authority on that person's behalf.

#### Guardian

The guardian identifies the minor, relationship, and basis of authority. Necessary private recording remains blocked until guardian identity and authority satisfy the heightened standard in Sections 6 and 13.

### Decision confirmation

After any decision, the customer receives:

- a plain-language confirmation;
- the decision and scope;
- the work record and vendor;
- the date and time;
- audio state;
- initial audience;
- expiration or withdrawal information;
- a reminder that public publication requires a later exact-media decision; and
- a way to report an error.

**Baseline references:** Current Audit Sections 6-7, 14-15, 18, and Gap Matrix G-01/G-02; Consent Architecture Sections 3-4, 6, 9-11, and 13.

---

## 6. Identity and Authority Confirmation

### One understandable platform standard

Every recording decision uses two layers:

1. **Request identification:** A signed link connects the person to the correct work record.
2. **Decision verification:** A matching logged-in account or one-time code verifies control of the intended contact.

The person must also state the role and authority under which they are deciding. Contact verification proves control of a contact method; it does not by itself prove authority over a residence, business, person, minor, or property.

### Comparison of verification methods

| Method | Permitted use | Not sufficient for |
|---|---|---|
| Signed link only | Opening the correct request and viewing non-sensitive request status | Any affirmative recording, audio, guardian, or publication decision |
| Email one-time code | Verifying control of the intended email; standard recording decisions when authority is also confirmed | Proving guardian or business authority by itself |
| SMS one-time code | Verifying control of the intended mobile number; standard recording decisions when authority is also confirmed | Proving guardian or business authority by itself |
| Last-name or service-detail challenge | Supplemental mismatch detection when the detail is not easily guessed | Sole verification for residence, person, audio, minor, sensitive, or publication decisions |
| Logged-in customer account | Verifying an established customer identity when the account matches the work record and contact | Proving authority over every other person or subject |
| Authorized-representative declaration | Recording the representative's role and claimed authority | Replacing verified contact or authorizing rights outside the declared scope |
| Guardian declaration | Recording relationship and claimed guardian authority | Public identifiable-minor proof, which remains prohibited by default |
| Vendor-assisted contact correction | Correcting the intended recipient before a decision | Allowing the vendor to approve, decline, or claim customer authority |

### Risk-based verification tiers

| Recording or decision type | Required verification |
|---|---|
| Vendor-only private recording at vendor address | Confirmed vendor manager; customer notice acknowledgment when tied to a customer-specific service |
| Low-risk private recording of customer-owned property | Signed request link plus matching account or one-time code; authority declaration; service-detail challenge may supplement |
| Person-centered recording | Matching account or one-time code; explicit personal or representative authority; no signed-link-only decision |
| Customer residence recording | Matching account or one-time code; residence authority declaration; additional guardian/representative confirmation when relevant |
| Customer business recording | Matching account or one-time code; named representative and business role; premises/property authority scope |
| Audio recording | Same as the underlying recording plus separate audio decision for every intentionally identifiable speaker |
| Minor recording | Verified guardian contact, guardian declaration, minor relationship, and manager review before unlock |
| Public publication | Fresh matching account or one-time-code verification if the earlier verified session is no longer active; exact-media approval and authority reconfirmation |

### Identity mismatch rules

- If email and phone resolve to different people, neither may approve until the vendor identifies the intended decision-maker.
- If a logged-in account does not match the intended customer or representative, the person may report a mismatch but may not decide.
- If a customer says they never consented, content immediately moves to the narrowest access state while Reliance reviews verification evidence.
- If a representative's authority is challenged, recording or publication pauses until the scope is confirmed.
- Failed verification attempts never become consent and always create security evidence.

### Ease-of-use rule

Reliance uses the lowest-friction method that still verifies the decision:

- one verified contact challenge per active decision session;
- no repeated code before every stage when scope has not changed;
- stronger re-verification for public publication, minors, audio, or changed authority; and
- no unnecessary document collection for ordinary low-risk property recording.

**Baseline references:** Current Audit Sections 6, 14-15, 18, and Gap Matrix G-02; Consent Architecture Sections 3-4, 6, and 13.

---

## 7. Employee Pre-Recording Certification

### Timing

The certification has two parts:

1. **Durable work-record certification:** Completed once after assignment and before the first camera unlock. It must be repeated after employee reassignment or material scope change.
2. **Stage reminder:** Presented before each of the three stages to confirm that current conditions still match. It is an operational safety check, not a new customer consent event.

### Facts the employee confirms

Before initial unlock, the employee confirms:

- this is the assigned work record;
- the displayed vendor, customer, service, and location are correct;
- the employee is authorized by the vendor;
- location verification passed when required;
- required customer consent or permitted vendor-only authorization is active;
- the employee reviewed the approved recording subject and restrictions;
- audio is off unless separately authorized;
- the employee will avoid people, protected non-participants, minors, documents, screens, private areas, identifiers, and unrelated information outside scope;
- the employee will stop if location, people, subject, audio, or authority changes;
- accidental capture will be reported;
- unrelated prerecorded media will not be substituted; and
- every confirmed clip will accurately represent its named service stage.

Final wording is outside this specification.

### Durable evidence versus operational reminder

| Item | Durable evidence | Operational reminder |
|---|---|---|
| Employee identity and assignment | Yes | Display only |
| Work record, location selection, and scope version | Yes | Display each stage |
| Consent/vendor-authorization state observed | Yes | Display each stage |
| Audio state | Yes | Display each stage |
| Certification version and time | Yes | Not repeated unless scope changes |
| Location verification result | Yes | Current status displayed |
| Avoid people, minors, screens, identifiers, and private areas | Certification duty recorded | Brief stage reminder |
| Stop if conditions change | Certification duty recorded | Brief stage reminder |
| Current frame is clear | No, unless an incident occurs | Confirm before each stage |
| Current stage label and purpose | Stage confirmation evidence | Display before capture |

### Recording blocks

Recording remains locked when:

- the employee is not the current assignee;
- vendor membership or authorization is inactive;
- required consent is pending, declined, expired, superseded, or withdrawn;
- the subject assessment is incomplete;
- the employee refuses certification;
- audio is requested without separate authority;
- minor or representative authority is unresolved;
- location verification fails where required;
- location or subject differs from the work record;
- an unresolved privacy or safety dispute exists; or
- a prior accidental capture requires manager disposition.

### Manager intervention

Manager intervention is required when:

- the planned subject or service area changes;
- a new person or minor must intentionally appear;
- audio becomes necessary;
- the employee reports accidental capture;
- prerecorded fallback media is proposed;
- a location exception is requested;
- an employee is reassigned;
- the employee disputes the authorized scope; or
- the customer withdraws or narrows permission.

The manager may clarify or narrow the scope. The manager may not override missing customer, guardian, employee-likeness, or protected-person authority.

**Baseline references:** Current Audit Section 5 and Gap Matrix G-03/G-09/G-10; Consent Architecture Sections 2, 4-6, 10, and 14.

---

## 8. Recording Behavior

### General capture rules

- Audio is off by default.
- The employee and nearby participants must have a visible, unambiguous indication that recording is active.
- Reliance uses the three current stages: Starting Condition, Work in Progress, and Final Result.
- Each stage is limited to 30 seconds per confirmed clip.
- The employee may preview and retake before confirmation.
- The next stage does not unlock merely because time has passed; it unlocks through the approved work sequence.
- Every confirmed clip remains private until later decisions are complete.

### Pause, restart, and retake

- The employee may stop before confirming a clip.
- An interrupted or out-of-scope clip is not treated as completed proof.
- Restarting creates a new attempt for the same stage.
- A confirmed clip may be replaced before manager submission.
- After manager submission, replacement occurs only through a correction path and creates a new media version.
- Replacing a publicly proposed or approved clip ends any exact-media approval tied to the prior version.

### Mandatory stop conditions

Recording must stop when:

- consent is withdrawn;
- the approved decision expires or is superseded;
- a minor or protected non-participant enters the frame;
- audio activates without authorization;
- the service moves outside the approved location or area;
- the subject changes;
- confidential or sensitive information becomes visible;
- the assigned employee changes;
- the customer or authority holder asks the employee to stop;
- the employee cannot maintain safe control of the recording; or
- the employee is uncertain that current conditions remain authorized.

### Accidental capture

1. The employee stops recording.
2. The affected clip is quarantined and cannot proceed to customer delivery or publication.
3. The employee identifies the incident category without adding unnecessary sensitive detail.
4. The employee retakes the stage when possible.
5. The manager decides whether the quarantined clip is deleted, redacted, or retained only for a dispute or safety need.
6. Affected participants are notified when the capture creates a material privacy risk.

### Changed people or scope

| Change | Required response |
|---|---|
| Minor enters | Stop immediately; retake without minor; verified guardian review required if minor must be included |
| Bystander enters | Pause/reframe/retake; do not rely on customer or business owner to authorize the individual automatically |
| Customer asks to broaden scope | Stop; manager updates assessment; new authority and consent obtained before unlock |
| Service moves to another room or address | Stop; update location/scope; verify new location and authority |
| Audio becomes necessary | Stop; obtain separate audio permission before continuing |
| New employee takes over | End former employee access; assign and certify replacement |

### Reflections, mirrors, screens, documents, and identifiers

- The employee checks the complete frame, including reflections and backgrounds.
- Mirrors and reflective surfaces are repositioned or framed out when they reveal people or private areas.
- Screens and documents are turned away, covered, removed, blurred, or excluded.
- License plates, addresses, customer names, account numbers, keys, codes, and security equipment are excluded unless essential to private proof.
- Essential identifiers remain private and must be redacted before any publication proposal.
- A clip containing an access code, key pattern, security credential, or highly sensitive information cannot be approved for public use.

### Prerecorded file fallback

Live capture is the standard.

Prerecorded fallback media may be used only when:

- live capture failed for a documented reason;
- the vendor manager authorizes the exception;
- the employee identifies the source and capture time;
- the media belongs to the same work record and stage;
- the media receives enhanced manager review; and
- the media is labeled internally as fallback rather than verified live capture.

Fallback media is not eligible for public proof when it includes a person, minor, audio, residence interior, confidential information, or uncertain capture origin. Whether all fallback media should remain private is an open product-owner decision in Section 19.

### Replaced media and disputes

- Before dispute: replaced clips follow the approved retention schedule and are not ordinarily accessible.
- During an active dispute: the replaced version is preserved as evidence-only and cannot be publicly displayed.
- After dispute: the final disposition records whether the replaced version is purged or remains restricted for a defined reason.

**Baseline references:** Current Audit Sections 5, 8-9, 17-18, and Gap Matrix G-09/G-13; Consent Architecture Sections 6, 8-10, and 14.

---

## 9. Private Proof and Customer Access

### Private outcome

After manager approval, the proof becomes customer-visible but remains private unless a later exact-media decision authorizes a broader audience.

Private proof is a successful final outcome. A work record does not need public media or a customer review to be complete.

### Access rules

| Participant | Private-proof access |
|---|---|
| Customer or verified authorized representative | May view all three manager-approved stages, current service details, and decision history relevant to the customer |
| Vendor manager | May view all stages for service records, quality control, correction, dispute response, and legitimate business records |
| Assigned employee | May view submitted clips and manager feedback for the assigned job; after completion, access becomes read-only and limited to legitimate work needs |
| Other vendor employees | No access unless assigned a defined manager, correction, support, or dispute role |
| Admin | No routine browsing. Access is limited to moderation, support, safety, integrity, account action, or dispute handling |
| Public | No access |

### Customer review of the proof

- The customer may view Starting Condition, Work in Progress, and Final Result.
- The customer may report that a clip is inaccurate, out of scope, private, or not associated with the service.
- A dispute does not automatically destroy the original proof.
- A privacy or identity dispute immediately narrows access while review occurs.
- A service-quality disagreement is recorded separately from consent or privacy.

### Trust Score

- Choosing private proof must not reduce the customer's or vendor's standing.
- Declining publication must not lower Trust Score.
- Declining to leave a review must not lower Trust Score.
- Manager-approved private proof contributes to any verified-completion component on the same basis as equivalent public proof.
- Public visibility contributes no additional Trust Score value.
- Private proof contributes no customer-review signal unless the customer separately submits a genuine review.
- This specification does not redesign the broader Trust Score.

### Download and outside sharing

#### Customer

The customer may download private proof for personal service records. Downloading does not create permission for Reliance or the vendor to publish it. The customer remains responsible for the rights of any other identifiable person contained in the copy.

#### Vendor

The vendor manager may download private proof for warranty, insurance, dispute, or legitimate business records. Download does not permit promotion, social-media posting, advertising, sale, or unrelated use.

#### Employee

The employee may not independently download or reuse customer work-record media after submission unless the vendor grants a defined business-record purpose and every required privacy restriction remains enforceable.

#### Outside Reliance

- A private download should be clearly identified as private proof.
- Reliance cannot control a lawful recipient's device after download, but the original audience and use restrictions do not disappear.
- Reliance should not present external sharing as public approval.
- Vendor sharing outside Reliance requires the same authority that public Reliance publication would require.

Whether downloads should be available by default is an open product-owner decision in Section 19.

### Retention, deletion, and disputes

- The customer and vendor may request deletion according to the approved retention rules.
- Public withdrawal and private deletion are separate actions.
- An active dispute, legal hold, fraud inquiry, or safety concern may temporarily prevent physical deletion.
- Held media becomes evidence-only and is not customer-visible beyond what the dispute process requires.
- The participant receives the reason, review status, and final disposition.
- Final media-retention periods require product-owner approval in Section 19.

**Baseline references:** Current Audit Sections 9-12 and 17; Consent Architecture Sections 7-9 and 16.

---

## 10. Exact-Media Publication Approval

### When the request is sent

The exact-media approval request may be sent only after:

1. the employee submits all required stages;
2. the vendor manager approves the private package;
3. the customer can access the completed private proof;
4. any accidental-capture or scope issue is resolved;
5. the vendor selects the specific clips proposed for broader use; and
6. every proposed clip has a stable version for review.

The customer is never asked to choose public visibility before the completed media exists.

### Default proposal

The recommended default publication proposal is **Final Result only**.

Starting Condition and Work in Progress may be proposed separately when they add legitimate proof value and do not create disproportionate privacy exposure. No stage is automatically proposed or approved.

This default is listed for product-owner approval in Section 19.

### Customer exact-media experience

For each proposed clip, the customer or authority holder sees:

- the complete clip as it would appear;
- stage name;
- service and vendor;
- audio state;
- every redaction;
- captions and labels;
- intended audience;
- whether the media can be downloaded or shared by public viewers;
- the identities or categories of people visibly present; and
- the effect of later withdrawal.

The customer may:

- keep every clip private;
- approve all proposed clips;
- approve selected clips only;
- approve a limited authenticated audience;
- decline publication;
- request a retake;
- request cropping, blurring, muting, removal of identifiers, or removal of a stage; or
- report that the decision-maker lacks authority.

No response leaves all proof private.

### Clip-by-clip decisions

Starting Condition, Work in Progress, and Final Result have independent publication decisions.

Approval of one clip does not approve another. A package-level "approve all" decision is permitted only when the customer has been able to review every clip and the decision records each approved media version.

### Required approvals

| Content characteristic | Required approval before broader use |
|---|---|
| Customer-associated service proof | Customer or authorized authority holder |
| Official vendor representation | Vendor manager |
| Identifiable employee face, voice, or personal story | Employee likeness approval |
| Necessary private recording of a minor | Verified guardian for private access; identifiable public publication prohibited by default |
| Bystander or protected non-participant | Individual authority or reliable de-identification; otherwise clip remains private/unusable for publication |
| Audio | Separate approval from every intentionally identifiable speaker |
| Customer-business premises/property | Authorized business representative |
| Public availability | All applicable participant approvals plus admin moderation |

### Redaction and correction

- A customer may request removal of audio, faces, identifiers, private areas, documents, screens, license plates, addresses, access codes, or a stage.
- Redaction creates a new media version.
- The new version must be previewed and approved again by every participant whose earlier approval was tied to the changed media.
- The unredacted version remains private or evidence-only according to retention rules.
- A failed redaction cannot proceed to public moderation.

### Captions and labels

Captions and labels shown with public proof are part of exact-media approval.

Any change after approval requires renewed approval when it:

- changes the service claim;
- identifies a person, property, or location;
- adds customer or employee information;
- changes the meaning, sequence, or result;
- changes the audience; or
- could affect how a reasonable viewer interprets the proof.

Pure accessibility formatting that does not change meaning may be corrected without a new participant decision, but the correction is recorded.

### Vendor approval

The vendor manager confirms:

- the media accurately represents the service;
- the selected clips are appropriate official business proof;
- no unsupported claim is added;
- required customer and employee decisions exist; and
- the public presentation does not misrepresent Starting Condition, Work in Progress, or Final Result.

Vendor approval cannot replace customer, employee, guardian, or protected-person authority.

### Employee likeness

Ordinary hands-on work that does not identify the employee does not require a separate public-likeness decision. A recognizable face, voice, name, personal story, or distinctive identity does.

If employee likeness approval is declined, the clip must be redacted, reframed, kept private, or excluded.

### Minors and bystanders

- Identifiable minor public proof is prohibited by default.
- A guardian decision may support necessary private proof but does not bypass the public prohibition.
- Bystanders must be absent, reliably de-identified, or individually authorized.
- A customer or business representative cannot automatically approve another adult's likeness.

### Admin moderation

Admin moderation occurs after required participant approvals. The admin may:

- approve the exact proposed version and audience;
- reject it;
- flag a concern;
- require correction or redaction; or
- narrow the permitted audience.

The admin may not:

- widen the audience;
- approve a different media version;
- create missing consent;
- change a participant's decision; or
- convert private proof into public proof.

### Public and limited audiences

- **Limited authenticated audience:** Named or qualified viewers who must authenticate before access. It is broader than private customer/vendor proof but narrower than public.
- **Public audience:** Anyone, including unauthenticated viewers, search visitors, and people outside the service relationship.

Approval must identify the maximum audience. Reliance may always apply a narrower audience.

### Effect of replacement or editing

- Replacing an approved clip immediately ends its publication eligibility.
- The replacement remains private until new exact-media approval and admin moderation are complete.
- Material edits, redactions, caption changes, audio changes, or stage substitutions create a new version and require renewed approval.
- The audit history links the earlier and replacement versions without presenting the earlier version publicly.

### Publication outcomes

| Customer decision | Result |
|---|---|
| Keep all proof private | Customer-visible private proof remains complete; no moderation for public use |
| Approve selected public media | Only selected exact versions proceed to vendor confirmation and admin moderation |
| Approve limited authenticated audience | Only selected exact versions proceed for that maximum audience |
| Request correction or redaction | Publication pauses; corrected version returns for exact-media approval |
| Decline publication | Proof remains private; service completion, customer standing, vendor standing, and review access are unaffected |

### Withdrawal

Withdrawal of publication permission removes affected media from Reliance-controlled public or limited access promptly. Historical approval and withdrawal evidence remain. Reliance does not promise removal of copies previously made outside Reliance, but it records the report and supports available takedown action.

**Baseline references:** Current Audit Sections 9-10, 16-18, and Gap Matrix G-04/G-05; Consent Architecture Sections 7-12 and 14-16.

---

## 11. Reviews

Reviews are customer opinions about completed service. They are not consent evidence, recording permission, publication permission, or proof that the customer watched every clip.

### Future review rules

- No 72-hour deadline.
- No review-window expiration.
- No automatic review.
- No synthetic review.
- No automatic five-star rating.
- No rating inferred from silence.
- No reopened deadline.
- No publication pressure.

### When a customer may review

The customer may submit a review after:

- the service is marked complete;
- manager-approved private proof is available to the customer; and
- the customer is verified as the work-record customer or authorized reviewer.

The customer may review before or after deciding whether any media becomes public. Publication choice does not affect review eligibility.

### Must the customer watch the proof?

The final proof must be available and clearly offered before review. Reliance should not require or claim that the customer watched an entire clip merely because it was available. The customer may base the review on the service experience, the proof, or both.

### Public and private review choices

If Reliance supports both:

- **Private feedback** is delivered to the vendor and is not publicly displayed or counted as a public review.
- **Public review** is attributed to the verified completed work record and enters neutral moderation before public display.

The customer may choose either, both where supported, or neither.

### Moderation

Review moderation evaluates authenticity, abuse, prohibited content, privacy, and platform standards. Moderation does not change the customer's rating or words without a transparent correction request.

### Relationship to Trust Score

- Only a genuine customer-submitted review tied to a completed work record may contribute as a review signal.
- A review contributes only after applicable moderation and finalization.
- No review means no review signal, not a negative or positive score.
- Private/public media choice must not change the review's legitimacy.
- Reliance must keep verified service completion, public media, customer review, and Trust Score conceptually separate.

### No review submitted

Nothing happens. The work record remains complete, private or public according to its separate media decisions, and no rating is generated.

### Current behavior to retire

The current baseline contains persisted review expiry, lazy expiration, reopening behavior, immediate best-effort reminder logic, and interface language suggesting possible automatic review after 72 hours. These are current-state facts documented in the audit, not future requirements. Phase 1 removes or neutralizes them before the new workflow is relied upon.

**Baseline references:** Current Audit Section 11, Gap Matrix G-08/G-14, and Final Verdict FV-04; Consent Architecture Sections 1, 7, 13-16.

---

## 12. Withdrawal, Unpublishing, and Disputes

### Separate actions

| Action | What it changes | What it does not automatically change |
|---|---|---|
| Stop future recording | Prevents new capture from the time received | Does not erase earlier valid decision history |
| End public visibility | Removes Reliance-controlled public/limited access | Does not automatically delete private or evidence-only media |
| Delete media | Removes media according to retention and hold rules | Does not erase the consent and deletion-decision history |
| Retain restricted evidence | Preserves minimum necessary proof for a defined reason | Does not permit customer-visible or public distribution |
| Preserve consent record | Keeps the historical fact of request, decision, scope, and withdrawal | Does not keep publication active |

### Withdrawal before recording

- Pending consent may be declined or canceled.
- Granted consent may be withdrawn before the first capture.
- Recording remains or becomes locked.
- Vendor and assigned employee are notified.
- Service may continue without Reliance recording.

### Withdrawal during recording

- The employee stops immediately.
- No additional stage may be captured.
- The active clip is quarantined unless the customer confirms it may remain as private proof.
- Previously confirmed clips remain private while the customer chooses deletion, private retention, or dispute review subject to evidence needs.
- The withdrawal and stop time are immutable evidence.

### Withdrawal after private recording

The customer may:

- keep the proof private;
- request deletion;
- restrict employee or vendor access beyond legitimate business needs;
- dispute scope or accuracy; or
- withdraw any outstanding publication proposal.

A deletion request follows retention, hold, and failure rules rather than silently deleting history.

### Withdrawal of public-publication approval

- Reliance-controlled public and limited access is disabled immediately upon authenticated withdrawal.
- Vendor, admin, and affected employee/guardian are notified.
- The customer sees withdrawal status.
- Historical publication dates, audience, approval, and withdrawal remain immutable.
- Previously copied external media may require separate takedown action; Reliance must not promise control it does not have.

### Vendor withdrawal

The vendor manager may withdraw official business representation at any time. The public proof is unpublished unless an independent customer-owned copy remains available outside the vendor's official Reliance proof. Vendor withdrawal does not erase the customer work record.

### Employee-likeness withdrawal

An identifiable employee may withdraw future public use of personal likeness. Reliance promptly unpublishes or redacts the affected version. Ordinary private service evidence may remain restricted where legitimately needed.

### Guardian withdrawal

A verified guardian may stop future capture and withdraw approved distribution involving the minor. Identifiable public-minor proof is prohibited by default, so guardian withdrawal primarily affects private capture, limited access, and evidence retention.

### Disputes

| Dispute type | Immediate state | Decision owner |
|---|---|---|
| Customer says consent was absent or forged | Narrow to evidence-only; stop recording/public access | Admin reviews identity and consent evidence |
| Customer says media exceeded scope | Narrow affected media; preserve versions | Admin with customer/vendor evidence |
| Vendor says customer withdrawal should not delete proof | Unpublish; retain minimum restricted evidence pending review | Admin applies retention rule |
| Employee says manager requested unauthorized recording | Keep recording locked; preserve report | Admin/Reliance role review |
| Vendor and customer disagree about service quality | Preserve proof; do not treat as consent dispute unless privacy is also raised | Vendor response and neutral dispute path |
| Authority-holder identity is challenged | Pause recording/publication | Admin verifies role and authority |
| Bystander or minor concern | Unpublish/quarantine immediately | Admin applies protected-person rule |

### Content correction

- Metadata correction that does not change media content is recorded.
- Material media correction creates a new version.
- New or replaced media requires new manager review.
- Any public proposal requires renewed exact-media approval.
- The original version is preserved only as long as needed for history, dispute, or hold.

### Legal hold

A legal hold:

- pauses deletion;
- narrows media to evidence-only;
- records the authority and reason for the hold;
- limits access to authorized personnel;
- does not continue public visibility; and
- ends through a recorded release and final disposition.

### Deletion request

The request records:

- requester identity and authority;
- requested scope;
- affected work record and media;
- active publication state;
- dispute or hold conflicts;
- decision;
- physical deletion outcome; and
- any retained minimum evidence with reason and review date.

### Appeal

A participant may appeal a material consent, publication, moderation, withdrawal, or retention decision. The appeal reviewer must not be the sole maker of the original decision when practical. The original record remains intact, and the appeal adds a new outcome.

**Baseline references:** Current Audit Sections 16-18 and Gap Matrix G-05/G-06/G-12; Consent Architecture Sections 8-10 and 15-16.

---

## 13. Minors, Guardians, and Protected Non-Participants

### Universal minor rule

Reliance treats a person as a minor when:

- the customer or representative identifies the person as under the applicable age of majority;
- the service context reasonably indicates a child;
- the employee observes that an intended or incidental subject may be a child; or
- age is uncertain and the person reasonably appears to be a minor.

Uncertainty is resolved by applying minor protection until verified otherwise.

### When minor recording is prohibited

Recording is prohibited when:

- the minor is not necessary to the proof-of-service purpose;
- verified guardian authority is absent;
- the adult customer is not the guardian and cannot establish authority;
- the setting would expose highly private, medical, educational, changing, bathing, sleeping, or similarly sensitive activity;
- the recording would capture unrelated children or groups;
- audio would capture the minor or surrounding people without required authority; or
- safe framing or de-identification cannot be maintained.

### Necessary private recording

Necessary private recording involving a minor requires:

- verified guardian identity;
- guardian relationship and authority declaration;
- specific service purpose;
- exact private scope;
- audio off unless separately necessary and authorized;
- manager review before unlock;
- employee certification;
- narrow customer/vendor audience; and
- heightened withdrawal and deletion handling.

### Public publication involving a minor

The recommended platform rule is that identifiable minors may not appear in public proof.

Public proof may use a version only when the minor is reliably absent or de-identified through retake, cropping, blurring, or muting and the resulting exact version receives all otherwise required approvals.

Whether Reliance will ever permit an exception for identifiable minors is an open product-owner decision in Section 19. The recommended default is no exception.

### Guardian evidence

Reliance records:

- guardian identity;
- verified contact;
- relationship to the minor;
- claimed authority;
- minor identifier sufficient to distinguish the subject without unnecessary exposure;
- scope;
- decision;
- verification method;
- time;
- withdrawal; and
- final disposition.

Reliance does not require unnecessary identity-document collection for every ordinary case. A challenged or high-risk claim may require admin review before recording.

### Adult customer who is not the guardian

The adult may authorize premises or property they control but may not authorize the minor's identifiable recording. The employee must exclude the minor or recording remains locked for that scope.

### Bystanders

- Incidental appearance triggers pause, reframing, retake, or reliable de-identification.
- Customer or vendor authority over a location does not grant adult bystander likeness or audio permission.
- A bystander who cannot be avoided must become an identified authority participant for the intended capture or the clip remains unusable for broader access.

### Customer-business employees and visitors

- The business representative authorizes premises and business property only within their role.
- Employees, visitors, customers, and contractors are avoided unless their intentional appearance is necessary and individually authorized.
- Workplace status alone does not create public-likeness or audio permission.
- Confidential operations and customer information remain outside the frame.

### Household members

- A resident customer does not automatically control every household member's likeness or voice.
- Household members are asked to leave the frame, are individually authorized, or the employee waits and retakes.
- Private premises authority does not override personal identity rights.

### Employee likeness

- Vendor authorization covers assigned work activity.
- Identifiable face, voice, name, biography, or personal story requires employee publication approval.
- Decline leads to retake, crop, blur, mute, or private-only proof.

### Corrective options

In order of preference:

1. avoid the person or information;
2. reframe;
3. retake;
4. crop;
5. blur or obscure;
6. mute;
7. keep private;
8. retain evidence-only during a dispute; or
9. delete according to approved retention rules.

Every material correction creates a new media version and ends prior exact-media approval for the changed version.

### Dispute and withdrawal

A minor, guardian, bystander, protected non-participant, or affected employee may report unauthorized inclusion. Reliance immediately narrows access, preserves evidence of the report, verifies authority, and records unpublishing, correction, deletion, or restricted-retention outcome.

**Baseline references:** Current Audit Section 19 and Gap Matrix G-07; Consent Architecture Sections 2, 4, 6-7, 13-15, and 17.

---

## 14. Notifications

### Notification standards

- **Immediate:** Sent when the event blocks recording, changes authority, changes public access, or raises privacy/safety risk.
- **Standard:** Sent promptly for ordinary workflow progress.
- **SMS:** Used for short transactional alerts when a verified mobile number and messaging permission are available.
- **Email:** Used for complete context, secure link delivery, and durable participant confirmation.
- **In-app:** Becomes the persistent current-status source for signed-in participants.
- A notification never substitutes for consent.
- Messages reveal only the minimum information the recipient is entitled to receive.

### Retry classes

| Class | Retry behavior | Failure escalation |
|---|---|---|
| **Critical decision or privacy event** | Initial attempt plus two retries across available channels within two hours | Persistent in-app alert; vendor manager and admin/support notified if every external channel fails |
| **Consent/publication request** | Initial attempt plus two retries within 24 hours; vendor may manually resend without creating duplicate consent | Vendor sees delivery failure and must correct contact or proceed without recording/publication |
| **Standard workflow event** | Initial attempt plus two retries within 24 hours | Persistent in-app status and vendor/admin follow-up when the event blocks completion |

### Notification matrix

| Trigger | Recipient | SMS | Email | In-app | Urgency | Retry | Failure escalation | Evidence stored |
|---|---|---|---|---|---|---|---|---|
| Consent requested | Intended customer/representative; vendor status | Yes if verified mobile | Yes if verified email | Customer/vendor | Standard but pre-service blocking | Request class | Vendor corrects contact; recording stays locked | Request ID, channels, provider result, attempts, link version, expiry |
| Consent accepted | Customer/representative, vendor, assigned employee | Confirmation | Full confirmation | All affected roles | Immediate | Critical class | Recording remains locked until confirmation state is durable; admin/support if inconsistent | Actor, verification, authority, scope, audio, location, versions, time |
| Consent declined | Customer, vendor, assigned employee | Confirmation | Full confirmation | All affected roles | Immediate | Critical class | Recording remains locked regardless of delivery status | Actor, decision, time, delivery attempts |
| Wrong recipient/not authorized | Reporter; vendor manager | Acknowledgment if safe | Acknowledgment | Vendor; reporter if account exists | Immediate | Critical class | Invalidate action link; support/admin if repeated mismatch | Reporter channel, request, reason category, invalidation, correction |
| Consent expired | Customer, vendor, assigned employee | Optional short alert | Yes | Yes | Immediate at expiry | Standard class | Recording stays locked; vendor may issue new request | Expiry event, prior request, notices |
| Employee assigned | Assigned employee; vendor | Yes | Yes | Yes | Standard | Standard class | Vendor follows up; no recording until employee receives access | Assignment, channels, attempts |
| Recording unlocked | Assigned employee; vendor status | Optional | Optional summary | Yes | Immediate | In-app plus standard external if enabled | If state mismatch, relock and alert vendor/admin | Gate results, unlock time, employee |
| Recording blocked | Assigned employee; vendor | Yes for material block | Yes with reason category | Yes | Immediate | Critical class | Manager intervention; admin/support for identity or system issue | Block reason, gate, attempt, location/consent status |
| Package submitted | Vendor manager; employee confirmation | Optional | Yes | Yes | Standard | Standard class | Vendor status persists until reviewed | Package version, submitter, time, delivery |
| Manager correction requested | Assigned employee; vendor | Yes | Yes | Yes | Immediate | Critical if work is waiting | Vendor follows up or reassigns | Manager, reason, affected stages, version |
| Manager approved | Customer delivery process; employee/vendor confirmation | Optional | Yes | Yes | Standard | Standard class | Customer delivery retries separately | Manager, package version, decision, time |
| Exact-media approval requested | Customer/authority holder; vendor status; applicable employee/guardian | Yes | Yes | Yes | Standard | Request class | Media remains private; vendor sees failure | Proposed versions, audience, recipients, attempts, expiry if adopted |
| Publication approved by participant | Approver, vendor, other required participants | Confirmation | Full confirmation | Yes | Immediate | Critical class | Media remains private until durable and all approvals exist | Actor, authority, exact versions, audience, time |
| Publication declined | Customer/authority holder; vendor; affected participants | Confirmation | Confirmation | Yes | Immediate | Critical class | Proof remains private | Actor, versions, decision, time |
| Media made public | Customer, vendor, affected employee/guardian | Yes | Yes with public link/context | Yes | Immediate | Critical class | If notice state conflicts, public access pauses for review | Public versions, audience, start time, moderation and approvals |
| Publication withdrawn | Customer/withdrawer, vendor, admin, affected employee/guardian | Confirmation | Full confirmation | Yes | Immediate | Critical class | Public access is disabled even if notices fail | Actor, authority, versions, withdrawal time, restriction |
| Media unpublished | Customer, vendor, affected employee/guardian | Yes | Yes with reason category | Yes | Immediate | Critical class | Admin/support follows up on external-copy reports | Versions, prior audience, unpublish reason/time |
| Privacy/identity/authority dispute | Affected customer, vendor, admin; employee if relevant | Short alert | Full context | Yes | Immediate | Critical class | Access stays narrow; escalate to neutral reviewer | Reporter, category, media, restriction, assigned reviewer |
| Deletion request | Requester; vendor if work record affected; admin | Acknowledgment | Full acknowledgment | Yes | Immediate | Critical class | Escalate if acknowledgment or processing state fails | Requester, scope, authority, holds, status |
| Final disposition | Every directly affected participant | Optional summary | Full decision | Yes | Standard or immediate if access changes | Critical for unpublishing/deletion; otherwise standard | Admin/support for undelivered outcome | Decision, actor, reason, retained/deleted media, time |

### Delivery failure rule

Failure to deliver a notification does not reverse a valid decision, create permission, or widen access. Reliance records the failure, uses available alternate channels, presents persistent status, and escalates when the participant must act before the workflow can proceed.

**Baseline references:** Current Audit Section 7, Consent Models DM-04, Security SE-05, and Gap Matrix G-12; Consent Architecture Sections 10-11.

---

## 15. Audit Evidence

### Evidence objective

Consequential decisions must be independently understandable later. A reviewer should be able to determine:

- who acted;
- what authority they claimed;
- what they saw;
- what they decided;
- what media and audience were covered;
- what happened next; and
- whether the decision was later changed, withdrawn, disputed, or fulfilled.

### Minimum durable evidence

| Evidence category | Required durable fields |
|---|---|
| Actor | Stable actor identity; verified contact; claimed role; authority scope; account identity when the actor uses an account |
| Work relationship | Work record; vendor; vendor manager; assigned employee; customer; representative when one acts; guardian when a minor is involved |
| Service context | Service, service date, location selection, saved location snapshot, recording purpose |
| Subject and scope | Assessment version and answers; planned subject; people/sensitive categories; restrictions; protected-person status |
| Recording consent | Exact consent content/version shown; related policy content/version shown; grant/decline/expiry/withdrawal; scope; initial audience |
| Audio | Off/on state; purpose; each required audio authority and decision |
| Verification | Signed-request identifier; matching account or one-time-code method; OTP result; failed attempts; authority declaration; recipient correction |
| Technical context | Timestamp; IP address; user agent; device/session reference; reported location and verification result when used |
| Notifications | Channel; destination category; provider; attempt time; success/failure; error category; retry; final delivery state |
| Recording event | Employee; assignment; stage; start/end; declared and verified duration; capture method; incident; confirmation |
| Media identity | Stable media identity; cryptographic content hash; file type; size; creation time; work record; stage |
| Media version | Version number; predecessor; replacement/redaction/edit reason; audio state; captions/labels; current status |
| Employee certification | Certification version; assignment; scope; audio; location status; time; repeated certification after material change |
| Manager decision | Actor; exact package/media version; approve/correct/restrict/escalate; reason; time |
| Publication decision | Actor; authority; exact media versions; selected clips; redactions; captions; audience; approval/decline; time |
| Admin decision | Actor; exact version; moderation outcome; reason; restriction; time |
| Visibility | Audience state; first-public time; limited/public link state; every audience change |
| Withdrawal/unpublishing | Actor; authority; scope; received time; public-disable time; affected versions; external-copy report |
| Dispute/appeal | Reporter; category; restriction; reviewer; evidence considered; decision; appeal; final state |
| Deletion/retention | Requester; authority; scope; hold; decision; physical deletion attempt/result; retained minimum evidence and reason |

### Immutable evidence

The following never changes in place:

- original request and presentation;
- actor and claimed authority at the time;
- identity-verification method and result;
- consent, decline, expiry, supersession, and withdrawal events;
- assignment and reassignment events;
- employee certification events;
- location-verification attempts and outcomes;
- recording start/end and stage confirmation events;
- original media content hash and version lineage;
- notification attempts;
- manager/admin/publication decisions;
- audience changes;
- dispute and appeal events;
- deletion attempts and outcomes; and
- legal-hold placement and release.

A correction adds a new event. It does not rewrite the original.

### Operational fields that may change

The following current-state fields may change, but every change must produce immutable history:

- current assignee;
- current consent status;
- current package status;
- current moderation status;
- current audience;
- current notification retry state;
- current dispute state;
- current hold state;
- current deletion state;
- customer or vendor contact information; and
- current media version.

### Evidence minimization

Immutability applies to the history needed to prove decisions, not to unlimited storage of sensitive content. Evidence should use identifiers, hashes, reason categories, and restricted references where possible rather than duplicating full private media or personal data.

### Evidence-copy rule

The customer receives a decision confirmation. The vendor sees workflow evidence relevant to business responsibility. Employees see evidence relevant to their assignment and certification. Admin access is limited to defined review purposes. No role receives unrelated sensitive evidence.

**Baseline references:** Current Audit Sections 6-7, 14, 16-18, Gap Matrix G-03/G-09/G-10/G-12, and Final Verdict FV-02/FV-03; Consent Architecture Sections 8-12.

---

## 16. Failure and Edge Cases

| Scenario | Required system response | Can service continue? | Evidence and notification |
|---|---|---|---|
| Customer has no email | Use verified mobile and SMS one-time code; if no mobile either, use only an approved in-person alternative or keep recording locked | Yes, without recording if no verified path | Record unavailable channel, verification method, and vendor/customer notice |
| Customer has no mobile phone | Use verified email and email one-time code | Yes | Record channel, code result, and decision |
| Wrong email or phone | Invalidate request; do not count as decline; vendor corrects contact and issues new request | Yes; no recording until corrected | Record wrong-recipient report, invalidation, correction, and notices |
| Shared family email | Recipient identifies the actual authority holder and verifies role; shared inbox possession alone is insufficient | Yes; recording waits | Record individual actor, account/code verification, role, authority |
| Shared business phone | Identify the individual and business role; phone possession alone does not authorize premises or people | Yes; recording waits | Record actor, role, authority scope, verification |
| Customer does not respond | No consent; recording remains locked; request may be resent within validity | Yes, without recording | Record attempts, expiry, vendor/employee status |
| Customer declines | Lock recording; notify vendor and employee; never treat as negative review or public-choice refusal | Normally yes, without recording | Record affirmative decline and confirmation |
| Consent expires | Lock recording; vendor may issue a new request if scope is unchanged and recording has not begun | Yes, without recording | Record expiry and new-request relationship |
| Service starts before consent | Service may start, but camera remains locked; no retroactive or staged recreation of Starting Condition | Yes | Record that service began without proof; notify vendor/employee |
| Employee records without permission outside Reliance | Do not accept as normal proof; quarantine any submitted copy; open authority/privacy review | Service may continue; recording does not | Record report, source, restriction, investigation, notifications |
| Location cannot be verified | Keep camera locked; allow retry or approved alternate verification; no silent manager override | Yes, without recording | Record attempts, accuracy, reason, exception review |
| Poor GPS accuracy | Ask employee to improve conditions and retry; if still poor, use approved alternate verification or proceed without recording | Yes | Record accuracy, retries, final decision |
| Service location changes | Stop recording; update location and subject assessment; identify authority; obtain new consent when needed; reverify location | Yes | Record old/new location, reason, superseded decision, notices |
| Assigned employee changes | Revoke former employee authority; notify both; new employee reviews scope and certifies before unlock | Yes | Record reassignment, revoked access, new certification |
| Camera permission denied | Explain that recording cannot start; employee may retry device permission or continue service without recording | Yes | Record blocked state, not private device settings |
| Upload fails | Do not mark stage complete; preserve retry state without widening access; notify employee/vendor; prevent submission | Yes | Record attempt, failure category, retry, final result |
| Audio accidentally included | Quarantine clip; retake or produce a muted new version; do not deliver/publicize original | Yes | Record audio incident, versions, manager decision, affected notice |
| Bystander enters | Stop, reframe, and retake; if unavoidable, obtain individual authority or keep clip unusable for broader access | Yes | Record incident when clip existed or work was interrupted |
| Minor enters | Stop immediately; retake without minor; guardian path only if minor is necessary | Yes | Record minor-risk event without unnecessary identifying detail |
| Confidential document is captured | Quarantine; retake, crop, or redact; manager reviews; original never public | Yes | Record incident, media versions, access restriction |
| Customer withdraws mid-service | Stop future capture; quarantine active clip; preserve prior clips privately pending deletion/retention decision | Yes | Record withdrawal and stop time; notify vendor/employee |
| Customer approves publication then changes mind | Immediately disable Reliance-controlled public/limited access; begin external-copy support if reported | Yes | Record approval, public period, withdrawal, unpublishing, notices |
| Public media is copied outside Reliance | Unpublish Reliance source when required; preserve report; assist available takedown steps without promising control of third-party copies | Yes | Record source, report, known destination, actions, outcome |
| Vendor and customer disagree | Narrow access; preserve proof; separate privacy/authority from service-quality issues; use neutral review | Yes | Record claims, restriction, decision, appeal |
| Customer claims they never consented | Immediately narrow access; verify actor/contact/OTP/authority evidence; do not rely on link possession alone | Yes | Record claim, evidence review, outcome, notifications |
| Recipient says they were not intended customer | Invalidate request; record wrong-recipient rather than decline; vendor corrects data | Yes; no recording until corrected | Record report and correction chain |
| Manager and admin disagree | Admin controls Reliance eligibility; vendor may appeal; admin cannot invent participant permission | Yes | Record both decisions, reasons, appeal |
| Media is replaced after approval | End prior exact-media approval; unpublish old version if live; require new review and approvals | Yes | Record version lineage, replacement, new decisions |
| Vendor account is suspended | Block new recording and public distribution; preserve customer access to legitimate private records unless safety requires restriction | Underlying offline service is outside Reliance; no new Reliance recording | Record suspension, affected records, access decisions, notices |
| Customer account is deleted | Unpublish customer-associated public media pending deletion/retention review; preserve minimum work/consent history; provide final disposition | Service may already be complete | Record account request, media effects, holds, deletion results |
| Physical blob deletion fails | Hide media from every ordinary audience; mark deletion pending; retry and escalate; never report completion falsely | Yes | Record every delete attempt, error category, retry, final outcome |

### General failure rule

Failures default to:

1. no new recording;
2. no audience expansion;
3. private or evidence-only access;
4. preserved decision history;
5. participant notice; and
6. service continuation without recording whenever feasible.

**Baseline references:** Current Audit Sections 6-9, 17-18, 21-23, and Gap Matrix; Consent Architecture Sections 6, 8, 10-12, and 15.

---

## 17. Current-to-Future Gap Map

This table separates verified current behavior from the approved future requirement. "Remove" applies only to the identified obsolete behavior, not to unrelated review, consent, media, or work-record functions.

| Future requirement | Current state | Current file or model | Keep as-is | Modify | Replace | Remove | New capability required | Risk if not changed |
|---|---|---|---|---|---|---|---|---|
| Public choice occurs only after exact media exists | **Partially implemented:** customer currently chooses public/private before completed clips exist | `src/app/consent/[token]/page.tsx`; `src/app/api/consent/accept/route.ts`; consent fields in `prisma/schema.prisma` | Keep advance recording decision and private default | Separate advance recording scope from later audience | Replace advance public/private decision as publication authority | Remove advance choice as authority for completed public media | Post-capture exact-media request, clip selection, audience, versioned decision | Existing evidence proves advance preference, not approval of actual media |
| Current raw bearer-token consent must become verified consent | **Partially implemented:** raw bearer-token possession authorizes acceptance/decline | `src/app/api/consent/[token]/route.ts`; `src/app/api/consent/accept/route.ts`; `src/app/api/consent/decline/route.ts`; `ConsentRecord` | Keep secure request-link concept and decision event history | Add verified actor/contact and authority | Replace link-only decision authorization | Remove signed-link-only approval path | Account or OTP verification plus authority declaration | Intended customer may not be independently proven |
| Unauthenticated consent-request creation must become authenticated vendor action | **Partially implemented:** referenced records validated; authenticated vendor membership not required | `src/app/api/consent/request/route.ts` | Keep work-record/vendor/session validation | Require vendor manager/member authority and valid pre-recording state | Replace public request creation with role-controlled creation | Remove unauthenticated request generation | Request actor/role evidence and resend controls | Unauthorized caller may create or supersede requests |
| Durable registration assent evidence | **Partially implemented:** policy links shown; registration decisions/version/time not comprehensively stored | `src/app/auth/register/page.tsx`; `src/app/api/customer/register/route.ts`; `src/app/api/vendor/register/route.ts`; `prisma/schema.prisma` | Keep registration and current policies as baseline until separately revised | Capture actor, version, presented content, decision, time, SMS state | Replace display-only acceptance assumption | Remove reliance on mere registration/continued use as evidence | Versioned account assent history | Vendor/customer responsibility evidence remains incomplete |
| Durable vendor and employee recording-duty acknowledgment | **Partially implemented:** operational invite/preview confirmations exist without durable legal-duty acknowledgment | `src/app/vendor/invite/[token]/page.tsx`; `src/app/api/vendor/invite/[token]/route.ts`; `src/app/employee/jobs/page.tsx`; `prisma/schema.prisma` | Keep invite, assignment, preview, and stage confirmation | Add versioned vendor/employee role acknowledgments | Replace operational reminder as sole evidence | Do not remove preview confirmation | Durable role-assent and employee certification history | Employees/vendors may not be tied to the duties they were shown |
| Tokens are not stored raw | **Partially implemented:** consent and employee-invite tokens stored raw; other verification tokens use hashes | `ConsentRecord` and employee-invite fields in `prisma/schema.prisma`; consent/invite routes | Keep expiring signed-link concept | Store non-reversible token representations and rotation history | Replace raw persistent token storage | Remove raw reusable secret storage | Token rotation, invalidation, status-view separation | Token exposure can permit unauthorized access or decisions |
| Customer may withdraw and trigger unpublishing | **Partially implemented:** revoked vocabulary exists; no complete self-service withdrawal-to-unpublish path | `src/lib/consent-flow.ts`; consent and media route set reviewed in audit | Keep existing status/event concepts | Add withdrawal states and audience restriction across work record/media | Replace ad hoc support-only handling | Remove any assumption that prior approval remains irrevocable | Authenticated withdrawal, immediate unpublish, notices, final disposition | Customer cannot reliably end future use or public visibility |
| Exact-media publication approval | **Not implemented as required:** no post-capture customer confirmation of actual media | Consent page/accept route; customer media routes; manager/admin moderation paths | Keep manager review, customer delivery, and admin moderation stages | Insert customer exact-media decision between delivery and public moderation | Replace advance publication authority | Remove use of pre-capture visibility preference as final authority | Media-version, clip, caption, redaction, and audience approval | Public media can exceed what customer actually reviewed |
| Audio remains off by default | **Current implementation:** browser capture explicitly requests no audio | `src/app/employee/jobs/page.tsx` | Keep default off | Add explicit separate audio pathway only if product owner later authorizes | No replacement needed | Remove any fallback path that silently imports unauthorized audio | Audio detection, quarantine, separate decision evidence if audio is introduced | Native/fallback media may contain audio without clear authorization |
| Location verification across applicable business/residence paths | **Current implementation with evidence gaps:** server distance checks use saved target and coordinates; spoof/attempt history limited | `src/lib/job-recording-location.ts`; `src/app/api/employee/jobs/[jobId]/verify-location/route.ts`; `src/app/api/vendors/[vendorId]/media/sessions/route.ts`; `Booking` metadata | Keep server-side verification and work-record location snapshot | Apply consistently to all three location selections; add full attempt evidence and exception rules | Replace informal/manual silent overrides | Remove any location check based only on current profile address after work-record creation | Alternate verification review, complete attempt history, changed-location consent path | Wrong-location recording or inconsistent proof may be accepted |
| Three required service stages | **Current implementation:** Starting Condition, Work in Progress, Final Result with staged completion | `src/app/employee/jobs/page.tsx`; `src/app/api/employee/jobs/[jobId]/stage/route.ts`; `src/app/api/employee/jobs/[jobId]/complete/route.ts`; `MediaSession` and `MediaAsset` in `prisma/schema.prisma` | Keep stages and 30-second staged proof concept | Add scope reminder, incident handling, version lineage | No replacement needed | Remove no stage | Stage-level certification and correction evidence | Without scope controls, correct stages may still contain unauthorized content |
| Manager review before customer delivery/public proposal | **Current implementation:** manager approves/rejects completed package | `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.ts`; vendor job UI | Keep manager review | Distinguish private approval, correction, restriction, and publication proposal | No replacement needed | Remove no manager-review capability | Manager evidence consistently tied to exact package version | Ambiguous manager approval may be mistaken for customer/public consent |
| Admin moderation after participant approvals | **Current implementation:** package/stage moderation and visibility controls exist | `src/app/api/admin/media/packages/[bookingId]/moderate/route.ts`; `src/app/api/admin/media/[assetId]/moderate/route.ts`; admin media UI | Keep approve/reject/flag and restrictive visibility authority | Require exact participant approvals before public eligibility and consistent audit logging | Replace any admin-selected visibility that exceeds participant maximum | Remove admin ability to substitute for missing customer decision | Approval dependency check and complete admin audit evidence | Admin may appear to create public authority rather than enforce eligibility |
| Reversible soft deletion remains a short-term operational state | **Current implementation:** archive and `deletedAt` states hide media; restore supported | `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts`; `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`; media fields in `prisma/schema.prisma` | Keep reversible quarantine/archive for mistakes and disputes | Add defined transition to purge or justified retention | Replace indefinite soft deletion as final disposition | Remove indefinite hidden-but-retained default | Retention schedule, deletion queue, hold conflict, participant status | Hidden media and blobs may remain indefinitely |
| Verified physical purge | **Partially implemented:** physical blob-delete helper exists but reviewed deletion paths do not consistently use it; no purge scheduler found | `src/lib/azure-blob-storage.ts`; vendor media/job deletion routes | Keep available physical-delete capability | Connect approved deletion outcomes to file and record disposition | Replace manual/ad hoc purge expectation | Remove false completed-deletion state when blob remains | Durable purge workflow, retries, orphan cleanup, failure escalation | Reliance may report deletion while physical media persists |
| Minor, guardian, and protected-person controls | **Partially implemented:** no age/guardian workflow or minor-specific lifecycle found | `src/app/auth/register/page.tsx`; `src/app/consent/[token]/page.tsx`; `src/app/employee/jobs/page.tsx`; `prisma/schema.prisma` | Keep general consent and moderation controls | Add assessment, guardian authority, employee stop rules, public-minor prohibition | Replace assumption that customer controls everyone present | Remove any broad location-owner implication for personal likeness | Guardian verification, protected-person incidents, de-identification state | High privacy and authority risk for children and bystanders |
| Review flow has no 72-hour concept or automatic implication | **Current obsolete behavior for desired future:** expiry timestamp, lazy expiry/reopening, immediate reminders, and UI suggestion of automatic review exist | `src/lib/review-capture.ts`; `src/lib/review-notifications.ts`; `src/app/reviews/ReviewCard.tsx`; `src/app/api/reviews/window/start/route.ts`; `src/app/api/reviews/window/expire/route.ts`; `ReviewWindow` in `prisma/schema.prisma` | Keep genuine customer review submission, ownership, moderation, and Trust Score separation | Make reviews available after completion without deadline; update workflow text | Replace window lifecycle with simple optional review availability | Remove expiry, reopening, countdown/deadline, automatic-review implication, and associated misleading copy | No-deadline optional review status and current-user notice | Old behavior conflicts with explicit product direction and may imply synthetic or forced outcomes |
| Cryptographic media identity and version lineage | **Partially implemented:** type, duration, stage, and storage checks exist; no stored content hash found | `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`; `src/lib/server-video-duration.ts`; `MediaAsset` in `prisma/schema.prisma` | Keep MIME, duration, stage, and storage validation | Add hash, version lineage, replacement/redaction relationship | Do not replace current validation | Remove no valid upload control | Content hash, provenance status, orphan cleanup, exact-media binding | Exact approval cannot be proven against an unchanged file |
| Consistent immutable audit logging | **Partially implemented:** notification and selected admin/member events logged; consequential routes vary | `AdminAuditLog` and `ConsentEvent` in `prisma/schema.prisma`; `src/lib/notifications/notification-audit.ts`; `src/app/api/admin/account-actions/route.ts`; `src/app/api/admin/reviews/[reviewId]/moderate/route.ts`; package moderation and vendor job-action routes | Keep existing audit models and writers | Apply one event standard across consent, recording, media, moderation, withdrawal, deletion | Replace route-specific incomplete evidence as final standard | Remove silent consequential state changes | Unified actor/authority/version/event history | Decisions have uneven evidentiary strength and are difficult to reconstruct |

### Gap-map interpretation

- **Keep as-is** means the verified behavior is compatible with the future workflow.
- **Modify** means preserve the capability while adding or changing behavior.
- **Replace** means the current behavior cannot remain the governing future behavior.
- **Remove** identifies only the obsolete or unsafe portion.
- **New capability required** identifies a future product need, not work performed by this specification.

**Baseline references:** Current Audit Sections 1-22 and Gap Matrix G-01 through G-14; Consent Architecture Sections 1-19.

---

## 18. Implementation Phases

No phase is implemented by this document. Each phase begins only after product-owner approval and should have its own implementation plan, validation scope, and rollback decision.

### Phase 1: Remove obsolete review behavior and misleading copy

- **Objective:** Make the future review experience optional and deadline-free.
- **Dependencies:** Product-owner confirmation that the 72-hour concept is retired.
- **User-visible changes:** No countdown, expiry, automatic-review suggestion, forced reminder deadline, or reopened window.
- **Backend changes anticipated:** Retire expiry/reopen lifecycle and deadline-driven reminder behavior while preserving genuine review ownership, submission, moderation, and Trust Score inputs.
- **Migration risk:** Medium. Existing review-window records may contain active or expired states.
- **Rollback consideration:** Preserve a snapshot of prior state for recovery without restoring misleading customer-facing behavior.
- **Acceptance criteria:** A customer can submit or decline to submit a review without a deadline; no rating is created from silence; existing valid reviews remain intact.

### Phase 2: Secure consent-request authorization and identity verification

- **Objective:** Ensure only authorized vendor actors create requests and only verified intended decision-makers decide.
- **Dependencies:** Approved verification tiers, request expiry, wrong-recipient, resend, and contact-correction rules.
- **User-visible changes:** Account or one-time-code verification, authority-role confirmation, clearer pending/wrong-recipient states.
- **Backend changes anticipated:** Vendor-role enforcement, token hardening/rotation, OTP/account verification evidence, one active request across channels.
- **Migration risk:** High. Current pending links and raw token records require controlled transition.
- **Rollback consideration:** Do not fall back to unverified approval. If transition fails, keep recording locked and issue a new verified request.
- **Acceptance criteria:** Unauthenticated callers cannot create requests; link possession alone cannot approve; wrong recipients cannot act; resends do not create duplicate decisions.

### Phase 3: Vendor and employee assent evidence

- **Objective:** Establish durable responsibility evidence for vendor managers and employees.
- **Dependencies:** Approved vendor/employee responsibility content and version-control process; policies are aligned later in Phase 9.
- **User-visible changes:** Vendor role acknowledgment and employee pre-recording certification at the correct moments.
- **Backend changes anticipated:** Durable actor/version/time/role evidence; certification renewal after reassignment or scope change.
- **Migration risk:** Medium. Existing active vendor members and employees need prospective acknowledgment without rewriting historical facts.
- **Rollback consideration:** Preserve existing access states but block new recording when required future acknowledgment cannot be established.
- **Acceptance criteria:** Every new recording links to an accountable vendor actor and certified current employee.

### Phase 4: Universal pre-recording workflow across all three locations

- **Objective:** Apply subject-based consent, authority, location, notice, and employee gates consistently to vendor address, customer residence, and customer business.
- **Dependencies:** Phases 2-3; approved subject assessment, service continuation rule, and location exception rule.
- **User-visible changes:** Short assessment, correct consent/notice path, scope summary, stage reminders, explicit locked reasons.
- **Backend changes anticipated:** Scope/risk state, authority requirements, gate evaluation, changed-location handling, incident status.
- **Migration risk:** High. Existing open work records may lack assessment and authority fields.
- **Rollback consideration:** Existing open records default to private/locked until completed through the new assessment; do not infer approval.
- **Acceptance criteria:** All three location types pass an end-to-end matrix; vendor-only path is limited to vendor-owned subjects; customer-controlled recording requires affirmative consent.

### Phase 5: Post-capture exact-media publication approval

- **Objective:** Move public authority from advance preference to exact completed media.
- **Dependencies:** Phase 4; media-version identity and customer delivery; product-owner approval of default proposed clips and limited audience.
- **User-visible changes:** Private delivery first, clip-by-clip preview, all/some/none/limited/redaction decisions, publication status.
- **Backend changes anticipated:** Publication request, exact media version/audience decisions, approval dependencies, reapproval after edit/replacement.
- **Migration risk:** High. Existing public media may rely on advance visibility choice.
- **Rollback consideration:** Failure defaults affected media to private; never restore public access without valid exact-media evidence.
- **Acceptance criteria:** No new public proof exists without exact-media customer authority, vendor approval, applicable likeness/guardian authority, and admin moderation.

### Phase 6: Withdrawal, unpublishing, and retention

- **Objective:** Allow participants to end future use while preserving truthful minimum evidence.
- **Dependencies:** Phase 5; approved retention periods, deletion rights, hold rules, and response targets.
- **User-visible changes:** Withdraw, unpublish, delete-request, hold/restriction status, and final-disposition confirmations.
- **Backend changes anticipated:** Withdrawal states, immediate audience restriction, deletion/purge lifecycle, retry/failure escalation, restricted evidence state.
- **Migration risk:** High. Existing soft-deleted, archived, public, and orphaned files require classification.
- **Rollback consideration:** Rollback may restore workflow availability but must not republish withdrawn media.
- **Acceptance criteria:** Authenticated withdrawal promptly disables public access; deletion failures remain visible and retried; historical decisions remain intact.

### Phase 7: Minors, protected non-participants, and redaction

- **Objective:** Introduce heightened authority and correction paths for people who did not initiate the work.
- **Dependencies:** Guardian/public-minor product decision; redaction standards; Phase 5 media versioning.
- **User-visible changes:** Minor/bystander assessment, guardian path, stop/retake guidance, redaction/private outcomes.
- **Backend changes anticipated:** Guardian/representative authority evidence, protected-person incidents, de-identification and replacement versions.
- **Migration risk:** Medium to high. Existing public media may contain people without these classifications.
- **Rollback consideration:** Keep affected media private if guardian/protected-person workflow is unavailable.
- **Acceptance criteria:** Identifiable minor public proof is blocked by default; business/residence authority cannot substitute for individual likeness; corrected media requires reapproval.

### Phase 8: Evidence integrity and audit completeness

- **Objective:** Make each decision and exact media version reconstructable and tamper-evident.
- **Dependencies:** Phases 2-7 define events and versions.
- **User-visible changes:** Clear status history, decision confirmations, and trustworthy final disposition; little added friction.
- **Backend changes anticipated:** Content hashes, version lineage, consistent immutable events, notification evidence, location-attempt history, orphan cleanup.
- **Migration risk:** Medium. Historical files cannot be given retroactive capture provenance; they must be labeled as legacy evidence.
- **Rollback consideration:** New evidence writes should fail safely without changing authorization; do not allow recording/publication when required evidence cannot be created.
- **Acceptance criteria:** Every consequential event in Section 15 is reconstructable; exact-media approval resolves to the same content hash; no silent state replacement occurs.

### Phase 9: Policy and legal-document alignment

- **Objective:** Align notices and agreements with approved product behavior after the workflow exists and is validated.
- **Dependencies:** Product-owner approval of this specification; legal review; final retention, minor, download, and verification decisions.
- **User-visible changes:** Updated notices and role-appropriate acknowledgments.
- **Backend changes anticipated:** Versioned presented-content evidence and prospective assent.
- **Migration risk:** Medium. Existing users require a clear prospective transition without false retroactive acceptance.
- **Rollback consideration:** Earlier document versions remain immutable evidence; rollback never changes what a participant previously saw.
- **Acceptance criteria:** Displayed terms accurately match operational behavior and each required decision preserves the presented version.

### Phase 10: End-to-end validation

- **Objective:** Prove the workflow works without regression across roles, locations, devices, channels, and failure paths.
- **Dependencies:** Phases 1-9 complete in a controlled environment.
- **User-visible changes:** None beyond finalized behavior.
- **Backend changes anticipated:** Test fixtures, observability, delivery verification, purge verification, and operational dashboards may be needed.
- **Migration risk:** Low for validation itself; high-severity defects may require delaying release.
- **Rollback consideration:** Release by gated phase; rollback never widens access, restores withdrawn media, or accepts unverified consent.
- **Acceptance criteria:** The test matrix covers all three locations, every risk tier, accept/decline/expiry/wrong-recipient, reassignment, location failure, upload failure, exact-media approval, private outcome, publication, withdrawal, dispute, minor/bystander, and physical deletion failure.

### Phase ordering rule

Phases may be broken into smaller releases, but the following dependencies must remain:

- identity before broader recording unlock;
- subject assessment before universal location gates;
- media version identity before exact-media publication;
- exact-media publication before reliable withdrawal;
- withdrawal before policy promises of self-service control; and
- complete workflow behavior before policy rewriting.

**Baseline references:** Current Audit Sections 22-25 and Manual Review Checklist; Consent Architecture Sections 13-19.

---

## 19. Open Product-Owner Decisions

These decisions require Cesar's approval. The architecture already settles the separation of recording/publication, private default, affirmative consent, audio-off default, role authority, and immutable history, so those are not reopened here.

| Question | Why it matters | Recommended default | Alternatives | Consequence |
|---|---|---|---|---|
| **How long is a recording-consent request valid?** | A fixed limit prevents old scope/contact decisions from unlocking later work | 48 hours or scheduled service start, whichever comes first | 24 hours; 72 hours; through service date | Shorter is safer but increases resends; longer is easier but increases stale-authority risk |
| **May a customer with no email or mobile complete verified in-person consent?** | Without an alternate path, recording cannot occur for customers lacking digital contact | Allow a controlled in-person process only after its identity, copy-delivery, and anti-impersonation safeguards are separately approved | No alternate; service proceeds without recording | Alternate improves access but carries staff-impersonation risk; no alternate is safer but excludes some customers from recording |
| **Can a vendor decline service after recording consent is refused?** | Recording may be genuinely essential for some warranties/safety services but could become coercive | Only when essential private proof was clearly disclosed before service acceptance; never for refusal of public publication | Always continue service; vendor decides freely | Recommended balances vendor protection and non-coercion; broader discretion risks pressure |
| **Should all prerecorded fallback media remain private?** | Fallback provenance is weaker than verified live capture | Yes, private/customer-visible only | Allow public after enhanced review for low-risk property-only media; prohibit fallback entirely | Private-only protects evidence credibility; limited public increases flexibility; prohibition may lose valid proof |
| **What are the default retention periods?** | Withdrawal, deletion, cost, disputes, and legal hold need predictable timelines | Product default: private media 3 years after completion; consent/audit decision history 7 years; earlier deletion where no hold applies | Shorter media period; longer warranty-aligned period; vendor-category configurable period | Shorter improves minimization; longer protects disputes; category variation increases complexity and national inconsistency |
| **Are private-proof downloads enabled by default?** | Downloads help records but reduce Reliance's control over onward copies | Customer download on; vendor-manager download on for defined business records; employee download off | Customer-only; no downloads; case-by-case | Broader download supports records but increases external-copy risk |
| **Will Reliance support a limited authenticated publication audience?** | Architecture permits an outcome between private and fully public | Yes, named/authenticated access as a distinct maximum audience | Private and public only | Limited access increases choice but adds audience and revocation complexity |
| **Is Final Result the default publication proposal?** | Fewer proposed clips reduce privacy exposure and decision burden | Yes; Starting and Work in Progress are opt-in proposals | Propose all three; vendor selects without default | Final-only is simpler and safer; all-three provides fuller proof but increases exposure |
| **Can a manager request a location-verification exception?** | GPS can fail indoors or in poor coverage, but silent override weakens proof | Allow only documented alternate verification reviewed by support/admin; never manager-only override | No exceptions; manager override | Recommended balances accessibility and integrity; no exceptions loses valid work; manager override weakens neutrality |
| **May identifiable minors ever appear in public proof?** | The architecture recommends prohibition but product owner must settle exceptions | No; only reliably de-identified versions may become public | Exceptional guardian-approved cases with enhanced admin review | Prohibition is simplest and safest; exceptions introduce high authority, withdrawal, and reputational risk |
| **What is the public-unpublishing response target?** | "Prompt" needs an operational commitment | Reliance-controlled access disabled immediately after verified withdrawal; external cache/takedown follow-up tracked separately | One-hour target; 24-hour target | Immediate best protects privacy; delayed targets are easier operationally but extend unwanted exposure |
| **How should existing public media transition to exact-media approval?** | Existing public media may rely only on advance public/private choice | Make legacy media private until exact-media approval is obtained | Grandfather existing public media; request approval while leaving public temporarily | Private-first is safest; grandfathering preserves continuity but continues the identified gap |

Until Cesar decides:

- the recommended default governs design discussion only;
- no implementation should assume approval;
- uncertainty defaults to private/locked/restricted; and
- no unresolved decision may be silently decided by engineering.

---

## 20. Final Workflow Verdict

The future Reliance workflow uses one consent architecture across all three service-location selections while applying different gates to the actual subject and privacy risk.

### Vendor business address

Vendor authorization may support private recording only when the media is confined to vendor-owned property or a vendor-controlled work area and contains no customer-controlled property, identifiable customer, protected person, audio, or sensitive information. Customer-specific notice still occurs. Customer consent is required for customer-owned property, person-centered services, customer identity/activity, audio, or other customer-controlled interests.

### Customer residence

Affirmative customer or authorized-representative recording consent is always required. Identity, premises authority, location, scope, household members, minors, private areas, documents, screens, security equipment, identifiers, and audio are evaluated before unlock and throughout capture.

### Customer business address

Affirmative consent from a verified authorized business representative is always required for the premises and business-owned subject. The representative cannot automatically authorize every employee, visitor, customer, contractor, or bystander. People, audio, confidential operations, records, screens, and identifiers require separate protection.

### Person-centered and property-centered services

Person-centered recording uses stronger identity, personal-authority, likeness, protected-person, and publication controls. Low-risk property-only recording uses a simpler affirmative path but still distinguishes vendor-owned from customer-owned property and excludes identifiers and people.

### Audio

Audio remains off by default. It is allowed only when necessary for the proof purpose and separately authorized for every intentionally identifiable speaker.

### Recording unlock

Recording unlocks only when:

- the work record and service location are valid;
- the subject assessment is complete;
- the correct authority holder is identified;
- every required recording decision is active;
- the current employee is assigned and certified;
- location verification passes where required;
- audio and protected-person rules are satisfied; and
- no withdrawal, dispute, or scope mismatch blocks capture.

### Publication

Publication may occur only after:

- all three stages are completed and manager reviewed;
- the customer receives private proof;
- the exact proposed media version is reviewed;
- the customer or authority holder approves the selected clips and audience;
- the vendor approves official business representation;
- employee authority exists for identifiable employee likeness, guardian authority exists for a minor, audio authority exists for identifiable speakers, and protected-person authority or reliable de-identification exists for affected non-participants; and
- admin moderation approves the same exact version without widening permission.

### Private proof

Private proof is complete service evidence. It may be viewed by authorized participants, may support legitimate service records, and must not reduce standing merely because it is not public. No publication or review is required for completion.

### Withdrawal

Withdrawal stops future recording or ends broader visibility according to its scope. Reliance-controlled public access is disabled promptly. Withdrawal does not rewrite earlier decisions, and retention does not permit continued public exposure.

### Evidence

Reliance preserves the minimum immutable history needed to prove identity, authority, scope, decisions, recording events, exact media versions, audience, moderation, withdrawal, disputes, and deletion outcomes. Sensitive media may become private, deleted, or evidence-only while the historical truth of the decision remains.

The governing operational rule is:

> Assess what will be recorded, verify who has authority, unlock only for the approved private scope, publish only the exact approved media, and respond to uncertainty by narrowing access rather than expanding it.

This specification is ready for product-owner review. No implementation begins until the open decisions in Section 19 and the specification as a whole are approved.
