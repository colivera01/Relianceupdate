# RELIANCE PLATFORM LANGUAGE GUIDE

**Document type:** Official platform communication standard

**Status:** APPROVED DESIGN BASELINE

**Applies to:** User interfaces, buttons, dialogs, email, SMS, in-app notifications, onboarding, Help Center content, tutorials, support responses, AI responses, and future product documentation

**Does not change:** Application behavior, legal terms, privacy rules, consent rules, data handling, or technical implementation

## Purpose

This guide defines how Reliance speaks.

Reliance is a proof-of-service platform. It helps businesses document work and helps customers understand what was done without pressuring anyone to record, share, publish, or review.

Every message should help the reader understand:

1. What is happening.
2. Why it matters.
3. What choice or action is available.
4. What happens next.
5. What remains private or protected.

This guide is not a legal policy and does not replace the Privacy Policy, Terms of Service, SMS Policy, consent architecture, or recording workflow specification. It translates approved platform behavior into clear, consistent, human language.

## Governing Baseline

This guide follows these approved sources:

1. `RELIANCE_CURRENT_CONSENT_PRIVACY_AND_RECORDING_AUDIT.md` for the current implementation baseline.
2. `RELIANCE_CONSENT_ARCHITECTURE_V1.md` for the governing consent philosophy.
3. `RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md` for the approved future workflow.
4. `RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md` for approved product-owner decisions.

When language conflicts with approved platform behavior, the behavior wins and the language must be corrected. Language must never imply that a feature, protection, deadline, or right exists when it has not been approved and implemented.

## Foundational Language Rules

### 1. Proof is the promise; Service Video is the product object

Use **proof** to describe Reliance's purpose, value, or a direct action that opens the completed record.

Use **Service Video** or **Service Videos** for the actual recorded clips.

Approved examples:

- Reliance is a proof-of-service platform.
- View Proof
- Service Videos
- Your service videos are ready.
- Keep your service videos private.
- Choose which service videos to make public.

Do not say:

- Your proof is ready.
- Upload proof media.
- Approve the evidence object.
- Publish your proof package.

### 2. Permission is specific

Permission to perform a service, permission to record, and permission to make a service video public are separate choices.

Customer-facing language must say exactly which permission is being requested:

- Permission to record
- Permission to include audio
- Permission to make selected service videos public

Never use one broad approval to describe several decisions.

### 3. Private is a complete outcome

Private service videos are not incomplete, lesser, or waiting to become public. The customer must never feel that choosing private will harm the service, the vendor, a review, or a Trust Score.

Approved language:

- Your service videos will remain private.
- Keeping your service videos private does not affect your service.
- Nothing will be made public unless you choose it.

Avoid:

- Upgrade to public.
- Help the business by sharing.
- Complete the process by publishing.
- Your proof is still private.

### 4. Recording and making public are separate

Before recording, explain what may be recorded and who can initially view it. After completion, show the exact service videos before asking whether any may be made public.

Never describe permission to record as permission to publish.

### 5. Audio is off by default

When audio is not requested, say **Audio is off**.

When audio is requested, describe it as a separate choice. Do not bury audio inside general recording language.

### 6. Silence is not a decision

No response is not approval, rejection, a review, a rating, or consent. Do not use countdowns or pressure language to force a decision unless an approved request link genuinely expires for security.

If a secure permission link expires, explain that the link expired, not that the customer's rights or service expired.

### 7. State only verified behavior

Do not promise that something was sent, saved, deleted, made public, or protected unless the system has confirmed that result.

When the result is uncertain, say what is known and what the user can do next.

## Reliance Voice

Reliance sounds calm, capable, direct, and respectful. It does not sound like a contract, an engineering console, a sales pitch, or a warning system.

| Quality | What it means | Example |
|---|---|---|
| Clear | Use familiar words and one idea at a time. | "We could not confirm the service location." |
| Human | Write as one person helping another. | "Check your location settings, then try again." |
| Neutral | Explain choices without steering the decision. | "You can keep all service videos private or make selected videos public." |
| Specific | Name the item, action, and result. | "Final Result was saved." |
| Reassuring | Explain what remains safe when something fails. | "Your saved videos were not changed." |
| Professional | Be courteous without becoming formal or distant. | "Please review the updated service video." |
| Honest | Distinguish confirmed facts from guidance. | "The email could not be delivered. The request is still available to resend." |
| Protective | Use the narrowest accurate description of access. | "Only authorized participants in this service can view these videos." |

