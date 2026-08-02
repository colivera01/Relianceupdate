# RELIANCE CONSENT UX SPECIFICATION V1

**Document type:** User experience specification

**Status:** Version 1 design baseline

**Scope:** Customer, vendor, employee, and admin experiences for recording permission, service videos, private and public outcomes, reviews, withdrawal, disputes, and moderation

**Implementation status:** Design only. This document does not change application behavior.

## 1. Purpose

This specification translates the frozen Reliance consent architecture, workflow, implementation decisions, and language standard into a complete user experience.

It does not redesign the approved workflow, business rules, legal rules, or implementation. It defines how the approved experience should be organized, explained, and presented so a first-time user can understand every screen without training.

Every Reliance screen must answer:

1. Why am I here?
2. What is happening?
3. What do I need to do?
4. What happens if I do nothing?
5. What happens after I decide?
6. What stays private?

## 2. Frozen Design Baselines

This specification is governed by, and does not modify:

- `RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`
- `RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`

When this UX specification appears to conflict with a frozen baseline, the frozen baseline controls. Future implementation must resolve the UX detail without changing the approved business result.

## 3. Experience Goals

### Customer goal

The customer should always feel:

- I understand why I am being asked.
- I know what may be recorded.
- I know who can view the service videos.
- I can say no without being pressured.
- I can keep everything private.
- I know what happens after I decide.

### Vendor goal

The vendor should always feel:

- I know the current step.
- I know what is blocking progress.
- I know exactly what to do next.
- I can document legitimate work without exceeding anyone's permission.
- Reliance preserves a clear service history.

### Employee goal

The employee should always feel:

- I know which service I am recording.
- I know what I can record.
- I know what I must avoid.
- I know whether audio is on or off.
- I know when to stop.
- I know how to ask for help.

### Admin goal

The admin should always feel:

- I can see the exact service videos being considered.
- I can see which permissions and restrictions apply.
- I can make a fair platform decision without replacing participant authority.
- I can explain the decision from the visible record.

## 4. Universal Screen Anatomy

Every consequential page uses the same hierarchy.

1. **Context line:** Role, business, service, or work-record context.
2. **Page title:** The task or confirmed status in plain language.
3. **Primary message:** One sentence explaining why the user is here.
4. **Current-status row:** Status chip, next step, and privacy state.
5. **Main task area:** The decision, recording control, review content, or form.
6. **Supporting explanation:** Short answers to consequences and privacy questions.
7. **Action area:** One primary action, one secondary action, and an escape action.
8. **Expandable details:** Scope, decision history, delivery attempts, policy links, or technical support details only when needed.

### Mandatory orientation panel

The six orientation answers may appear as short text, a compact summary card, or accessible expandable details. They must never be absent.

| Question | UX requirement |
|---|---|
| Why am I here? | Name the event or participant who caused this screen to appear. |
| What is happening? | Show the current workflow state in ordinary language. |
| What do I need to do? | Present one clear primary action or state that no action is required. |
| What happens if I do nothing? | State whether recording remains locked, videos remain private, or the current state remains unchanged. |
| What happens after I decide? | Name the next participant or screen. |
| What stays private? | Identify the service details, service videos, or participant information that remain private. |

## 5. Visual Principles

### Color roles

Use color to reinforce meaning, never as the only signal.

| Role | Recommended color | Meaning |
|---|---|---|
| Primary action | Reliance blue | The one recommended task action on the screen |
| Ready or confirmed | Teal or green | Permission confirmed, recording ready, saved, approved private delivery |
| Waiting or attention | Amber | A participant decision or correction is needed |
| Blocked or privacy risk | Red | Recording blocked, access restricted, destructive action, material privacy concern |
| Private or neutral | Slate | Private, informational, not started, no action required |
| Public | Blue with globe icon | Available to anyone after all approvals |

Recommended dark-theme foundations:

- Page background: deep neutral navy, not pure black.
- Main surface: slightly lighter navy.
- Borders: visible cool gray with at least 3:1 contrast against adjacent surfaces.
- Primary text: near white.
- Secondary text: cool light gray with accessible contrast.
- Never place low-contrast blue, green, or amber text on a similarly colored surface.

All text and controls must meet WCAG AA contrast. Status meaning must also appear in text and icons.

### Icons

Use familiar outline icons from the active product icon library.

| Meaning | Recommended icon |
|---|---|
| Private | Lock |
| Public | Globe |
| Permission | Shield check |
| Service video | Video |
| Customer or authority holder | User check |
| Employee or team member | User round |
| Vendor business | Briefcase |
| Service location | Map pin |
| Audio off | Mic off |
| Ready or saved | Check circle |
| Waiting | Clock |
| Warning | Triangle alert |
| Retry | Rotate clockwise |
| Send or resend | Send |
| View | Eye |
| Remove from public view | Eye off |
| Help | Circle help |

Icons supplement text. Unfamiliar icon-only controls require tooltips and accessible names.

### Spacing and layout

- Use an 8-pixel spacing system.
- Keep ordinary desktop content between 720 and 1,120 pixels wide depending on the task.
- Keep customer permission and decision content near 680 pixels wide for focus.
- Use 8-pixel or smaller card corners unless the established design system requires otherwise.
- Do not place cards inside decorative cards.
- Use full-width page bands for context and status; use cards only for distinct decisions, videos, or repeated items.
- On mobile, use one column, 16-pixel side padding, and a non-overlapping sticky action area when the decision requires scrolling.
- Keep video previews at a stable 16:9 ratio.
- Reserve space for status changes so loading and error text do not shift the layout.

### Cards and progressive disclosure

Use cards for:

- one service location choice;
- one recording-subject category;
- one authority holder;
- one service-video stage;
- one delivery channel;
- one moderation decision.

Use expandable sections for:

- detailed recording boundaries;
- why identity verification is needed;
- delivery-attempt history;
- decision history;
- retention details;
- policy links;
- support diagnostics.

Do not hide the primary decision, privacy state, audio state, or consequence of declining inside an expandable section.

### Progress indicators

Use short, named progress indicators rather than percentages.

| Experience | Progress labels |
|---|---|
| Vendor setup | Service details -> Recording plan -> Permission -> Assignment |
| Customer permission | Understand -> Verify -> Decide |
| Employee recording | Confirm -> Starting Condition -> Work in Progress -> Final Result -> Send to manager |
| Customer public decision | Review videos -> Choose what is public -> Confirm |
| Admin review | Check permissions -> Review videos -> Decide |

Progress indicators show position, not urgency. Do not use countdowns to pressure decisions. A secure-link expiration is shown as an absolute date and time in a security note.

### Banners and chips

- **Success banner:** Confirmed result and next step. Dismissible only after the result is also visible in page state.
- **Warning banner:** Consequence and recovery action. Amber for attention; red only when recording or access is blocked.
- **Status chip:** Two to four words plus an icon. Examples: `Private`, `Recording ready`, `Waiting for permission`, `Correction requested`, `Public`.
- Never use a chip as the only explanation of a consequential status.

### Button hierarchy

Every screen identifies:

- **Primary Action:** Solid Reliance blue. One per decision area.
- **Secondary Action:** Outline or neutral fill. A valid alternative.
- **Escape Action:** Text or quiet button that exits without making the consequential decision.

Destructive actions use red only after the user has opened the specific action. They are never the visually dominant default.

Button text names the result: `Allow recording`, `Keep all private`, `Send to manager`, `Remove from public view`. Do not use `Submit`, `Yes`, `No`, or `Continue` when the action can be named.

### Accessibility and confidence

- Keyboard focus follows visual order.
- Screen readers receive status changes through an appropriate live region.
- Video controls have accessible names and do not autoplay with sound.
- Audio state is visible in text.
- Tap targets are at least 44 by 44 pixels.
- Motion is optional and respects reduced-motion settings.
- Errors are linked to the affected field and summarized at the top of long forms.
- Success is never communicated by color alone.

## 6. End-to-End Experience Map

