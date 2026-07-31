# Consent, Recording, SMS, and Email Template Snapshot

- Original repository paths:
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-consent-link.ts`, lines 54-200
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-consent-decision.ts`, lines 21-174
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-job-assignment.ts`, full file
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-video-ready.ts`, lines 40-181
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-video-package-approved.ts`, lines 45-134
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-review-reminder.ts`, lines 67-195
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-review-expired.ts`, lines 44-126
- Snapshot type: Carefully labeled template excerpts
- Production data included: No

## Consent request

Email subject pattern:

> Review your service video request from [vendor]

The message says the provider can continue the service-video workflow if approved and that the customer can review the videos afterward. SMS includes the service/vendor, consent link, and `Reply STOP to opt out`.

## Employee service order

The assignment notification sends the assigned employee a signed capture link by available email/SMS channels. The link is bound to vendor, work record, and employee membership and expires.

## Video ready

Email subject pattern:

> Your service video from [vendor] is ready

The message directs the customer to Starting Condition, Work in Progress, and Final Result clips. SMS includes the video link and STOP language.

## Review window

The reminder message says the feedback window is open and links the customer to watch the service video and submit a review. The closure notice says the window ended without a submitted review. No template states that a review will be automatically created.

## Transport and audit behavior

Email is sent through Resend. SMS supports Twilio or Telnyx based on configuration. Delivery attempts record channel, success/failure, provider message ID, and error information in notification/audit records. The repository does not prove the live provider account configuration, carrier approval, or actual message delivery.