### Sentence style

- Use active voice.
- Address the reader as **you**.
- Use **we** only when Reliance is the actor.
- Prefer short sentences.
- Put the main point first.
- Use contractions when they sound natural.
- Use sentence case for headings, labels, and buttons unless a proper name requires capitals.
- Use numerals for steps, times, and quantities.
- Explain one unfamiliar idea before asking for a decision.
- Do not use exclamation points for consent, privacy, errors, disputes, deletion, or moderation.

### Message order

For decisions and notifications, use this order:

1. **What happened or what is being requested.**
2. **Why the person received the message.**
3. **What they can do.**
4. **What happens next.**
5. **What remains private or unaffected, when important.**

## Participant Language

### Customer

The customer should feel informed, respected, and in control.

Use language that makes choices equally valid. Never suggest that recording or making videos public is required unless the approved service terms genuinely make private recording necessary and that condition was disclosed before service acceptance.

Say:

- You decide whether recording is allowed.
- You can keep all service videos private.
- Review the exact videos before deciding what to make public.
- You can decline without making anything public.

Do not say:

- Help your provider by approving.
- Finish your service by sharing.
- Your approval is required to complete the job.
- If you do nothing, we will treat this as approved.

### Vendor and vendor manager

The vendor should feel protected, organized, credible, and accountable.

Language should help the vendor document work, understand the current stage, and take the next permitted action without implying ownership of a customer's choices.

Say:

- Create work record
- Assign team member
- Waiting for recording permission
- Review service videos
- Request customer approval to make selected videos public

Do not say:

- Capture customer content
- Override consent
- Force publish
- Claim customer media
- Generate customer rating

### Employee

The employee should always know:

1. Which service is assigned.
2. What may be recorded.
3. What must not be recorded.
4. Whether audio is allowed.
5. Why recording is blocked.
6. When to stop and ask for help.

Use direct instructions:

- Record only the approved work area.
- Audio is off.
- Stop recording if another person enters the frame.
- Avoid documents, screens, addresses, access codes, and unrelated areas.
- Ask your manager for help before continuing.

Do not place privacy boundaries inside long paragraphs.

### Admin

Admin language may be operational, but it must still describe people and decisions clearly. Admin approval can limit or block use; it cannot replace missing participant permission.

Say:

- Review service videos
- Permission record
- Customer approval missing
- Keep private
- Request correction
- Remove from public view

Avoid raw identifiers, model names, enum values, and database language unless the admin is in a clearly labeled technical diagnostic tool.

### Reliance

Reliance speaks as a neutral record keeper and platform operator. It does not take credit for the service, pressure a decision, or speak for another participant.

Reliance should say:

- "Electro LLC requested permission to record this service."
- "Reliance recorded your choice and notified the business."

Reliance should not say:

- "We need you to approve the business."
- "We decided this work is complete" when the vendor manager made that decision.

## Approved Terminology

### Core product terms

| Internal or inconsistent term | Approved user-facing term | Usage rule |
|---|---|---|
| Proof-of-service | Proof of service | Use for the platform promise and concept. |
| Proof package | Service videos | Use for the actual set of Starting Condition, Work in Progress, and Final Result clips. |
| MediaAsset | Service video | Never expose the model name. |
| Media assets | Service videos | Use a specific stage name when possible. |
| Capture | Record | Use "record" for the action. |
| Evidence | Service history | Use when referring to the customer's or vendor's saved record. Use "record" for decision history. |
| Consent | Permission | Use in ordinary UI. "Consent" may appear in approved legal or policy text. |
| Recording consent | Permission to record | State the exact decision. |
| Audio consent | Permission to include audio | Keep separate from video recording permission. |
| Publication | Make public | Use as a verb phrase in ordinary UI. |
| Publication approval | Approval to make public | Identify which service videos are included. |
| Audience | Who can view | Use "Private" or "Public" when naming the approved Version 1 choices. |
| Public proof | Public service video | Use "public proof" only in brand or policy explanation, not as the object label. |
| Private proof | Private service video or private service history | Name the actual object or record. |
| Exact-media approval | Approve these exact service videos | Explain that changes require another review. |
| Work record | Work record | Preferred in vendor and admin workspaces. |
| Booking | Service or work record | Choose by audience. Do not expose the internal object name. |
| Job | Work record or service | Use "job" only where it is already the ordinary industry-neutral label and cannot be confused. |
| ReviewWindow | Optional review | Never expose timing-model language. |
| Moderation | Review | Customer/vendor: "Reliance review." Admin: "moderation" is acceptable in operational headings. |
| Visibility | Who can view | Use "Private" and "Public" for choices and statuses. |
| Retention | How long we keep it | Use plain language; preserve the precise approved period when shown. |
| Withdrawal | Stop recording or remove from public view | Name the actual effect. Use "withdraw" only in detailed help or policy content. |
| Revocation | Permission withdrawn | Prefer the action and result. |
| OTP | Verification code | Never expose the acronym. |
| Token | Secure link | Never expose token or bearer-link language. |
| Geofence | Service location check | Explain the practical result, not the technology. |
| Trust signal | Trust Score information | Use only for the real input being described. |