| Step | Primary participant | Screen | Result |
|---|---|---|---|
| 1 | Vendor | Create work record | Accurate draft with recording locked |
| 2 | Vendor | Recording subject assessment | Risk level, restrictions, and required authority identified |
| 3 | Vendor | Authority holder selection | Correct decision-maker and channels identified |
| 4 | Vendor | Customer notification | Notice or permission request sent and tracked |
| 5 | Customer | Permission page | Verified allow, decline, wrong-recipient, or not-authorized result |
| 6 | Customer | Recording allowed or declined | Decision confirmed and affected roles notified |
| 7 | Employee | Employee recording | Three private stage videos recorded within scope |
| 8 | Employee/Vendor | Recording blocked | Specific gate remains locked with a recovery path |
| 9 | Vendor manager | Manager review | Approve private delivery, request correction, restrict, or escalate |
| 10 | Customer | Customer video and private video pages | Completed private service videos available |
| 11 | Customer | Public video approval | Exact selected versions kept private or approved to proceed |
| 12 | Customer | Review page | Optional genuine review or no action |
| 13 | Participant | Withdrawal | Future recording stops or public access ends |
| 14 | Participant/Admin | Dispute | Access narrows while a neutral review occurs |
| 15 | Admin | Admin moderation | Exact approved version becomes eligible for public view or remains private |

## 7. Screen Specifications

### Screen 1: Vendor creates work record

**Participant:** Vendor manager

**Workflow position:** Service details and location selection

| Element | Specification |
|---|---|
| Purpose | Create an accurate work record for a real service and establish the location used by the recording workflow. |
| Page title | Create work record |
| Why am I here? | A service has been scheduled or accepted and needs a Reliance work record. |
| What is happening? | The record is a draft. Recording is locked until the recording plan, required permission, assignment, and location checks are complete. |
| What do I need to do? | Enter the customer and service details, then select the actual recording location: Vendor business address, Customer residence, or Customer business address. |
| What if I do nothing? | The draft remains incomplete and no Reliance recording can begin. The underlying service may still proceed outside the recording workflow. |
| What happens after I decide? | Reliance opens the Recording subject assessment. |
| What stays private? | Customer contact information, service details, address, and the draft work record remain limited to authorized participants. |
| Primary message | Start with the service and the place where recording would occur. |
| Supporting explanation | The location affects verification, but it does not decide permission by itself. The next step asks what may actually appear in the videos. |
| Primary Action | Save and plan recording |
| Secondary Action | Save draft |
| Escape Action | Cancel and return to work records |
| Buttons | Use saved customer; Add customer; Review saved address |
| Status badges | Draft; Recording locked |
| Warnings | If the saved address is not the actual service location: `Choose the real service location before continuing. A later address change will require a new recording review.` |
| Success message | Work record saved. Next, identify what may appear in the service videos. |
| Failure message | We could not save this work record. Review the highlighted information and try again. No recording access was created. |
| Empty state | No customers or services available: explain how to add the first customer or choose a service without showing fake data. |
| Loading state | Stable form skeleton with `Loading customer and service details...`; preserve entered values during dependent-field loading. |
| Next screen | Recording subject assessment |

**Layout notes:** Use three selectable location cards with map-pin icons, saved address, and one-line consequences. Do not ask about public visibility on this screen.

### Screen 2: Recording subject assessment

**Participant:** Vendor manager

**Workflow position:** Recording plan

| Element | Specification |
|---|---|
| Purpose | Identify what may be recorded so Reliance can determine permission, verification, and employee boundaries. |
| Page title | Plan the service videos |
| Why am I here? | Reliance needs to understand the planned subject, setting, people, sensitive information, and audio before anyone is asked for permission. |
| What is happening? | A short branching assessment is creating the approved recording scope. It is not asking anyone to make videos public. |
| What do I need to do? | Select every subject and risk that could reasonably appear, then confirm whether the frame can avoid unrelated people and details. |
| What if I do nothing? | The work record stays in draft and recording remains locked. |
| What happens after I decide? | Reliance summarizes the approved scope, restrictions, and authority holders that are needed. |
| What stays private? | Assessment answers and the planned scope remain part of the private work record. |
| Primary message | Tell us what the camera may see or hear. |
| Supporting explanation | Answer for the planned frame, not the entire property. Audio stays off unless it is separately necessary and approved. |
| Primary Action | Review recording plan |
| Secondary Action | Save and finish later |
| Escape Action | Back to service details |
| Buttons | Why this matters; View examples; Clear selection for this question |
| Status badges | Step 2 of 4; Audio off; Recording locked |
| Warnings | Show specific inline warnings for a minor, audio, residence interior, customer-business interior, confidential information, identifiers, or a frame that cannot avoid other people. |
| Success message | Recording plan complete. Reliance identified the required permission and recording boundaries. |
| Failure message | The recording plan is incomplete. Answer the highlighted question before continuing. |
| Empty state | Before the first answer: show four short question cards, not a blank form. |
| Loading state | Load one branching question at a time with the previous answers preserved and visible in a compact summary. |
| Next screen | Authority holder selection |

**Question design:**

1. `What is the main subject?` Use multi-select cards for vendor property, customer property, customer or other person, employee identity, and another person or minor.
2. `What could appear in the setting?` Use multi-select cards for residence, business interior, documents/screens, identifiers/security details, sensitive information, or none.
3. `Is audio needed?` Default `No - audio stays off`; selecting yes opens a short necessity explanation and stronger permission warning.
4. `Can the frame avoid unapproved people and sensitive details?` Use `Yes` and `No or unsure`, each with its consequence.

The result summary uses plain labels: `Vendor-only work area`, `Customer property`, `People may appear`, `Residence interior`, `Business interior`, `Sensitive details`, `Audio requested`, `Manager review required`.

### Screen 3: Authority holder selection

**Participant:** Vendor manager; customer or representative later confirms

**Workflow position:** Identify the person authorized to decide

| Element | Specification |
|---|---|
| Purpose | Identify the intended customer, representative, business representative, or guardian for each required recording decision. |
| Page title | Who can decide? |
| Why am I here? | The recording plan includes a subject or place that requires permission from a specific person. |
| What is happening? | The vendor is identifying the intended decision-maker. Reliance will require that person to verify their contact and confirm their role. |
| What do I need to do? | Choose the role, enter or confirm the intended person's email and mobile number, and identify any other person whose permission may be required. |
| What if I do nothing? | No request is sent and recording remains locked. |
| What happens after I decide? | Reliance prepares one request delivered through the available verified channels. The recipient confirms their own identity and authority. |
| What stays private? | Contact details and claimed role are visible only to authorized workflow participants and Reliance support when needed. |
| Primary message | Choose the person who has authority over the planned recording. |
| Supporting explanation | A property owner or business representative cannot automatically decide for every person who may appear. The recipient must confirm their own role. |
| Primary Action | Review recipient and request |
| Secondary Action | Save without sending |
| Escape Action | Back to recording plan |
| Buttons | Add another authority holder; Correct customer details; Why another person's permission may be needed |
| Status badges | Authority needed; Contact not verified; Recording locked |
| Warnings | Phone and email appear to belong to different people; no digital contact available; minor identified without guardian; business representative cannot approve other people. |
| Success message | Intended decision-maker saved. Review the message before sending. |
| Failure message | We could not save the intended decision-maker. Check the highlighted contact or role information. |
| Empty state | No eligible contact: `No verified email or mobile number is available. Recording cannot be requested in Version 1, but the service may continue without Reliance recording.` |
| Loading state | Contact and role card skeleton; never briefly display another customer's contact. |
| Next screen | Customer notification |

**Role cards:** Customer; Authorized representative; Customer business representative; Guardian. Each card states what the role may authorize and what it cannot authorize.

### Screen 4: Customer notification

**Participant:** Vendor manager

**Workflow position:** Send and track notice or permission request

