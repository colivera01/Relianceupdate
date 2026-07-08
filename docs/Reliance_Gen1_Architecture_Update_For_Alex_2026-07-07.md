# Reliance Gen-1 Architecture Update for Alex Tomic

Date: July 7, 2026  
Prepared for: Alex Tomic, X-Professionals  
Prepared by: Cesar Olivera, Reliance  
Purpose: Updated technical architecture package for resuming headset, PCB, and firmware work.

Suggested email subject: Reliance Gen-1 Architecture Update - Phone-First Platform and Headset Integration Direction

## 1. Access and Context Note

Alex does not have access to the Reliance website, Azure project, backend, database, or current source code. This document is written so the current project status can be understood directly without requiring Alex to inspect the live system.

This document supersedes the May 2026 Reliance Gen-1 architecture package where the product has changed or where implementation has moved ahead. The May package is still useful for the Gen-1 phone-bridged headset concept, but it should no longer be treated as the complete current state of the project.

## 2. Sources Reviewed

This update was prepared after reviewing:

- Historical Gmail communication between Cesar and Alex Tomic, including messages involving `alextomic@x-professionals.com`, `project-inquiries@x-professionals.com`, and relevant Cristina/X-Professionals follow-ups.
- The May 2026 Reliance Gen-1 architecture package sent to Alex and Cristina.
- Earlier hardware, firmware, PCB, DSP, Bluetooth, camera, button, buzzer, and server/device communication discussions from 2024 through 2026.
- Current Reliance product identity documents:
  - `RELIANCE_PRODUCT_IDENTITY.md`
  - `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- Current device and workflow documents:
  - `DEVICE_OPERATION_FLOW.md`
  - `DEVICE_MODES.md`
  - `DEVICE_EVENT_CONTRACT.md`
  - `DEVICE_API_REQUIREMENTS.md`
  - `DEVICE_PAIRING_FLOW_AUDIT.md`
  - `MEDIA_EXECUTION_FLOW_AUDIT.md`
  - `BOOKING_MEDIA_REVIEW_FLOW_MAP.md`
  - `CONSENT_FLOW_SPEC.md`
  - `REVIEW_AUDIT_FLOW.md`
  - `SMART_REVIEW_CAPTURE_PLAN.md`
- Current codebase areas covering backend APIs, frontend workflows, Prisma models, media upload, employee recording, vendor jobs, customer proof, admin moderation, reviews, Trust Score, geolocation, notifications, AI hooks, and device telemetry.

## 3. Executive Summary

Reliance has evolved since the previous architecture package.

The current direction is:

**Phone First.**

The phone is currently the primary recording platform. The employee uses a mobile browser to open a secure service order link, record the three stage videos, preview each clip, save the clips to the project, and submit the completed stage package to the manager.

The headset is still part of the Reliance Gen-1 ecosystem, but it is now planned as an expansion of the current phone-first workflow rather than the required recording device for the first beta workflow.

The important architectural rule remains:

**Gen-1 headset should integrate through the phone.**

The headset should not require a major redesign of the existing platform. It should feed media, commands, and device telemetry into the same job, upload, moderation, proof, review, and Trust Score pipeline that already exists for phone recording.

## 4. Product Identity

Reliance is not a marketplace.

Reliance is a proof-of-service platform.

The platform is designed to let customers compare service providers using:

- Completed work evidence.
- Approved staged service videos.
- Customer reviews tied to real service activity.
- A Reliance Trust Score based on verified operational signals.

Reliance should not be understood as a scheduling marketplace, payment platform, generic lead marketplace, or social video platform. The technical system is built around proof, transparency, service records, media moderation, review eligibility, and operational accountability.

## 5. What Changed Since the May Architecture Package

### Still Accurate

The May architecture package remains accurate on these points:

- The Gen-1 headset should be phone-bridged.
- The phone remains the authenticated client.
- The headset should not directly own cloud credentials.
- The headset should not receive direct Azure Blob credentials independently.
- The platform uses staged service recording:
  - Starting Condition.
  - Work in Progress.
  - Final Result.
- Device states, pairing, heartbeat, upload, retry, LED, buzzer, battery, and firmware reporting remain important.
- BLE protocol details, command vocabulary, reconnect behavior, media transfer, and firmware/device sync still need final hardware and firmware definition.

### Changed

The biggest change is that the live software has moved to a phone-first recording model.

Today:

- The employee records with a phone.
- The phone browser provides the camera UI.
- The phone handles login/session or secure capture-token access.
- The phone handles location and permission prompts.
- The phone handles preview, retake, confirm, and upload.
- The phone uploads media to cloud storage through the existing upload pipeline.
- The headset is no longer required for the first beta proof-of-service lifecycle.

This means headset development can be scoped more cleanly. The headset should act as a capture accessory and control surface for the phone-first workflow, not as a standalone cloud device.

### Already Implemented Since May

The current codebase now includes:

- Device, device event, device assignment, pairing code, and media session data models.
- Device event ingestion API.
- Phone device pairing support for employees.
- Headset pairing and assignment APIs for future use.
- Employee invite and employee job access flows.
- Phone-based staged recording flow.
- Media session creation.
- Azure Blob upload initialization and completion.
- Media duration and storage checks.
- Manager approval and rejection flow.
- Admin media moderation.
- Customer proof access.
- Customer review window and quick email-star review flow.
- Admin review moderation.
- Trust Score calculation using verified operational outcomes.
- Vendor, customer, employee, and admin dashboards.
- Business hours, geocoding, distance, current-location, and open-now concepts.
- Public proof filtering rules so incomplete work should not become public proof.

### No Longer Safe to Assume

These assumptions from earlier phases should be removed or reduced:

- The headset is the only or primary recorder for Gen-1 beta.
- The headset needs to communicate directly with the Reliance cloud.
- The headset needs its own long-lived cloud credential.
- The headset needs direct Azure upload authorization.
- The headset should store customer information.
- Voice commands are in scope for the first headset version.
- Public proof can be shown before three staged videos are completed, approved, and made public.

## 6. Current Reliance Platform Overview

The current Reliance platform is a web application with role-based workflows.

Main roles:

- Customer.
- Vendor owner or manager.
- Employee.
- Administrator.

Main platform areas:

- Public homepage.
- Browse or Explore Proof.
- Public vendor profile.
- Customer account and dashboard.
- Vendor dashboard.
- Vendor services offered.
- Vendor jobs and work records.
- Employee job recording link.
- Admin moderation dashboard.
- Admin notifications and audit logs.

Current backend concepts:

- Users and vendors are persisted in the database through Prisma models.
- Work records and bookings represent customer service activity.
- Media sessions group service videos.
- Media assets represent uploaded stage clips.
- Device records represent phones and future headsets.
- Device events store telemetry and operational events.
- Vendor memberships connect users to vendor teams as managers or employees.
- Review windows control when customers can leave feedback.
- Reviews are moderated before becoming public.
- Trust Score snapshots are calculated from verified operational outcomes, not directly from star reviews.

Current cloud/media concept:

- The phone or web client requests an upload session.
- The backend creates an upload intent.
- The client uploads video to cloud storage.
- The backend confirms the uploaded media exists, validates it, and links it to the job stage.
- The asset stays private and pending until later review and moderation steps complete.

## 7. Updated Gen-1 Operation Flow

### 7.1 Login and Account Access

Users sign into Reliance through the web platform.

The platform supports:

- Email and password login.
- Email verification.
- Sign-in codes for protected account access.
- Trusted device memory.
- Passkey support.
- Role-based routing after login.

The same signed-in user may have more than one role, for example customer and vendor manager. The app can expose role switching without requiring separate accounts.

### 7.2 Vendor Profile Setup

A vendor creates a profile with business identity information, service category, service offerings, service area, business hours, and customer-facing information.

Vendor profile data supports:

- Public vendor profile.
- Browse and proof cards.
- Service work record creation.
- Geolocation and distance display.
- Open-now status.
- Customer-facing service descriptions.

Vendor onboarding may require admin approval before the vendor is fully public.

### 7.3 Customer Registration and Browse

A customer can create an account, browse vendors, view public proof, and interact with vendor profiles.

Public browse is proof-first. The system should prioritize:

- Approved public videos.
- Completed service records.
- Reviews tied to real service activity.
- Trust Score context.
- Location and distance where available.
- Open-now status where business hours are available.

Incomplete or unapproved work should not be shown as public proof.

### 7.4 Booking or Work Record Creation

There are two main ways a service record can enter the system:

1. Customer-initiated service activity.
2. Vendor-created manual work record for scheduled, beta, demo, or externally scheduled work.

The work record becomes the anchor for:

- Customer identity.
- Vendor identity.
- Service type.
- Employee assignment.
- Customer consent where required.
- Stage videos.
- Manager review.
- Admin moderation.
- Customer proof access.
- Review eligibility.
- Trust Score and analytics signals.

### 7.5 Employee Invite and Assignment

A vendor manager can invite an employee to the vendor team.

The employee invite creates or connects an employee membership to the vendor. The employee does not need to become a vendor manager or register as a full business owner to record assigned service work.

The manager can assign a work record to an available employee.

The employee receives a service order link by email. SMS is planned once carrier approval is complete.

### 7.6 Current Phone Recording Workflow

This is the live Gen-1 beta recording workflow today.

The employee:

1. Opens the secure service order link on a phone.
2. The platform checks employee access or capture-token access.
3. The employee sees the assigned job and the three stage cards:
   - Starting Condition.
   - Work in Progress.
   - Final Result.
4. The employee taps a stage card.
5. The phone asks for location, camera, and microphone permission when required.
6. The full-screen camera opens.
7. The employee frames the shot first.
8. The employee taps Start Recording.
9. The 30-second countdown starts.
10. The employee taps Stop and Preview, or the recording stops automatically at the limit.
11. The preview opens.
12. The employee taps Confirm and Save, or Retake.
13. The confirmed stage uploads into the Reliance project.
14. The employee repeats the process for the remaining stages.
15. After all three stages are confirmed, the employee submits the videos to the manager.

The current phone workflow intentionally avoids gallery upload. The intended behavior is live phone recording, preview, retake, confirm, and upload. The video should be stored in the project, not saved to the employee phone gallery as a normal user-facing file.

### 7.7 Upload and Stage Completion

The current upload flow is:

1. Create media session for the job and stage.
2. Request upload initialization from the backend.
3. Upload the video to cloud storage.
4. Confirm upload completion with the backend.
5. Backend verifies blob existence and metadata.
6. Backend creates or updates the media asset.
7. Backend links the media asset to the correct stage.
8. When all three stages are present, the job package becomes ready for manager review.

Current media rules include:

- Three required stages.
- Stage clips are short public proof clips, currently capped at 30 seconds.
- Uploaded media is initially private.
- Uploaded media starts in pending review.
- Incomplete packages should not become public proof.

### 7.8 Manager Review

After all three stages are uploaded, the vendor manager reviews the completed service video package.

The manager can:

- Approve the package and send it forward.
- Reject it and return it for correction.

Manager approval does not automatically make the package public. It sends the package into the next moderation step.

### 7.9 Admin Media Moderation

Admin moderation is required before videos become available to customers or public proof areas.

The admin can:

- Approve the package.
- Reject the package.
- Flag the package for additional review.

Admin approval can make the service video package available to the customer. Depending on visibility rules, it may also become public proof if the service record is approved for public display.

### 7.10 Customer Proof Delivery

After admin approval, the customer receives a service video ready notification.

The customer can open the service record and watch:

- Starting Condition.
- Work in Progress.
- Final Result.

Customer access is controlled by the service record and account or secure link context. The customer should only see approved media that belongs to that customer or is intentionally public.

### 7.11 Customer Review

After eligible service activity, the customer can leave a review.

The current direction is:

- A customer may use a normal review page or a quick email-star review link.
- A quick star rating should create a pending review without requiring the customer to log in again when the review token is valid.
- The customer should only be allowed to leave one review per eligible service record.
- The review remains pending until admin moderation.
- Vendor review metrics should update after admin approval.

### 7.12 Trust Score

Reliance Trust Score is separate from customer star rating.

The Trust Score is calculated from verified operational signals, including:

- Verified workflow completion.
- Video verification success.
- Dispute-free completion.
- Operational reliability.

The Trust Score does not simply average customer reviews. This separation is important to the Reliance product identity.

### 7.13 Analytics

The platform tracks metrics across:

- Vendor dashboard.
- Admin dashboard.
- Customer dashboard.
- Employee activity.
- Media package lifecycle.
- Review moderation.
- Trust Score snapshots.
- Public proof visibility.
- Audit logs.

Hardware and firmware telemetry should eventually feed into this same operational record, but telemetry should not replace the existing proof, moderation, review, or Trust Score logic.

## 8. Where the Headset Fits Now

The future headset should plug into the current workflow at the recording layer.

Current phone-only path:

Employee phone -> camera recording -> preview -> upload -> manager review -> admin moderation -> customer proof -> review -> Trust Score

Future headset-assisted path:

Headset -> phone BLE bridge -> phone upload pipeline -> manager review -> admin moderation -> customer proof -> review -> Trust Score

The headset should not redesign the backend workflow.

The phone remains responsible for:

- User authentication.
- Employee/vendor membership validation.
- Job assignment context.
- Consent and location gates.
- Customer data access.
- Upload authorization.
- Retry handling.
- Media upload confirmation.
- Syncing status with the Reliance backend.

The headset should be responsible for:

- Capture control.
- Camera/microphone recording.
- Optional flashlight.
- Local state.
- Buttons.
- LED/buzzer feedback.
- Battery reporting.
- Temporary media buffering.
- BLE communication with the phone.
- Device telemetry events passed through the phone.

## 9. Updated State Machine

### 9.1 Current Software States

#### Account states

| State | Meaning |
|---|---|
| Unauthenticated | User has not signed in. |
| Registered, unverified | Account exists but email is not verified. |
| Authenticated | User has a valid session. |
| MFA/sign-in-code pending | User must enter a code before protected access. |
| Trusted device | Device may skip repeated sign-in codes for the configured period. |
| Suspended or disabled | Account access is blocked. |

#### Vendor states

| State | Meaning |
|---|---|
| Draft/onboarding | Vendor profile is being created. |
| Submitted | Vendor profile was submitted. |
| Pending admin approval | Vendor cannot be treated as fully public yet. |
| Active/approved | Vendor can operate normally. |
| Rejected or needs correction | Vendor must correct profile or compliance issues. |
| Suspended/deactivated | Vendor access is restricted. |

#### Job and work record states

| State | Meaning |
|---|---|
| Draft/manual record | Work record is being created. |
| Pending or scheduled | Work exists but is not started. |
| Assigned | Work is assigned to an employee. |
| In progress | Employee recording or service work has started. |
| Stage media partial | One or two required videos are saved. |
| Awaiting manager review | Three stages are uploaded and waiting for manager review. |
| Manager rejected | Employee must correct one or more stages. |
| Manager approved | Package moves to admin moderation. |
| Admin pending | Package is waiting for admin moderation. |
| Admin rejected/flagged | Package is blocked or requires review. |
| Customer visible | Approved package is available to the customer. |
| Public proof | Approved package is available in public proof areas. |
| Closed/completed | Service workflow has completed. |

#### Employee phone capture states

| State | Meaning |
|---|---|
| Link opened | Employee opened service order link. |
| Checking access | Platform validates session or capture token. |
| Job loaded | Assigned job is visible. |
| Stage idle | Stage card is ready to record or edit. |
| Permission required | Camera, microphone, or location permission is needed. |
| Camera ready | Full-screen camera is open but recording has not started. |
| Recording | 30-second recording timer is active. |
| Preview | Employee reviews the clip. |
| Saving/uploading | Clip is being saved to the project. |
| Stage saved | Stage has a confirmed video. |
| Retake/edit | Employee can replace a saved stage before final submission. |
| All stages saved | Three stages are confirmed. |
| Submitted to manager | Employee has submitted the full package. |

#### Review states

| State | Meaning |
|---|---|
| No review window | Customer is not currently eligible to review. |
| Review window active | Customer may submit review. |
| Review submitted | Review exists but is not public yet. |
| Pending moderation | Admin must approve/reject. |
| Approved | Review can affect vendor review metrics. |
| Rejected/private | Review does not become public. |
| Closed/expired | Customer cannot submit another review for that record. |

### 9.2 Future Headset States

| State | Meaning |
|---|---|
| Power Off | Headset is off. |
| Booting | Firmware is starting. |
| Pairing | Headset advertises for phone pairing. |
| Connected | Headset is connected to phone over BLE. |
| Assigned Job Ready | Phone has armed headset with active job/stage context. |
| Recording | Headset is capturing audio/video. |
| Transfer to Phone | Headset is sending media or chunks to phone. |
| Uploading via Phone | Phone is uploading headset media through Reliance pipeline. |
| Upload Failed | Upload or transfer failed and retry is required. |
| Offline/Reconnecting | BLE link is lost and reconnect logic is active. |
| Low Battery | Battery is below configured threshold. |
| Charging | Device is connected to power. |
| Error | Firmware detected a recoverable or fatal error. |
| Firmware Update | Phone is transferring and applying a firmware update. |

## 10. Implementation Status

| Area | Status | Notes |
|---|---|---|
| Product identity | Completed | Reliance is defined as proof-of-service, not marketplace. |
| Customer registration/login | Completed, beta polish ongoing | Includes email verification, sign-in codes, trusted device memory, and passkey support. |
| Vendor registration/profile | Completed, beta polish ongoing | Vendor profile, service area, services, business hours, and approval workflow exist. |
| Employee invite/membership | Completed | Vendor can invite employees and connect them to assigned work. |
| Vendor services offered | Completed, beta polish ongoing | Service menu items support work record creation; UI is still being refined. |
| Vendor jobs/work records | Completed, beta polish ongoing | Used to create service records, assign employees, and track staged video progress. |
| Phone-first employee recording | Completed, beta polish ongoing | Three-stage phone capture, preview, retake, confirm, upload, and manager submission. |
| Gallery upload | Removed from intended employee flow | Current direction is live camera recording. |
| Flashlight support | In progress/beta dependent | Browser torch support varies. Fallback uses phone camera behavior when browser does not expose torch. |
| Media upload pipeline | Completed | Media sessions, upload init, Azure Blob upload, upload complete, MediaAsset records. |
| Manager review | Completed | Manager can approve or reject completed packages. |
| Admin media moderation | Completed | Admin approves, rejects, or flags media packages. |
| Customer proof access | Completed | Customer can view approved service videos. |
| Review lifecycle | Completed, beta polish ongoing | Review windows, quick email-star review, admin moderation, one-review-per-record behavior. |
| Trust Score | Completed for current formula | Trust Score uses verified operational outcomes, separate from star reviews. |
| Public proof filtering | Completed, ongoing QA | Public proof should only show completed, approved, public packages. |
| Business hours | Completed, beta polish ongoing | Vendor hours support open-now display. |
| Geocoding/distance | Completed, beta polish ongoing | Vendor/customer location and current-location behavior exist. |
| Admin notifications | Completed, beta polish ongoing | Email notifications exist; SMS pending carrier approval. |
| AI integrations | Built, rollout dependent | AI features exist in code but may depend on environment configuration and feature enablement. |
| Device models/APIs | Completed foundational layer | Device, DeviceEvent, DeviceAssignment, pairing code, headset assignment/status APIs exist. |
| BLE headset bridge | Planned | Not yet active in the live phone-first workflow. |
| Headset firmware | Future hardware/firmware work | Requires Alex/X-Professionals definition and implementation. |
| PCB update | Future hardware work | Buttons, LED, buzzer, DSP, camera/flash, power, and debug interfaces need final design. |
| OTA firmware update | Future cloud/firmware work | Needs signed image/update strategy and phone bridge. |

## 11. Hardware Assumptions

### Still Valid

The following hardware assumptions from earlier discussions remain valid:

- A headset accessory is still part of the Reliance roadmap.
- The headset should include camera and microphone capture.
- Flashlight or illumination remains useful for service recording.
- Physical buttons are still important for usability.
- A recording indicator LED is still recommended.
- A buzzer is still useful for feedback, low battery, pairing, and lost-device location.
- DSP/audio processor selection still needs final resolution.
- PCB needs to be updated from earlier designs to include missing controls and final components.
- Functional testing on real assembled PCB remains necessary.
- Camera, low-light, audio, DSP, Wi-Fi/Bluetooth, latency, and battery behavior still require measured tests.

### Changed Because of Phone-First Direction

The phone-first platform changes the headset assumptions:

- The headset is not required to launch the first beta workflow.
- The headset is not the authentication device.
- The headset is not the source of customer identity or vendor permissions.
- The headset should not directly upload to Azure Blob in Gen-1.
- The headset should not hold long-lived cloud tokens.
- The headset should not store customer PII beyond minimal in-flight references.
- The phone owns consent, location, user session, upload authorization, retry, and backend sync.
- The headset should be designed as a phone-controlled recording accessory.

### No Longer Assumed

- Direct headset-to-cloud communication.
- Headset Wi-Fi as the primary architecture requirement.
- Voice commands in the first hardware release.
- Headset long-term media storage.
- Headset ownership of Trust Score, reviews, moderation, or customer proof delivery.

## 12. Firmware Expectations

The future firmware should support the phone-first Gen-1 model.

### 12.1 Pairing

Firmware should:

- Advertise over BLE.
- Expose stable `deviceUid`.
- Expose firmware version, model, hardware revision, and serial number.
- Support BLE bonding or equivalent secure pairing.
- Allow the phone to bind the headset to a Reliance vendor membership.
- Support reconnect after link loss.

### 12.2 Authentication

In Gen-1, firmware should not authenticate directly with Reliance cloud services.

The phone is the authenticated client.

The headset identity should be:

- `deviceUid`.
- Vendor assignment stored server-side.
- Membership assignment stored server-side.
- Pairing verified by the phone and backend.

The headset should not store:

- User passwords.
- Customer account data.
- Azure SAS URLs as persistent secrets.
- Long-lived API tokens.

### 12.3 Commands

Expected phone-to-headset command types:

- `ARM_JOB`
- `DISARM_JOB`
- `RECORD_START`
- `RECORD_STOP`
- `FLASH_SET`
- `FLASH_TOGGLE`
- `STATUS_REQUEST`
- `FIND_DEVICE`
- `BUZZ`
- `SOFT_RESET`
- `FACTORY_RESET` with protected confirmation
- `FW_UPDATE_PREPARE`
- `FW_UPDATE_CHUNK`
- `FW_UPDATE_APPLY`

### 12.4 Recording

Firmware should support:

- Active job/stage context sent by phone.
- Start and stop recording.
- Auto-stop at configured duration limit.
- Default 30-second stage clip cap.
- Stop reason reporting:
  - user stopped.
  - timer expired.
  - battery low.
  - storage full.
  - error.
  - BLE disconnected.
- Re-recording a stage before final package submission.
- Temporary media buffering until phone transfer completes.

Preview can remain phone-side. The headset does not need to render a preview if the phone can display the transferred clip.

### 12.5 LED Behavior

Suggested LED states:

- Pairing: blue blink.
- Connected: blue solid or short pulse.
- Ready: white or green pulse.
- Recording: red solid or red blink.
- Transfer/upload in progress: blue/white alternating.
- Transfer/upload failed: yellow blink.
- Low battery: red slow blink.
- Firmware update: purple or blue fast blink.
- Error: red fast blink.

### 12.6 Buzzer Behavior

Suggested buzzer feedback:

- Pairing success.
- Pairing failure.
- Recording started.
- Recording stopped.
- Low battery warning.
- Upload or transfer failure.
- Lost-device locator.
- Critical error.

Buzzer should be configurable or suppressible through the phone app where possible.

### 12.7 Telemetry

Firmware should report:

- boot.
- paired.
- heartbeat.
- job armed.
- recording started.
- recording stopped.
- transfer started.
- transfer progress.
- transfer completed.
- transfer failed.
- battery low.
- offline/disconnected.
- reconnected.
- error.
- firmware version reported.

The phone should forward these events to the Reliance device event API.

### 12.8 Battery and Charging

Firmware should report:

- Battery percentage.
- Charging state.
- Low battery threshold.
- Critical battery threshold.
- Optional battery temperature.
- Optional estimated remaining recording time.

Battery behavior should prevent starting a recording if the device cannot safely complete a short stage clip.

### 12.9 Reconnect and Retry

Firmware should:

- Detect BLE disconnect.
- Attempt reconnect.
- Persist enough metadata to resume or safely fail transfer.
- Use idempotent event IDs so duplicate events do not corrupt the backend.
- Avoid losing a completed recording before phone transfer completes, within the hardware storage limits.

### 12.10 Firmware Updates

Firmware update strategy should eventually include:

- Phone-bridged firmware transfer.
- Signed firmware images.
- Version verification.
- Progress reporting.
- Failure recovery.
- Rollback or safe recovery mode if supported by hardware.

## 13. BLE Communication Draft

The BLE layer is not final. This draft is enough to begin technical discussion.

### 13.1 Proposed Services and Characteristics

| BLE Item | Direction | Purpose |
|---|---|---|
| Reliance Device Info Characteristic | Read | `deviceUid`, firmware version, model, serial, capabilities. |
| Reliance Status Characteristic | Read/Notify | mode, battery, charging, active stage, storage, error code, RSSI. |
| Reliance Command Characteristic | Write With Response | phone sends commands to headset. |
| Reliance Event Characteristic | Notify | headset sends event notifications to phone. |
| Reliance Media Transfer Characteristic | Notify/Indicate or Write/Notify | headset transfers media chunks to phone. |
| Reliance Firmware Update Characteristic | Write/Notify | phone transfers firmware chunks and receives progress. |

Service UUIDs and characteristic UUIDs still need to be assigned.

### 13.2 Command Envelope

```json
{
  "commandId": "cmd_20260707_0001",
  "type": "RECORD_START",
  "issuedAt": "2026-07-07T00:00:00.000Z",
  "context": {
    "vendorId": "vendor_id",
    "bookingId": "booking_id",
    "stage": "INTRO",
    "durationLimitSeconds": 30
  }
}
```

### 13.3 Event Envelope

```json
{
  "eventId": "evt_20260707_0001",
  "eventType": "recording_started",
  "occurredAt": "2026-07-07T00:00:05.000Z",
  "deviceUid": "headset_device_uid",
  "deviceType": "HEADSET",
  "context": {
    "bookingId": "booking_id",
    "stage": "INTRO"
  },
  "payload": {
    "batteryPercent": 78
  }
}
```

### 13.4 Media Transfer Frame

The exact binary layout still needs Alex's input. A practical media frame likely needs:

- Transfer ID.
- Booking/job context ID.
- Stage.
- Chunk index.
- Total chunks or unknown-stream flag.
- Byte length.
- CRC/checksum.
- Final chunk flag.
- Payload bytes.

### 13.5 Critical BLE Question

The main unresolved BLE question is whether BLE is practical for video transfer at the required quality.

If BLE throughput is too low for 30-second video clips, possible alternatives include:

- Headset records locally and transfers slowly after recording.
- BLE remains command/control only, while Wi-Fi Direct or local Wi-Fi handles media transfer.
- USB-C or wired transfer for service/testing scenarios.
- A lower bitrate/resolution headset profile specifically designed for proof clips.

This decision materially affects firmware, hardware, storage, battery, and user experience.

## 14. Questions for Alex

These are the technical questions that still materially affect hardware and firmware development.

1. Can BLE support the target video transfer for 30-second stage clips at acceptable resolution, frame rate, codec, and bitrate?
2. Should the headset stream live to the phone or record locally and transfer after the stage is stopped?
3. How much local storage should the headset include for temporary recording and retry?
4. Should Wi-Fi or Wi-Fi Direct be included only for media transfer while BLE handles command/control?
5. Which DSP/audio processor should replace the earlier sound processor, and what measurable noise cancellation and latency targets should be used?
6. What camera module should be selected for final PCB work, including resolution, frame rate, field of view, low-light behavior, auto-exposure, focus, and flashlight support?
7. What flashlight or illumination current, thermal, and battery impact should be expected?
8. Please confirm the physical controls to add to PCB: power, record, flashlight/action, volume if needed, reset/service button if needed.
9. Please confirm LED placement and behavior for recording visibility.
10. Please confirm whether an audible buzzer is feasible and where it should be placed.
11. What battery size, charging method, charging current, expected runtime, and safe operating temperature should be targeted?
12. What debug, programming, test pads, and factory test interfaces should be included on the PCB?
13. What BLE security model, MTU, bonding behavior, reconnect behavior, and transfer strategy do you recommend?
14. Can the selected firmware platform support signed firmware updates and rollback? If not, what safer update strategy is realistic?
15. Which parts of the current dev-kit work remain reusable, and which parts should be redesigned because the platform is now phone-first?
16. What certification or regulatory issues should be expected from the selected wireless modules, battery, charging circuit, camera, and final PCB?

## 15. Previous Architecture Package Comparison

| Topic | May 2026 Package | Current July 2026 Direction |
|---|---|---|
| Primary recording device | Headset-focused Gen-1 concept | Phone-first beta workflow is primary today. |
| Headset role | Capture device through phone | Future capture accessory integrated into existing phone workflow. |
| Cloud communication | Phone bridge recommended | Phone bridge remains required for Gen-1. |
| Device event endpoint | Future priority | Foundational device event API and models now exist. |
| Media upload | Phone buffers/uploads | Implemented for phone recording through media sessions and cloud upload. |
| Stage duration | Earlier discussions included longer limits | Current public stage proof clips are 30 seconds each. |
| Reviews | Downstream concept | Review lifecycle, quick email-star review, and admin moderation now exist. |
| Trust Score | Strategic concept | Current calculator uses verified operational outcomes and snapshots. |
| Public proof | Strategic concept | Public proof filtering now exists and must exclude incomplete/unapproved work. |
| BLE protocol | Needed definition | Still needs final firmware/hardware definition. |
| Buttons/LED/buzzer | Recommended/missing on PCB | Still needed for headset hardware. |
| Voice commands | Future possibility | Still out of scope for first release. |
| DSP selection | Needed replacement/selection | Still unresolved hardware decision. |

## 16. What Alex Should Focus On Next

The Reliance software platform now has a live phone-first service proof lifecycle. Alex should not redesign the cloud workflow around the headset.

The next hardware and firmware work should focus on:

1. Finalizing whether BLE alone can handle media transfer.
2. Defining the phone-to-headset BLE service and characteristic structure.
3. Confirming the camera, microphone, DSP, flash, battery, and PCB component choices.
4. Updating PCB for buttons, LED, buzzer, debug/programming, charging, and final modules.
5. Building firmware around a phone-controlled capture accessory model.
6. Supporting job/stage commands, recording, temporary storage, transfer, telemetry, reconnect, and firmware updates.
7. Producing testable hardware behavior that can be fed into the already-existing Reliance phone upload and proof workflow.

## 17. Final Architecture Position

The current Gen-1 Reliance architecture is:

```text
Current beta:

Employee Phone
  -> Reliance Web App
  -> Phone Camera Recording
  -> Preview and Retake
  -> Cloud Media Upload
  -> Manager Review
  -> Admin Moderation
  -> Customer Proof
  -> Customer Review
  -> Trust Score and Analytics
```

```text
Future headset expansion:

Reliance Headset
  -> BLE Phone Bridge
  -> Reliance Web/App Session
  -> Same Cloud Media Upload Pipeline
  -> Same Manager Review
  -> Same Admin Moderation
  -> Same Customer Proof
  -> Same Review and Trust Score Systems
```

The headset should expand Reliance's capture capabilities without replacing the phone-first architecture that now exists.

## 18. Closing Note for Alex

The most important update is that Reliance now has a working software direction centered on phone-first proof-of-service recording. The headset remains valuable, but its Gen-1 role is narrower and clearer than before: it should become a reliable, phone-paired recording accessory that feeds the existing Reliance workflow.

The hardware work should therefore concentrate on capture quality, physical usability, firmware reliability, BLE or media transfer feasibility, device telemetry, battery behavior, and PCB completeness. The Reliance platform will continue to handle authentication, customer/vendor records, service jobs, uploads, moderation, reviews, Trust Score, and proof delivery.