### Role names by audience

| System role | Customer-facing | Vendor-facing | Employee-facing | Admin-facing |
|---|---|---|---|---|
| Customer | You; customer; authorized representative | Customer; authorized representative | Customer; authorized representative | Customer; authority holder; guardian when verified |
| Vendor | Business name; service provider | Your business | Your business; manager | Vendor; vendor manager |
| Vendor manager | Business manager | Manager | Your manager | Vendor manager |
| Employee | Team member; service professional | Team member | You | Employee; assigned team member |
| Admin | Reliance support; Reliance reviewer | Reliance reviewer; Reliance support | Reliance support | Admin; moderator when the function is moderation |
| Reliance | Reliance | Reliance | Reliance | Reliance |
| Protected non-participant | Another person; person not included in the permission | Bystander; household member; visitor; customer-business employee | Bystander; minor; person outside the approved scope | Protected non-participant, with the person's known role |

Use **authority holder** only when the distinction matters. In ordinary messages, name the role: **customer**, **authorized representative**, or **guardian**.

## Surface Terminology Standards

| Surface | Preferred language | Avoid |
|---|---|---|
| Customer pages | Service, service videos, permission, private, public, who can view, service history | Work-order IDs, media assets, publication authority, evidence records |
| Vendor pages | Work record, assigned team member, recording permission, service videos, manager review, customer approval, make public | Capture object, consent artifact, publication pipeline |
| Employee pages | Assigned service, approved recording area, record stage, audio is off, stop recording, contact manager | Authorization matrix, media session, geofence failure |
| Admin pages | Service video, participant permission, exact version, public eligibility, decision history, keep private | Raw schema names and enum values in ordinary operations |
| Help Center | Task-based questions and clear steps | Architecture language, policy paraphrases presented as law |
| Emails | Why the message was sent, one primary action, what happens next | Generic urgency, threats, unexplained links |
| SMS | Reliance identity, business or service context, one action, secure link | Sensitive details, long explanations, multiple competing actions |
| Buttons | Verb plus object: "Allow recording", "View service videos" | Submit, Continue, Yes, No, Process, Execute |
| Navigation | Customer tasks and familiar objects | Internal departments or database objects |
| Notifications | Confirmed status plus next step | Raw error codes, vague "Something changed" messages |
| Error messages | What failed, known reason, next action, preserved state | Exception text, stack traces, "Invalid request" without help |
| Empty states | What is absent and the valid next action | Blame, dead ends, fake sample activity presented as real |
| Tutorials | One goal per tutorial, actions in order | Marketing copy inside instructions |
| AI responses | Current facts, source of those facts, safe next action, limits | Invented decisions, legal conclusions, pretending to approve or consent |

## Buttons and Links

Buttons name the action and its object.

### Approved patterns

- Allow recording
- Decline recording
- View request
- View service videos
- View Proof
- Keep all private
- Make selected videos public
- Request a change
- Assign team member
- Review service videos
- Send to manager
- Resend secure link
- Save recording
- Try again
- Contact support
- Remove from public view

### Button rules