| Element | Specification |
|---|---|
| Purpose | Review, send, and track the customer notice or permission request without creating duplicate decisions. |
| Page title | Send recording request |
| Why am I here? | The recording plan is complete and the intended recipient needs information or a verified decision. |
| What is happening? | SMS and email are delivery channels for one request. The screen shows the current link version, recipient, delivery state, and expiration. |
| What do I need to do? | Confirm the recipient and request summary, then send. After sending, correct failed contact details or resend only when needed. |
| What if I do nothing? | The request is not sent, or remains pending if already sent. Recording stays locked when permission is required. |
| What happens after I decide? | The recipient opens the secure link, verifies identity and role, and allows, declines, or reports a mismatch. |
| What stays private? | The message contains only the minimum service context. Detailed customer information and service videos are not included. |
| Primary message | Send one clear request through the customer's available channels. |
| Supporting explanation | A resend updates the same request and invalidates older action links. It does not create a second permission decision. |
| Primary Action | Send secure link |
| Secondary Action | Edit recipient |
| Escape Action | Return to work record |
| Buttons | Preview email; Preview text message; Resend secure link; View delivery details |
| Status badges | Not sent; Sending; Delivered; Delivery failed; Waiting for permission; Secure link expired; Wrong recipient |
| Warnings | Absolute security expiration date and time; all-channel delivery failure; different phone/email owners; no available digital channel. Never show a pressure countdown. |
| Success message | Recording request sent. Recording remains locked until the required permission is confirmed. |
| Failure message | We could not deliver the request through {channel}. {Other channel result}. Check the contact information before resending. |
| Empty state | No contact channel: explain that no verbal, handwritten, employee, manager, or admin substitute is available in Version 1. |
| Loading state | `Sending the secure link...` with controls disabled against duplicate sends; transition to channel-specific results. |
| Next screen | Vendor returns to work-record status; customer opens Customer permission page |

**Notice-only variant:** Title `Send recording notice`; explain that planned private recording is limited to vendor-owned property or a vendor-controlled work area. The customer can report that the plan is incorrect. Do not present allow/decline language when no customer decision is required.

### Screen 5: Customer permission page

**Participant:** Customer, authorized representative, business representative, or guardian

**Workflow position:** Understand, verify, decide

| Element | Specification |
|---|---|
| Purpose | Educate the intended decision-maker, verify identity and authority, and obtain an affirmative allow or decline decision. |
| Page title | Your permission is needed |
| Why am I here? | `{Business name} would like to record short service videos for {service name}.` |
| What is happening? | The videos would begin as private. Recording, audio, and later public sharing are separate decisions. |
| What do I need to do? | First review what may be recorded and who can view it. Then verify your contact and role before allowing or declining. |
| What if I do nothing? | The request expires 48 hours after it was issued. No permission is created and recording remains locked. The business may send a new link if the plan is still accurate. |
| What happens after I decide? | Reliance records the decision, sends a confirmation, and updates the business and assigned employee. Allowing recording does not make any video public. |
| What stays private? | The work record, contact details, decision, and all recorded service videos begin private. Nothing becomes public from this decision. |
| Primary message | Understand what may be recorded before you decide. |
| Supporting explanation | Show the business, service, location type, planned subject, whether people may appear, audio state, three stages, initial viewers, service-continuation result, and separate later public decision. |
| Primary Action | Allow recording |
| Secondary Action | Decline recording |
| Escape Action | Decide later |
| Buttons | This request is not for me; I am not authorized to decide; View recording details; Why verification is needed; Contact support |
| Status badges | Private to start; Audio off or Audio requested; Verification required; Secure link expires {absolute date/time} |
| Warnings | Minor or guardian authority; audio requested; protected people; residence/business-interior restrictions; request differs from actual service; expired or superseded link. |
| Success message | Permission recorded. Recording can begin only after the remaining assignment, location, and employee checks are complete. Nothing was made public. |
| Failure message | We could not record your decision. Nothing changed. Check your connection and try again, or request a new secure link if this one expired. |
| Empty state | Request details unavailable: show no decision controls and offer `Request a new secure link` or `Contact support`. |
| Loading state | Load identity-safe request summary first; keep decision controls disabled until all required details and verification state are confirmed. |
| Next screen | Recording allowed page, Recording declined page, or Wrong recipient page |

**Education-before-ask sequence:**

1. **Why:** Business and service identity.
2. **What:** Recording subject and location.
3. **Who:** Private initial viewers.
4. **Boundaries:** Audio, people, sensitive details, and employee stop conditions.
5. **If no:** Recording stays off; service normally continues without Reliance recording, subject to any essential private-recording condition disclosed before service acceptance.
6. **Later:** Public sharing is a separate decision after the exact completed videos exist.
7. **Verify:** Logged-in matching account or one-time code, followed by role and authority confirmation.
8. **Decide:** Equally clear allow and decline actions.

### Screen 6: Wrong recipient page

**Participant:** Message recipient; vendor manager receives the resulting status

**Workflow position:** Contact correction

| Element | Specification |
|---|---|
| Purpose | Let a mistaken recipient safely report the mismatch without approving or declining for the customer. |
| Page title | This request is not for you |
| Why am I here? | The recipient selected `This request is not for me` or could not confirm the service or authority. |
| What is happening? | Reliance is invalidating the action link and notifying the business to correct the recipient. This is not recorded as the customer's decline. |
| What do I need to do? | Confirm the wrong-recipient report. No additional service information is required. |
| What if I do nothing? | The current request remains undecided until it expires. The recipient can close the page without making a decision. |
| What happens after I decide? | The old action link stops accepting decisions. The vendor corrects the contact and sends a new request if recording is still needed. |
| What stays private? | The recipient sees no service videos and no customer information beyond the minimum needed to recognize the mismatch. |
| Primary message | You do not need to decide for this service. |
| Supporting explanation | Reporting a wrong recipient protects the intended customer and does not approve, decline, or cancel the service. |
| Primary Action | Report wrong recipient |
| Secondary Action | Go back to request |
| Escape Action | Close page |
| Buttons | Contact support |
| Status badges | No decision made; Recording locked |
| Warnings | Do not ask the recipient to identify the correct person or expose additional customer data. |
| Success message | Thank you. This link can no longer be used to make a decision. The business was asked to correct the contact information. |
| Failure message | We could not send the report. No decision was made. Try again or contact Reliance support. |
| Empty state | Request already invalidated: show the confirmed wrong-recipient result and no decision controls. |
| Loading state | `Protecting this request...` during invalidation; prevent repeated submissions. |
| Next screen | Confirmation page; vendor sees Customer notification with `Wrong recipient` status |

### Screen 7: Recording declined page

**Participant:** Customer confirmation; vendor and employee status variants

**Workflow position:** Recording remains locked

| Element | Specification |
|---|---|
| Purpose | Confirm the decline without pressure and clearly explain the service and recording consequences. |
| Page title | Recording was declined |
| Why am I here? | The customer or authorized representative chose not to allow Reliance service videos. |
| What is happening? | Recording is locked for this work record. The decision is separate from public sharing and from an optional review. |
| What do I need to do? | Customer: no action is required. Vendor: follow the approved service-continuation rule. Employee: do not record. |
| What if I do nothing? | Recording remains unavailable. The service normally continues without Reliance recording unless an essential private-recording condition was disclosed before service acceptance. |
| What happens after I decide? | The business and assigned employee receive the status. Any new request requires a valid new decision path, not an override. |
| What stays private? | The decision and work-record details remain private. No service videos are created through Reliance. |
| Primary message | Your choice was recorded. No Reliance service videos may be recorded for this work record. |
| Supporting explanation | Declining recording is not a review, rating, complaint, or decision about public sharing. |
| Primary Action | Return to service details |
| Secondary Action | View decision summary |
| Escape Action | Close page |
| Buttons | Report an error; Contact support |
| Status badges | Recording declined; Recording locked; No public decision |
| Warnings | Vendor-only variant shows disclosed essential-private-recording rule and prohibits introducing that condition after service begins. |
| Success message | Recording decline confirmed. A copy was sent through the available verified channels. |
| Failure message | Your decline is recorded, but we could not deliver every confirmation. Recording remains locked. |
| Empty state | No matching active request: explain that no new decision was recorded and offer support. |
| Loading state | `Confirming your decision...`; do not briefly display an allowed state. |
| Next screen | Customer service details; vendor work record; employee assigned services |

### Screen 8: Recording allowed page

**Participant:** Customer confirmation; vendor and employee status variants

**Workflow position:** Other gates may now proceed

| Element | Specification |
|---|---|
| Purpose | Confirm the exact permission and explain that recording still depends on the remaining approved gates. |
| Page title | Recording permission confirmed |
| Why am I here? | The customer or authority holder allowed the planned private recording. |
| What is happening? | Reliance recorded the verified decision, role, scope, audio state, location, and time. No service video was made public. |
| What do I need to do? | Customer: no action is required now. Vendor: assign or confirm the employee. Employee: complete location and pre-recording checks. |
| What if I do nothing? | Permission remains valid for this work record through completion unless withdrawn or materially superseded. Recording does not start by itself. |
| What happens after I decide? | The assigned employee can proceed only after assignment, location, scope, and certification checks pass. Public sharing can be considered only after completed videos are delivered privately. |
| What stays private? | The permission record, work record, and all future service videos begin private. |
| Primary message | Permission is confirmed. Recording can begin after the remaining service checks. |
| Supporting explanation | Show approved subject, location, people scope, audio state, initial private viewers, and material changes that require a new decision. |
| Primary Action | View permission summary |
| Secondary Action | Return to service details |
| Escape Action | Close page |
| Buttons | Withdraw recording permission; Report an error; Contact support |
| Status badges | Permission confirmed; Private to start; Audio off or Audio allowed; Recording ready only when all gates pass |
| Warnings | If assignment, location, guardian, audio, dispute, or scope gate is still unresolved, clearly show `Recording is still locked` and the responsible next participant. |
| Success message | Permission confirmed. The business and assigned employee were notified. |
| Failure message | Permission is recorded, but one or more notifications could not be delivered. Recording follows the confirmed system status, not the notification result. |
| Empty state | Decision record unavailable: do not infer permission; show support and keep recording locked. |
| Loading state | `Loading your confirmed permission...`; no action controls until the durable result is known. |
| Next screen | Customer service details; vendor work record; employee recording or recording blocked page |

### Screen 9: Employee recording page

**Participant:** Assigned employee

**Workflow position:** Certification, three-stage recording, submission

| Element | Specification |
|---|---|
| Purpose | Tell the assigned employee exactly what may be recorded and guide safe completion of the three service-video stages. |
| Page title | Record service videos |
| Why am I here? | This work record is assigned to the employee and the current recording gates determine whether the camera can open. |
| What is happening? | Service videos are private while being recorded. The page shows scope, location, audio, permission, and stage progress. |
| What do I need to do? | Confirm the work record and boundaries, verify the location when required, then record, preview, and save each approved stage before sending to the manager. |
| What if I do nothing? | No stage is recorded or submitted. The service may continue, but the Reliance proof remains incomplete. |
| What happens after I decide? | Saved stages remain private. After all required stages are confirmed, the package is sent to the vendor manager and becomes read-only except for requested corrections. |
| What stays private? | All clips, location checks, certification, and incident reports remain within the authorized work-record workflow. |
| Primary message | Record only the approved service area and stop if conditions change. |
| Supporting explanation | Always show business, customer, service, saved location, approved subject, prohibited content, audio state, and stop conditions before the camera control. |
| Primary Action | Contextual: Confirm and unlock recording; Record {stage}; Save {stage}; Send to manager |
| Secondary Action | Retake; Pause; Save and return later |
| Escape Action | Return to assigned services |
| Buttons | Report changed conditions; Report accidental capture; Contact manager; View full recording boundaries |
| Status badges | Assigned to you; Location confirmed; Permission active or Vendor-only scope; Audio off; Private; Stage 1 of 3; Saved |
| Warnings | People, minors, audio, sensitive details, changed room/address, changed subject, reassignment, fallback video, or prior incident. Warnings appear before camera access, not after upload. |
| Success message | `{Stage} saved. Review the next stage or send the completed service videos to your manager.` |
| Failure message | `We could not save the {stage} video. Your stage is not complete. Check your connection and try again.` Preserve a local retry state where approved; never show saved before server confirmation. |
| Empty state | No assigned service or no unlocked stage: explain the responsible next participant and provide a return action. |
| Loading state | Stable stage cards and preview area; `Checking assignment, permission, location, and recording scope...`; camera opens only after all gate results are confirmed. |
| Next screen | Next recording stage; Recording blocked page; Manager review after submission |

**Pre-recording certification experience:**

- Once per assignment or material scope change, show a concise certification summary with a link to details.
- Before each stage, show a three-line reminder: approved subject, audio state, and stop conditions.
- The stage reminder is not presented as a new customer permission event.
- Use a persistent red `Stop recording` control while recording.
- Display an obvious recording indicator with elapsed time and the 30-second maximum.
- Preview before save. A retake does not replace a confirmed clip until the new preview is saved.

**Stage cards:**

1. Starting Condition - `Show the condition before work begins.`
2. Work in Progress - `Show active work within the approved area.`
3. Final Result - `Show the completed result clearly.`

Prerecorded fallback appears only after a documented live-capture failure and manager authorization. It is labeled `Private fallback video` and never presented as eligible for public use.

### Screen 10: Recording blocked page

**Participant:** Employee; vendor manager receives matching status

**Workflow position:** A recording gate failed

| Element | Specification |
|---|---|
| Purpose | Explain the exact block, protect against unauthorized recording, and provide the correct recovery path. |
| Page title | Recording is not available yet |
| Why am I here? | One or more required recording gates did not pass. |
| What is happening? | The camera remains locked. The page names the failed gate without exposing technical internals. |
| What do I need to do? | Follow the reason-specific action: retry location, wait for permission, review scope, ask the manager, restore camera permission, or resolve an incident. |
| What if I do nothing? | Recording stays locked. The service may continue without Reliance recording when the approved service plan allows it. |
| What happens after I decide? | Reliance checks the gate again or routes the issue to the responsible manager, admin, or support reviewer. |
| What stays private? | No new video is recorded. Failed verification details and reports remain private to authorized participants. |
| Primary message | Recording is blocked until {plain-language reason} is resolved. |
| Supporting explanation | Explain the gate and the responsible role. Never suggest recording outside Reliance as a workaround. |
| Primary Action | Reason-specific: Try location again; Contact manager; Review changed scope; Enable camera access |
| Secondary Action | Continue service without recording, when allowed |
| Escape Action | Return to assigned services |
| Buttons | View recording boundaries; Report a problem; Request support |
| Status badges | Recording blocked; Waiting for permission; Location not confirmed; Scope changed; Manager review needed; Access restricted |
| Warnings | Red banner for missing permission, reassignment, withdrawal, unresolved minor/protected-person issue, or privacy dispute. Amber for retryable device/location conditions. |
| Success message | Required check confirmed. Return to the service to review the recording scope before opening the camera. |
| Failure message | We could not confirm the required check. Recording remains locked. Try again or contact the named responsible person. |
| Empty state | Unknown block reason: fail safely with `Reliance could not confirm recording access. Recording remains locked. Contact support.` |
| Loading state | `Checking recording access...`; keep camera controls absent, not merely disabled behind an overlay. |
| Next screen | Employee recording page after resolution; assigned services if no recording; admin review for a location exception |

**Reason variants:** Current assignee mismatch; inactive vendor membership; permission pending/declined/expired/withdrawn/superseded; assessment incomplete; certification declined; audio not approved; minor/authority unresolved; location failed; location/scope mismatch; active dispute; accidental-capture disposition pending; camera permission denied; upload retry required.

### Screen 11: Manager review page

**Participant:** Vendor manager

**Workflow position:** Approve private delivery or request correction