1. Use a specific verb.
2. Avoid **Submit** or **Continue** when the real action can be named.
3. Do not use **Yes** and **No** for consequential choices.
4. Make destructive actions explicit: **Delete work record**, not **Delete**.
5. Do not use urgency words unless delay creates a real, approved operational risk.
6. Do not put reassurance inside the button. Put it in nearby supporting text.
7. A link should describe its destination: **View permission details**, not **Learn more**.

## Status Language

Statuses describe the current state, not an accusation or prediction.

| Situation | Approved status | Supporting text |
|---|---|---|
| Customer decision needed | Waiting for recording permission | The customer or authorized representative has not responded yet. |
| Recording permitted | Recording ready | The assigned team member can record within the approved scope. |
| Recording declined | Recording declined | No Reliance service videos may be recorded for this work record. |
| Link expired | Secure link expired | Send a new link if permission is still needed. |
| Employee working | Recording in progress | Service videos are being added to this work record. |
| Employee submitted | Waiting for manager review | The manager needs to review the submitted service videos. |
| Manager requested change | Correction requested | The assigned team member can replace the requested service video. |
| Manager approved private record | Service videos ready | The customer can view the completed private service videos. |
| Customer public choice needed | Public sharing decision available | The customer can keep everything private or make selected videos public. |
| Reliance review needed | Waiting for Reliance review | Selected service videos are being checked before they can appear publicly. |
| Public | Public | The approved service video can be viewed by anyone. |
| Private | Private | Only authorized participants in this service can view it. |
| Public approval withdrawn | Removed from public view | Reliance no longer serves this video publicly. |
| Dispute | Access restricted | Access is limited while Reliance reviews the concern. |
| Optional review available | Review available | The customer may leave an optional review. |
| No review submitted | No review submitted | Nothing else happens. The service remains complete. |

## Notifications

Every notification answers three questions:

1. Why am I receiving this?
2. What can I do now?
3. What happens next?

### Notification template

**Heading:** Confirmed event or requested action

**Context:** Who initiated it and which service it concerns

**Action:** One primary next step

**Result:** What will happen after the action

**Protection:** What remains private or unaffected, when relevant

### Channel rules

#### In-app

- Use the full status and next step.
- Keep persistent decisions visible until resolved.
- Use success messages only after confirmation.
- Preserve the user's place when a retry is possible.

#### Email

- Identify Reliance and the business near the beginning.
- State why the recipient received the email.
- Use one primary button.
- Include a readable backup link when a secure action link is required.
- Explain link expiration only when it applies to the link.
- Do not include private service details beyond what the recipient needs to identify the request.

#### SMS

- Start with **Reliance:**.
- Name the business or service when safe.
- Use one clear action.
- Keep sensitive information out of the message.
- Do not imply that recording or public sharing is required.
- Follow the active SMS Policy for required sender and opt-out information.

#### Delivery failure

Do not say **sent** when delivery failed.

Say:

- We could not deliver the email.
- The text message was not delivered.
- Check the contact information, then resend the secure link.
- The request is still waiting for a decision.

## Errors, Warnings, Success Messages, and Empty States

### Error formula

1. Name what could not be completed.
2. Give the known reason without guessing.
3. Say what the person can do.
4. Say what was not changed, when helpful.

Example:

> We could not save the Starting Condition video. Check your connection and try again. Your work record was not changed.

### Warning formula

Warnings explain a consequence before the action. They do not shame or frighten.

Example:

> Replacing this video will remove the current version from the package. If a dispute is open, Reliance may keep the earlier version in restricted service history.

### Success formula

Confirm the exact result and next step.

Example:

> Final Result saved. Record the remaining stage or send the completed service videos to your manager.

### Empty-state formula

Explain what is absent, why that may be normal, and the available next action.

Example:

> No service videos yet. The assigned team member can begin after recording permission and the service location are confirmed.

## Words We Never Use

The following engineering and internal terms must not appear in ordinary customer, vendor, or employee experiences. They may appear in source code, logs, technical diagnostics, or engineering documents.