| Element | Specification |
|---|---|
| Purpose | Give the vendor manager enough context to confirm accurate private proof without expanding participant permission. |
| Page title | Review service videos |
| Why am I here? | The assigned employee submitted the service-video package for manager review. |
| What is happening? | The package is private and read-only for the employee unless a correction is requested. |
| What do I need to do? | Review each stage, scope summary, location result, permission state, employee certification, fallback label, and incident report. Approve private delivery, request a correction, restrict a clip, or escalate a concern. |
| What if I do nothing? | The customer does not receive approved private proof and the package remains waiting for manager review. |
| What happens after I decide? | Approval delivers the private service videos to the customer. Correction returns only affected stages. Escalation keeps access private and routes the concern. |
| What stays private? | Every service video remains private. Manager approval is not customer approval to make anything public. |
| Primary message | Confirm that the service videos are accurate and stay within the approved recording scope. |
| Supporting explanation | Show the permission and scope summary beside the videos. Clearly distinguish private delivery from any later public proposal. |
| Primary Action | Approve private service videos |
| Secondary Action | Request correction |
| Escape Action | Return to work records |
| Buttons | Restrict this video; Report privacy concern; View location result; View decision history; Play each stage |
| Status badges | Waiting for manager review; Private; 3 of 3 stages; Live recording or Private fallback; Incident reported |
| Warnings | Missing stage; unconfirmed preview; scope mismatch; audio detected; protected person; sensitive detail; fallback provenance; location exception; replaced version. |
| Success message | Private service videos approved. The customer will be notified when delivery is confirmed. |
| Failure message | We could not save the manager decision. Nothing was delivered or made public. Review the current package and try again. |
| Empty state | No submitted package: show stage progress and responsible employee; do not render empty approval controls. |
| Loading state | Stable three-column or stacked stage layout with video skeletons; decision controls remain disabled until the exact package version loads. |
| Next screen | Customer video page after delivery; employee recording correction state; dispute/escalation page |

### Screen 12: Customer video page

**Participant:** Verified customer or authorized representative

**Workflow position:** Completed private proof delivery

| Element | Specification |
|---|---|
| Purpose | Deliver the complete manager-approved private service history and provide viewing, download, review, concern, and public-choice entry points. |
| Page title | Your service videos |
| Why am I here? | `{Business name} completed and approved the service videos for {service name}.` |
| What is happening? | Starting Condition, Work in Progress, and Final Result are available as private service videos. |
| What do I need to do? | No action is required. The customer may watch, download when permitted, report a concern, leave an optional review, or respond to a separate public proposal. |
| What if I do nothing? | The service remains complete and the videos remain private. No review or rating is created. |
| What happens after I decide? | Viewing changes nothing. A review follows the review process. A public choice opens the exact-video approval page. A concern restricts affected access when required. |
| What stays private? | All videos remain private unless selected exact versions complete every required approval and Reliance review. Customer contact and decision history are not public. |
| Primary message | Your private service videos are ready to review. |
| Supporting explanation | Explain the three stages, who can view them, approved private retention, and that public sharing is optional and separate. |
| Primary Action | View Final Result, with all three stages equally accessible |
| Secondary Action | Download private service videos, when permitted |
| Escape Action | Return to service history |
| Buttons | View Starting Condition; View Work in Progress; Leave an optional review; Report a concern; Review public proposal if one exists |
| Status badges | Service complete; Private; Manager approved; Review available; Public choice available only when proposed |
| Warnings | Fallback video private-only; active dispute; download restriction; retention date; corrected version awaiting review. |
| Success message | Service video downloaded. The download remains private service history and does not authorize public or promotional reuse. |
| Failure message | We could not load this service video. Your service history was not changed. Try again or contact support with the displayed Reference ID. |
| Empty state | Manager-approved proof not delivered: identify whether delivery is pending, correction is requested, or no Reliance recording exists. |
| Loading state | Page context and privacy badge load before video skeletons; never flash a public status. |
| Next screen | Private video page; public video approval page; review page; dispute page |

### Screen 13: Private video page

**Participant:** Authorized customer, vendor manager, assigned employee with legitimate access, or limited admin role

**Workflow position:** View one private service-video stage

| Element | Specification |
|---|---|
| Purpose | Show one exact private service-video version with its stage, access state, and allowed actions. |
| Page title | `{Stage name}` |
| Why am I here? | The user selected a private service video from an authorized work record. |
| What is happening? | This exact video is available only to authorized participants for the service. |
| What do I need to do? | No action is required. Watch, return to the package, download if the role permits, or report a concern. |
| What if I do nothing? | The video remains private under the approved retention and access rules. |
| What happens after I decide? | Viewing or returning changes nothing. Reporting a concern may restrict access. A public proposal uses a separate exact-media screen. |
| What stays private? | The video, service details, participants, and private decision history remain unavailable to the public. |
| Primary message | This service video is private. |
| Supporting explanation | Name who may view it for this work record. Show audio state and any privacy correction or fallback label. |
| Primary Action | Play service video |
| Secondary Action | Back to all service videos |
| Escape Action | Return to service history |
| Buttons | Download, when role permits; Report a concern; View video details |
| Status badges | Private; Starting Condition/Work in Progress/Final Result; Audio off; Live recording or Private fallback; Current version |
| Warnings | Private download does not authorize public reuse; employee cannot download after submission; fallback cannot become public. |
| Success message | Concern submitted. Access will remain no broader than the current private state while Reliance reviews it. |
| Failure message | We could not play this service video. Your access and the saved video were not changed. Try again or contact support. |
| Empty state | Video unavailable due to correction, deletion, retention, or restricted evidence state; state the known reason without exposing protected detail. |
| Loading state | Fixed 16:9 player skeleton with private badge visible outside the player. |
| Next screen | Customer video page; dispute page; public video approval only through a valid proposal |

### Screen 14: Public video approval page

**Participant:** Verified customer or authority holder; applicable employee or guardian approval handled as separate participant decisions

**Workflow position:** Post-completion exact-video decision

| Element | Specification |
|---|---|
| Purpose | Let the authorized participant review the exact proposed videos and choose all, some, none, or request a correction before any public use. |
| Page title | Choose what to make public |
| Why am I here? | The vendor proposed one or more completed service videos for public display after private delivery. |
| What is happening? | Each proposed exact version, caption, label, audio state, and privacy edit is being presented for a separate public decision. Final Result is the default proposal; other stages appear only if intentionally proposed. |
| What do I need to do? | Watch every proposed video being considered, then keep it private, select it for public review, or request a change. |
| What if I do nothing? | Every service video remains private. Service completion, review access, and participant standing are unchanged. |
| What happens after I decide? | Selected exact versions proceed only after all other required participant approvals, vendor confirmation, and Reliance review. Keeping private ends the public proposal without affecting service. |
| What stays private? | Unselected stages, rejected proposals, earlier versions, unredacted versions, contact information, and private service history remain private. |
| Primary message | Review the exact videos before deciding who can view them. |
| Supporting explanation | `Public` means anyone can view the approved version. Nothing becomes public merely because recording was allowed or the service is complete. |
| Primary Action | Make selected videos public |
| Secondary Action | Keep all private |
| Escape Action | Decide later |
| Buttons | Request a change; Keep this video private; Select to make public; Report missing authority; View who must also approve |
| Status badges | Private now; Proposed for public view; Final Result; Audio off/on; Redacted; Approval required; Waiting for others |
| Warnings | Anyone can view public videos; outside copies cannot be fully controlled; identifiable minor prohibited; bystander/employee/audio authority missing; edit requires renewed approval. |
| Success message | Your choice was recorded. Selected videos remain private until every required approval and Reliance review is complete. |
| Failure message | We could not save your public-sharing choice. Nothing was made public. Review the current versions and try again. |
| Empty state | No valid proposed videos: `There is nothing to review for public sharing. Your completed service videos remain private.` |
| Loading state | Load exact version identity, privacy state, and stage label before enabling playback or decisions. Never enable package approval while any proposed video is still loading. |
| Next screen | Confirmation; admin moderation after all participant approvals; customer video page if kept private; correction request workflow |

**Video-card design:** One unframed responsive list or grid of exact video cards. Each card contains the player, stage, audio state, redactions, caption/label preview, visible people category, current `Private` badge, and one explicit choice. A package-level action summarizes each selected version before final confirmation.

### Screen 15: Review page

**Participant:** Verified customer or authorized reviewer

**Workflow position:** Optional opinion after completed private proof is available