| Never expose | Use instead |
|---|---|
| MediaAsset | Service video |
| MediaSession | Recording session, only when the distinction is needed |
| blob, blob URL, storage key | Saved video or video file |
| database record, row, schema | Saved information or service history |
| API, endpoint, request payload | Reliance, this action, or the named feature |
| token, bearer token, token hash | Secure link |
| ConsentRecord | Permission record |
| consent artifact | Recorded choice |
| publication authority | Approval to make public |
| audience enum | Who can view |
| evidence object | Service history or decision record |
| capture pipeline | Recording process |
| workflow state machine | Current step |
| ReviewWindow | Optional review |
| expiresAt | Expiration date or "This secure link expires..." |
| geofence | Service location check |
| location radius | Required distance from the service location |
| GPS attestation | Location confirmation |
| immutable audit log | Permanent decision history |
| content hash, checksum | Verified file identity, only when a user needs the concept |
| moderation enum | Reliance review status |
| soft delete | Removed from view |
| physical purge | Permanently deleted |
| legal hold | Kept securely because a dispute or legal requirement is active |
| unauthorized, forbidden | You do not have access, unless security guidance requires firmer wording |
| invalid input | Name the field and what needs to be corrected |
| failed to fetch | We could not connect to Reliance |
| exception, stack trace | A specific human-readable error |
| null, undefined, boolean | Plain description of the missing or selected value |
| vendorId, bookingId, assetId | Business, work record, service video, or Reference ID when support needs it |

The word **consent** is reserved for approved legal, policy, audit, and detailed Help Center contexts. Ordinary product communication uses **permission** and names the exact action.

## Sensitive and High-Risk Language

### People, minors, and bystanders

Use direct protective language:

- Stop recording if a person outside the approved scope enters the frame.
- Do not record a minor unless the work record confirms verified guardian permission for necessary private recording.
- Identifiable minors cannot appear in public Reliance service videos.
- Retake, crop, blur, or keep the video private if an unrelated person appears.

Do not imply that a property owner or business representative can approve every person's face, voice, or likeness.

### Homes and private spaces

Say what must be avoided:

- Record only the approved work area.
- Avoid private rooms, personal documents, family photos, screens, security equipment, addresses, keys, and access codes unless they are necessary and specifically approved.

### Customer businesses

Use language that separates business authority from individual authority:

- The business representative may approve recording of the location and business property they control.
- This does not include permission to record every employee, customer, visitor, or contractor.

### Disputes and withdrawal

Describe the immediate effect first:

- The service video was removed from public view.
- Access is restricted while Reliance reviews the concern.
- The earlier decision remains in the permanent decision history.

Do not promise immediate physical deletion when approved retention or a restricted hold may apply.

## Help Center, Tutorials, Support, and AI

### Help Center

- Use question headings that match the reader's task.
- Start with the answer.
- Give steps in the order they happen.
- Separate current behavior from planned behavior.
- Link to policies instead of paraphrasing them as legal advice.
- Use screenshots only when they show the current product.

Approved heading examples:

- How do I give permission to record?
- Who can view my service videos?
- How do I keep my service videos private?
- How do I remove a service video from public view?
- Why is recording blocked?

### Tutorials and onboarding

- Teach one workflow at a time.
- Explain why a step matters before the user reaches it.
- Show the real result, not a promotional promise.
- Never preselect a privacy decision in teaching examples.

### Support responses

Support should repeat the confirmed current state, identify the next available action, and avoid guessing about identity, delivery, location, or permission.

Approved structure:

> I confirmed that the recording request is still waiting for a decision. The email was not delivered, but the text message was delivered. Check the email address before resending. Recording remains locked until the required permission is confirmed.

### AI responses

Reliance AI may explain status and available actions. It may not:

- grant or withdraw permission;
- approve a service video;
- make a video public;
- decide a dispute;
- claim legal compliance;
- invent a delivery result, participant decision, review, rating, or Trust Score input;
- speak as the customer, vendor, employee, guardian, or admin; or
- suggest a broader audience than the approved state.

AI should distinguish facts from guidance:

> **Current status:** Recording is waiting for customer permission.
>
> **Next step:** Confirm the customer's contact information or resend the secure link.
>
> **What remains protected:** Recording stays locked until permission is confirmed.

## Example Screen Copy

These examples establish tone and terminology. They do not create new product behavior or legal text.

### 1. Customer consent request (customer-facing: permission request)

**Heading:** Your permission is needed

**Body:**

> {Business name} would like to record short service videos for {service name}. The videos will begin as private and will be available to you and authorized participants in this service.
>
> Audio is off. You will have a separate choice after the service if the business asks to make any completed video public.
>
> You may allow or decline recording. Declining public sharing will never affect your service.