| Element | Specification |
|---|---|
| Purpose | Allow a genuine optional review without deadlines, automatic outcomes, or pressure related to public service videos. |
| Page title | Share an optional review |
| Why am I here? | The service is complete and manager-approved private proof is available. |
| What is happening? | The customer may describe the service experience. The review is separate from recording permission and public-video choices. |
| What do I need to do? | Optionally choose a rating within the approved bounds, write the review, and choose public or private feedback only where the product supports those choices. |
| What if I do nothing? | Nothing happens. The work record remains complete and no rating, review, or Trust Score review signal is created. |
| What happens after I decide? | A submitted review follows ownership, duplicate protection, and neutral moderation. It is public only when the supported visibility choice and moderation allow it. |
| What stays private? | Private service videos and private feedback remain private. A review does not make service videos public. |
| Primary message | Your service is complete. You may leave an optional review. |
| Supporting explanation | There is no deadline. The customer may review the service experience, the available proof, or both and is not required to watch every video. |
| Primary Action | Submit review |
| Secondary Action | Save draft, only if genuinely supported; otherwise Return later |
| Escape Action | Not now |
| Buttons | View service videos; Review visibility details; Report a service concern separately |
| Status badges | Optional; Service complete; Private feedback or Public review where supported; Moderation pending after submission |
| Warnings | Do not include private contact details or unrelated personal information. Explain duplicate-review protection if a review already exists. |
| Success message | Review submitted. It will follow Reliance's current review and visibility process. Your service videos remain private unless separately approved. |
| Failure message | We could not save your review. No rating or review was created. Your service record was not changed. |
| Empty state | No eligible completed work record: explain that the review becomes available after manager-approved private proof is delivered. |
| Loading state | Load existing review eligibility and duplicate state before enabling the form. Never show an empty form that later becomes ineligible. |
| Next screen | Review confirmation; customer video page; existing review detail |

### Screen 16: Withdrawal page

**Participant:** Customer/authority holder, vendor manager, identifiable employee, guardian, or other authorized participant

**Workflow position:** Stop future recording, end public visibility, or request deletion

| Element | Specification |
|---|---|
| Purpose | Clearly separate stopping future recording, removing public access, requesting deletion, and preserving restricted decision history. |
| Page title | Change recording or sharing permission |
| Why am I here? | An authorized participant wants to change what Reliance may record or who may view an existing service video. |
| What is happening? | Reliance will apply the narrowest requested access immediately where required and preserve the historical record of the earlier valid decision. |
| What do I need to do? | Choose the specific result: stop future recording, remove selected videos from public view, withdraw a personal-likeness approval, or request deletion. Review the consequence before confirming. |
| What if I do nothing? | The current permission and access state remain unchanged. No withdrawal is inferred. |
| What happens after I decide? | Future capture stops or Reliance-controlled public access ends immediately as applicable. A deletion request follows retention, dispute, and hold review. Affected participants are notified. |
| What stays private? | Withdrawal details and decision history remain restricted. Unpublishing does not make private evidence public, and retained evidence does not remain publicly available. |
| Primary message | Choose exactly what you want to stop or change. |
| Supporting explanation | `Remove from public view` is immediate on Reliance. `Delete media` is a separate request and may require restricted retention for an active dispute or legal requirement. Reliance cannot promise deletion of copies made outside Reliance. |
| Primary Action | Contextual: Stop future recording; Remove from public view; Submit deletion request |
| Secondary Action | Keep current settings |
| Escape Action | Cancel and return |
| Buttons | Select affected videos; View current viewers; View retention details; Report an outside copy; Contact support |
| Status badges | Recording active/inactive; Private; Public; Removal pending; Removed from public view; Deletion requested; Restricted evidence |
| Warnings | Explain immediate operational effect, outside-copy limit, active dispute/hold, employee/guardian scope, and no erasure of historical decision facts. |
| Success message | `{Selected result} confirmed.` Then state the exact access change, notification status, and next review or deletion step. |
| Failure message | We could not confirm this change. Access was not widened. If public access could not be safely confirmed, Reliance keeps the affected video private while support reviews the issue. |
| Empty state | No active recording or public approval available to withdraw: explain current private state and provide deletion or support options where applicable. |
| Loading state | Load current permission, exact video versions, and audience before showing choices. Never default to a broader state. |
| Next screen | Withdrawal confirmation; customer video page; dispute page; deletion status |

**Decision design:** Do not combine all withdrawal types into one checkbox list. Use one card per consequence, each with a plain-language `What changes` and `What does not change` summary.

### Screen 17: Dispute page

**Participant:** Customer, vendor, employee, guardian, protected non-participant, or admin-assigned reviewer

**Workflow position:** Report and resolve identity, authority, scope, privacy, accuracy, or service concerns

| Element | Specification |
|---|---|
| Purpose | Collect the minimum information needed to protect participants, narrow access, and route the concern fairly. |
| Page title | Report a concern |
| Why am I here? | A participant believes the recording, permission, identity, service-video scope, public use, accuracy, or retention may be wrong. |
| What is happening? | Reliance will classify the concern and restrict affected access immediately when identity, authority, privacy, a minor, or a protected person may be involved. |
| What do I need to do? | Choose the concern category, identify the affected service video or work record, describe the issue briefly, and provide only relevant supporting information. |
| What if I do nothing? | No dispute is opened and the current state remains, except Reliance may still act on an independently detected safety or privacy risk. |
| What happens after I decide? | Reliance confirms the report, applies any required restriction, assigns a neutral reviewer, notifies affected participants, and records the final outcome or appeal. |
| What stays private? | The report, contact details, supporting information, restricted videos, and reviewer notes remain limited to authorized dispute handling. |
| Primary message | Tell Reliance what is wrong so we can protect the affected service record. |
| Supporting explanation | Separate privacy/permission concerns from service-quality disagreements. Do not ask the reporter to make legal conclusions. |
| Primary Action | Submit concern |
| Secondary Action | Save and return later, only if secure draft support exists; otherwise Contact support |
| Escape Action | Cancel and return |
| Buttons | Select service video; Upload supporting information only when needed; View what happens next; Request urgent privacy review |
| Status badges | Draft; Submitted; Access restricted; Under review; Information needed; Resolved; Appealed |
| Warnings | Avoid unnecessary sensitive details; explain immediate access restriction; urgent minor/bystander/identity issues; false success if upload fails. |
| Success message | Concern submitted. `{Access result}`. Reliance will notify you when the review status changes. |
| Failure message | We could not submit the concern. No new dispute record was confirmed. If public access may create immediate harm, use the displayed urgent support option. |
| Empty state | No selectable service record: allow a general privacy or wrong-record report without exposing unrelated records. |
| Loading state | Load only the reporter's authorized work records; use stable category cards and an upload progress state when evidence is added. |
| Next screen | Dispute status page; customer/vendor/employee record with restricted status; admin review queue |

**Concern categories:** I did not give permission; The wrong person decided; The video recorded more than approved; A person or minor should not appear; Private information is visible; This is not my service; The video is inaccurate; Remove from public view; Delete or restrict the record; Service-quality concern; Something else.

### Screen 18: Admin moderation page

**Participant:** Admin or authorized Reliance reviewer

**Workflow position:** Final public eligibility or restricted review

| Element | Specification |
|---|---|
| Purpose | Present the exact proposed versions, participant approvals, restrictions, and service context required for a fair Reliance decision. |
| Page title | Review service videos |
| Why am I here? | All required participant approvals appear complete for a public proposal, or a restricted concern requires an admin decision. |
| What is happening? | The videos remain private until the admin approves the exact proposed versions for public view. Admin can narrow or block access but cannot create missing permission. |
| What do I need to do? | Verify the exact version, permission chain, authority roles, audio state, visible people, privacy edits, captions, service accuracy, and vendor representation before deciding. |
| What if I do nothing? | The proposal remains private and waiting for review. No public access is created. |
| What happens after I decide? | Approval makes only the approved exact versions eligible for public view. Rejection or correction keeps them private. Restriction immediately narrows access. Participants receive the applicable result. |
| What stays private? | Unselected stages, prior versions, unredacted sources, private service history, contact information, permission details, and reviewer notes remain private. |
| Primary message | Confirm that the exact proposed videos match every recorded permission and Reliance standard. |
| Supporting explanation | Use a side-by-side decision summary: customer/authority holder, vendor, employee likeness, guardian/minor, bystander, audio, exact version, caption/label, and public audience. |
| Primary Action | Approve for public view |
| Secondary Action | Request correction |
| Escape Action | Return to moderation queue |
| Buttons | Keep private; Restrict access; Reject proposal; Flag concern; View exact decision history; Compare versions; Open dispute |
| Status badges | Ready for Reliance review; Exact version; All participant approvals present; Permission missing; Minor prohibited; Private; Public; Correction requested; Access restricted |
| Warnings | Missing approval; mismatched version; identifiable minor; unresolved bystander; audio authority; sensitive identifier; fallback media; changed caption; active dispute; vendor suspension. |
| Success message | `{Decision}` saved for the exact selected versions. Applicable participants are being notified. |
| Failure message | We could not save the admin decision. No new public access was created. Reload the exact package before trying again. |
| Empty state | No eligible proposals: explain current filters and show the moderation queue without fabricated cards. |
| Loading state | Load the permission chain and exact version identity before video playback and decision controls. Any mismatch defaults the decision area to unavailable. |
| Next screen | Public service-video confirmation; correction queue; private package; dispute review; moderation queue |

**Admin layout:**

- Top band: service, vendor, customer/representative role, current audience, and exact version.
- Permission checklist: each required participant shown as confirmed, missing, withdrawn, or not applicable with the reason.
- Service-video area: stable 16:9 previews with stage, audio, redaction, caption, people, and provenance.
- Decision area: one package-level decision only after all clips and approvals are loaded; stage-specific controls remain available for narrower outcomes.
- Decision history: collapsed by default but one click away.
- AI assistance, if present, may summarize visible facts and missing items. It cannot recommend widening access, invent approval, or make the decision.

## 8. Cross-Screen State Rules

### Loading

- Load identity-safe context before private detail.
- Preserve the last confirmed privacy state while refreshing.
- Never flash `Public`, `Allowed`, `Saved`, or `Delivered` before confirmation.
- Disable duplicate consequential actions while the first request is pending.
- Use skeletons matching stable final dimensions.

### Failure

Every failure states:

1. What did not complete.
2. The known reason, if safe and useful.
3. What the user can do next.
4. What was not changed.

Failures default to no new recording, no broader audience, private or restricted access, preserved decision history, and a visible recovery path.

### Success

Every success states:

1. The exact confirmed result.
2. The current privacy state.
3. The next participant or action.
4. Any delivery issue that remains.

Never report a request as delivered when only creation succeeded. Never report deletion as complete while physical deletion is pending.

### Empty states

An empty state must distinguish:

- nothing has been created;
- work exists but is waiting for another participant;
- recording was declined;
- recording was not available;
- proof is awaiting manager review;
- proof is private and no public proposal exists;
- a record is restricted, deleted, or outside retention;
- filters have no matching results.

Do not use one generic `No data` message.

### Status synchronization

When a consequential decision succeeds, update the current screen immediately and update all role dashboards from the confirmed source. Do not leave a stale action visible after assignment, deletion, permission, submission, approval, withdrawal, or moderation.

### Mobile behavior

- Put the task before supporting details.
- Use a sticky bottom action bar only when it does not obscure content or browser controls.
- Stack video cards vertically.
- Keep the privacy badge, audio state, and current stage visible near the player.
- Keep primary, secondary, and escape actions distinct.
- Do not require horizontal scrolling for decisions or comparison tables.
- Preserve recording controls when device orientation changes.

## 9. Role Dashboard Guidance

### Customer dashboard

Organize by customer tasks:

- Needs your decision
- Active services
- Service videos ready
- Public-sharing requests
- Reviews
- Concerns and requests

Each card shows business, service, date, current state, who can view, and one next action.

### Vendor dashboard

Organize by workflow responsibility:

- Drafts
- Waiting for permission
- Ready to assign
- Active recording
- Manager review
- Waiting for customer
- Reliance review
- Private complete
- Public
- Needs attention

Each work-record card shows current step, assigned team member, recording location, service-video progress, privacy state, and one primary action. Tabs and counts must use the same classification logic as cards.

### Employee dashboard

Organize by:

- Ready to record
- Recording blocked
- In progress
- Correction requested
- Sent to manager
- Complete

Each card shows service, business, customer name only as operationally needed, date, location, approved scope summary, audio state, and next stage.

### Admin dashboard

Organize by:

- Ready for public review
- Missing permission
- Correction requested
- Privacy or identity concern
- Withdrawal and unpublishing
- Deletion and retention
- Appeals

Queue counts and cards must derive from the same current state. Admin pages must not expose one participant's private details to another participant.

## 10. Post-Implementation UX Validation Package

After implementation, the work is not complete until the implemented experience has been exercised as a first-time customer, vendor, employee, and admin.

Code completion and passing automated tests do not prove that the experience is understandable. The reviewer must critique the rendered product honestly and identify any page where a first-time user may not understand why they are there, what is happening, what to do, what happens after the choice, or what remains private.

The post-implementation validation package must contain the following seven deliverables.

### 1. Engineering report

The report must include:

- implementation scope;
- files and systems changed;
- workflow states implemented;
- data or migration effects;
- notification behavior;
- authorization and privacy checks;
- automated and manual tests run;
- test and build results;
- known technical limitations;
- rollback considerations; and
- confirmation that unrelated behavior was not intentionally changed.

### 2. Screenshot package

The package must include:

- every implemented screen and consequential state;
- desktop and mobile views;
- loading, empty, success, warning, failure, blocked, private, and public states where applicable;
- role-specific views for customer, vendor, employee, and admin;
- readable filenames mapped to the screen inventory in this specification; and
- before-and-after screenshots whenever a comparable prior screen exists and the comparison is practical.

Screenshots must use test data. They must not expose real customer data, credentials, access links, verification codes, private service videos, or other secrets.

Before-and-after comparisons must use the same viewport and comparable content whenever practical. The reviewer must explain what changed and whether the change improved comprehension, action clarity, privacy understanding, and confidence.

### 3. UX observations

The observations must evaluate the rendered experience rather than restating the specification.

For every screen, record:

- what a first-time user is likely to understand immediately;
- what may be overlooked or misunderstood;
- whether the Primary, Secondary, and Escape Actions are clear;
- whether the privacy state is visible;
- whether the page answers the six mandatory orientation questions;
- whether mobile layout changes comprehension;
- whether loading or dynamic content causes shifting, overlap, or stale state;
- whether wording matches the Reliance Language Guide; and
- a severity-ranked list of recommended corrections.

The reviewer must explicitly identify pages that are confusing, visually unbalanced, too dense, too vague, too technical, too easy to misread, or likely to create pressure. A technically correct page must not be described as successful when the experience remains unclear.

### 4. Customer journey summary

Document the tested customer path from notification through final disposition, including:

- opening the secure request;
- understanding the recording purpose;
- verification and authority confirmation;
- allow, decline, wrong-recipient, and no-response outcomes;
- private service-video delivery;
- exact-video public decision;
- optional review;
- withdrawal;
- dispute; and
- final privacy state.

Identify every point where the customer may feel confused, pressured, uncertain, or unable to understand what remains private.

### 5. Vendor journey summary

Document the tested vendor path through:

- work-record creation;
- location selection;
- recording-subject assessment;
- authority-holder identification;
- notification delivery and resend;
- employee assignment;
- blocked and active recording states;
- manager review;
- customer delivery;
- public proposal;
- correction;
- withdrawal or dispute; and
- final private or public state.

Identify every point where the vendor may not know the current step, responsible participant, next valid action, or reason for a block.

### 6. Employee journey summary

Document the tested employee path through:

- assignment receipt;
- approved-scope review;
- location confirmation;
- pre-recording certification;
- recording unlock or block;
- Starting Condition;
- Work in Progress;
- Final Result;
- preview, retake, and save;
- changed conditions or accidental capture;
- submission; and
- correction request.

Identify every point where the employee may be uncertain about what can be recorded, what must be avoided, whether audio is active, when to stop, or how to recover from an error.

### 7. Admin journey summary

Document the tested admin path through:

- moderation queue entry;
- exact-version identification;
- participant-permission review;
- audio, minor, bystander, redaction, caption, and fallback checks;
- approve, keep private, correct, reject, flag, and restrict outcomes;
- withdrawal and unpublishing;
- dispute review;
- deletion or retention status; and
- appeal history.