**Primary action:** Allow recording

**Secondary action:** Decline recording

**Supporting action:** This request is not for me

**Security note:** This secure link expires {date and time}. If it expires before you decide, the business can send a new link.

### 2. Customer service-video page

**Heading:** Your service videos

**Body:**

> {Business name} completed the service videos for {service name}. Review the Starting Condition, Work in Progress, and Final Result below.

**Status:** Private

**Privacy note:**

> Only you, authorized participants from {Business name}, and Reliance staff with a support, safety, review, or dispute need can view these videos.

**Actions:** View Starting Condition; View Work in Progress; View Final Result; Download private service videos; Report a concern

### 3. Private service-video page

**Heading:** These service videos are private

**Body:**

> Your service is complete. Keeping these videos private does not affect your service, review options, or account.

**Status detail:**

> These videos are not publicly searchable or visible on the business profile.

**Actions:** View service videos; Leave an optional review; Report a concern

### 4. Public service-video approval

**Heading:** Choose what to make public

**Body:**

> Review each proposed service video before deciding. You can keep everything private, make selected videos public, or request a change.
>
> Public videos can be viewed by anyone. Nothing will be made public unless you choose it and all required approvals and Reliance review are complete.

**Default proposal label:** Final Result

**Per-video choices:** Keep private; Select to make public; Request a change

**Primary action:** Make selected videos public

**Secondary action:** Keep all private

**Supporting action:** Request a change

**Version note:** If a selected video, caption, audio setting, or privacy edit changes, you will be asked to review the updated version.

### 5. Recording blocked

**Heading:** Recording is not available yet

**Body, permission reason:**

> The required recording permission has not been confirmed. Ask your manager to check the request status. Do not record outside Reliance for this work record.

**Body, location reason:**

> We could not confirm that you are at the saved service location. Check your phone's location settings and try again. If the location is wrong, contact your manager before continuing.

**Protection note:** The service may continue without Reliance recording when allowed by the service plan.

**Actions:** Try again; Contact manager

### 6. Recording declined

**Heading:** Recording was declined

**Body:**

> The customer or authorized representative did not give permission for Reliance service videos. Recording will remain unavailable for this work record.
>
> The service may continue without Reliance recording when allowed by the service plan. Contact the customer only if the service plan needs to change.

**Vendor action:** View decision details

**Employee action:** Return to assigned services

### 7. Wrong recipient

**Heading:** This request has been reported as the wrong recipient

**Recipient confirmation:**

> Thank you for letting us know. You will not be asked to decide for this service. Reliance notified the business to correct the contact information.

**Vendor notification:**

> The recipient said this recording request was not intended for them. Recording remains locked. Correct the customer or representative information before sending a new secure link.

**Vendor action:** Correct contact information

### 8. Service complete

**Heading:** Your service videos are ready

**Body:**

> {Business name} completed {service name}. Your private Starting Condition, Work in Progress, and Final Result videos are available to review.

**Primary action:** View Proof

**Supporting text:**

> You can keep all service videos private. If public sharing is available, you will review the exact videos before deciding.

### 9. Review invitation

**Heading:** Share an optional review

**Body:**

> Your service is complete. You may leave an optional review about your experience with {Business name}.
>
> There is no deadline. If you do not leave a review, nothing else happens and your service remains complete.

**Primary action:** Leave a review

**Secondary action:** Not now

### 10. Review submitted

**Heading:** Review submitted

**Body:**

> Thank you. Your review was saved and will follow Reliance's current review and visibility process.

**Actions:** View review; Return to service history

Do not promise that a review is public until public visibility is confirmed.

### 11. Vendor dashboard

**Page heading:** Work records

**Intro:**

> Create work records, assign team members, and follow each service from recording permission through final service-video status.

**Recommended workflow groups:** Active work; Manager review; Waiting for customer; Reliance review; Public; Private; Needs attention

**Card language:**

- Current step: Waiting for recording permission
- Assigned to: {Team member}
- Next action: Confirm customer contact information
- Service videos: 2 of 3 saved
- Who can view: Private

**Primary actions:** Open work record; Assign team member; Review service videos; Resend secure link

### 12. Employee dashboard

**Page heading:** Assigned services

**Intro:**