Identify every point where the admin lacks enough verified context to make or explain a fair decision.

### Validation method

The validation must include:

1. Automated workflow tests for state and authorization behavior.
2. Browser testing of the rendered experience.
3. Desktop and mobile screenshots.
4. Keyboard and screen-reader-oriented accessibility checks.
5. Visual inspection for overlap, clipping, low contrast, stale data, and layout shift.
6. A first-time-user review that does not rely on developer knowledge.
7. Cross-role verification that the same decision appears consistently in every affected dashboard and notification.

Any unresolved confusion must be reported. It must not be hidden because automated tests pass or because the intended workflow can be explained by the implementation team.

### Anticipated first-time-user risk areas

These are validation priorities, not findings about an implementation that does not yet exist.

| Screen | Likely source of confusion | Required validation focus |
|---|---|---|
| Recording subject assessment | The vendor may confuse the service location with what the camera will actually capture. | Confirm that short branching questions produce an understandable scope without requiring privacy expertise. |
| Authority holder selection | Contact ownership may be mistaken for authority over a person, home, business, or minor. | Confirm that role cards explain both authority and limits without feeling like a legal form. |
| Customer permission page | A first-time customer may think allowing recording also makes videos public. | Confirm that private-to-start and separate later public choice are understood before the decision controls appear. |
| Recording allowed page | The customer or employee may think the camera is immediately unlocked. | Confirm that remaining assignment, location, certification, and scope gates are visible without diminishing the confirmed permission result. |
| Recording blocked page | Many different gates can produce the same blocked outcome. | Confirm that every reason names the responsible next participant and never encourages an outside workaround. |
| Manager review page | The manager may mistake private delivery approval for public approval. | Confirm that the page repeatedly and clearly identifies the decision as private customer delivery. |
| Customer video and private video pages | Viewing, downloading, reviewing, and public sharing may appear to be one combined completion task. | Confirm that no action is required and each optional action has a separate consequence. |
| Public video approval page | Clip-by-clip choices, exact versions, other participant approvals, and Reliance review create cognitive load. | Confirm that the customer can keep everything private with one clear action and understand that selected videos remain private until the full process completes. |
| Withdrawal page | Stopping recording, removing public access, requesting deletion, and preserving decision history are different outcomes. | Confirm that one consequence is handled at a time and that immediate unpublishing is not confused with physical deletion. |
| Dispute page | Privacy, permission, identity, accuracy, and service-quality concerns have different immediate effects. | Confirm that category choices are understandable and that urgent privacy restriction is clear without causing unnecessary alarm. |
| Admin moderation page | Permission roles, exact versions, redactions, audio, people, captions, and provenance may overload one decision surface. | Confirm that missing authority is impossible to overlook and that the admin cannot approve before all exact-version context is loaded. |

## 11. UX Quality Checklist

This checklist is mandatory before any future Reliance screen, email, SMS, notification, tutorial, Help Center article, support response, or AI experience ships.

### First-time understanding

- [ ] Can a first-time user understand why this page exists without training?
- [ ] Does the page state what is happening now?
- [ ] Is the next action obvious within the first viewport?
- [ ] Does the page explain what happens if the user does nothing?
- [ ] Does the page explain what happens after the user decides?
- [ ] Does the page identify what stays private?
- [ ] Can the user distinguish the service, recording, public-sharing, and review decisions?

### Customer control

- [ ] Does a permission page educate before asking?
- [ ] Does it explain why recording is requested?
- [ ] Does it describe what may be recorded?
- [ ] Does it show whether audio is off or separately requested?
- [ ] Does it explain who can initially view the service videos?
- [ ] Does it explain what happens after an allow or decline decision?
- [ ] Is declining presented as a valid choice without pressure?
- [ ] Does the customer understand that Private is a complete outcome?
- [ ] Does the page avoid implying that silence is approval?
- [ ] Does the page avoid linking public sharing to service quality, ratings, reviews, or Trust Score?

### Vendor clarity

- [ ] Does the vendor see the current workflow step?
- [ ] Does the vendor see the responsible next participant?
- [ ] Is the next permitted action clear?
- [ ] Are delivery, permission, location, assignment, and review states distinguishable?
- [ ] Does the page prevent the vendor from acting for the customer or another authority holder?
- [ ] Does manager approval clearly mean private delivery rather than public approval?

### Employee safety and clarity

- [ ] Does the employee see the correct work record and assignment?
- [ ] Does the employee see the approved recording subject?
- [ ] Does the employee see what must not be recorded?
- [ ] Is audio state visible before and during recording?
- [ ] Are location and permission states confirmed before camera access?
- [ ] Are stop conditions visible and actionable?
- [ ] Can the employee report changed conditions or accidental capture without guessing?
- [ ] Does a blocked state explain the reason and recovery path?

### Admin fairness

- [ ] Can the admin identify every required authority holder?
- [ ] Is the exact proposed service-video version visible?
- [ ] Are audio, redactions, captions, labels, and visible-person risks clear?
- [ ] Are missing, withdrawn, and inapplicable permissions distinguishable?
- [ ] Can the admin narrow or block use without being invited to invent permission?
- [ ] Is the reason for the decision recordable in plain language?
- [ ] Can another reviewer understand the decision history later?

### Language and tone

- [ ] Does the screen match `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`?
- [ ] Does it call the recorded object a Service Video?
- [ ] Is Proof used only as the brand promise or approved `View Proof` action?
- [ ] Does it use Permission in ordinary product language instead of internal consent terminology?
- [ ] Does it avoid legal jargon, engineering terms, raw status values, and error codes?
- [ ] Does it sound calm, professional, trustworthy, modern, reassuring, and human?
- [ ] Does it avoid shame, urgency, threats, and promotional pressure?

### Visual and interaction quality

- [ ] Is there one clear Primary Action?
- [ ] Is the Secondary Action a valid alternative?
- [ ] Is an Escape Action available without making a decision?
- [ ] Are destructive actions specific and visually separated from the default?
- [ ] Are icons familiar, labeled, and supported by text?
- [ ] Do colors meet contrast requirements and avoid carrying meaning alone?
- [ ] Does the layout use progressive disclosure instead of long blocks of text?
- [ ] Are warnings visible before the consequential action?
- [ ] Are loading, success, failure, and empty states designed?
- [ ] Does dynamic content avoid layout shift and overlap?
- [ ] Does the mobile layout preserve privacy, status, and action clarity?

### State integrity

- [ ] Does the page show only confirmed success?
- [ ] Does a failure keep recording locked or access narrow when required?
- [ ] Does a loading state preserve the last confirmed privacy state?
- [ ] Does no response leave the current state unchanged?
- [ ] Do cards, tab counts, badges, emails, SMS, and dashboards use the same state?
- [ ] Does replacing or editing a video visibly end prior exact-video approval?
- [ ] Does withdrawal remove Reliance-controlled public access immediately where required?
- [ ] Does a deletion screen distinguish hidden, pending deletion, physically deleted, and restricted evidence states?

### Accessibility and trust

- [ ] Can the page be completed with a keyboard and screen reader?
- [ ] Are focus order, error association, and status announcements correct?
- [ ] Are tap targets at least 44 by 44 pixels?
- [ ] Does video avoid autoplay with sound?
- [ ] Does the page avoid collecting or exposing information the user does not need?
- [ ] Does the page reduce anxiety by explaining consequences and preserved state?
- [ ] Does the page increase trust by stating only verified behavior?

## 12. Final UX Standard

A Reliance experience is ready only when a first-time user can answer, without training:

- why the screen appeared;
- what the current status means;
- which action belongs to them;
- what happens if they wait or decline;
- what happens after they decide; and
- what remains private.

The customer is never pressured. The vendor always sees the next valid step. The employee always sees the approved recording boundaries. The admin always sees enough verified context to make a fair platform decision.

Private service videos remain a complete outcome. Public sharing remains a separate exact-video decision. Reviews remain optional. Failures never widen access. Reliance speaks plainly, shows only confirmed state, and makes the safer path the easiest path to understand.