> Open an assigned service to see what may be recorded, confirm the location, and record each approved stage.

**Pre-recording summary:**

> **Approved scope:** {Approved work area or subject}
>
> **Do not record:** {People, areas, or information outside the approved scope}
>
> **Audio:** Off
>
> **Stop and contact your manager if:** The location, people present, or recording scope changes.

**Stage actions:** Record Starting Condition; Record Work in Progress; Record Final Result; Send to manager

### 13. Admin moderation

**Page heading:** Review service videos

**Package summary:**

> Confirm that the exact proposed videos match the recorded participant permissions, approved public selection, privacy restrictions, and service context.

**Decision guidance:**

> Reliance review may keep a video private, request a correction, or prevent public display. It cannot replace missing customer, vendor, employee, or guardian permission.

**Statuses:** Ready for review; Permission missing; Correction requested; Approved for public view; Keep private; Access restricted

**Actions:** Approve for public view; Keep private; Request correction; Restrict access; View decision history

## Content Review Checklist

Before publishing any Reliance message, confirm:

1. Does it name the real object as a service video?
2. Does it use proof only as the platform promise or an approved **View Proof** action?
3. Does it separate service, recording, audio, public sharing, and review decisions?
4. Does it make private a complete and respected outcome?
5. Does it identify who acted and what happens next?
6. Does it avoid pressure, urgency, shame, and implied penalties?
7. Does it avoid engineering terms and raw status values?
8. Does it avoid claiming that one person controls another person's likeness or privacy?
9. Does it state only a confirmed current result?
10. Does it explain failures without exposing technical details?
11. Does it tell employees what to record, avoid, and do when conditions change?
12. Does it avoid promising deletion, delivery, publication, or protection beyond approved behavior?
13. Does it preserve the distinction between optional reviews and service-video choices?
14. Would an ordinary customer understand it on the first reading?
15. Would the message still be respectful if the person declines?

## Governance

This guide is the official communication standard for future Reliance product and support work.

- New product language should use this guide before introducing a new term.
- A new internal model name does not create a new user-facing term.
- Legal text may use legally necessary terminology, but nearby product explanations should remain plain and must not paraphrase away the legal meaning.
- Technical support tools may show diagnostic details only when the intended reader needs them.
- When a workflow changes, update the language after the business rule is approved and the implementation state is known.
- Historical screenshots, prototypes, archived documents, and old conversations do not override this guide or the approved implementation baseline.
- If no approved term fits, choose the most specific familiar phrase and record the terminology decision before broad use.

## The Reliance Communication Promise

Every person who interacts with Reliance should understand what is happening without needing technical knowledge, legal training, or help from someone inside the company.

A customer should feel that the service belongs to their real-life experience and that their choices remain their own. They should know when a business wants to record, what may appear, whether audio is on, who can view the videos, and what will happen after they decide. Keeping service videos private must feel normal and complete. Making selected videos public must be a separate, informed choice made only after the customer can see the exact videos. Declining, waiting, or changing a public-sharing decision must never be described as a failure to support the business.

A vendor should feel that Reliance helps the business operate professionally. The platform should make it easy to create an accurate work record, assign the right team member, document the service, follow customer decisions, review completed videos, and understand the next step. Clear records protect credible businesses. That protection comes from accurate decisions and reliable history, not from pressure or broader access than a participant approved.

An employee should never have to guess what may be recorded. Reliance should identify the assigned service, approved area or subject, audio setting, location requirement, prohibited content, and stop conditions before the camera opens. When conditions change, the safest action should be obvious and asking for help should be treated as correct professional behavior.

An admin should see enough context to apply Reliance standards consistently without being invited to replace a participant's authority. Administrative language should support neutral review, narrower access, correction, and reliable decision history.

When something goes wrong, Reliance should be candid and useful. The message should name the failed action, explain the known reason, provide the next available step, and say what remains unchanged. Reliance should never hide uncertainty behind a success message or expose internal system language to the person who needs help.

Across every screen, email, text message, tutorial, support response, and AI explanation, Reliance makes the same promise:

> We will tell you what is happening, explain the choice in plain language, respect the decision you are authorized to make, and keep access no broader than the approved purpose.

That promise is how Reliance communicates proof of service without turning privacy, recording, public visibility, or reviews into pressure.
