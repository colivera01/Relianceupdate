---
content_key: reliance.transactional-sms-notice
content_class: POLICY
audience_role: ALL_USERS
version: reliance-transactional-sms-2026-10-12-draft.2
supersedes_version: reliance-transactional-sms-2026-10-12-draft.1
governance_status: DRAFT
review_state: PRODUCT_OWNER_REVIEW
runtime_effective: false
counsel_approved: false
language: en-US
---
# DRAFT / PRODUCT OWNER REVIEW

> Not effective. Not counsel-approved. SMS activation is not authorized. The controlled Employee OTP channel remains email-only while SMS readiness is disabled.

## PROSPECTIVE USER-FACING COPY
<!-- BEGIN PROSPECTIVE USER-FACING COPY -->
# Reliance Transactional SMS Notice

If you separately choose an available text-message option, Reliance Technologies LLC may send transactional messages about actions or records associated with your Reliance relationship. Examples include a verification code, Service Order delivery or status, account security, appointment or workflow notice, support response, or another message needed to complete a request you initiated.

Reliance does not use this consent for marketing or promotional texts. Consent to transactional SMS is optional and is not a condition of purchasing services, opening an account, accepting an assignment, or using an available email alternative.

## Opt in

**Checkbox:** I agree to receive automated transactional text messages from Reliance at the mobile number shown for verification, security, Service Order, support, and workflow notices. Message frequency varies. Message and data rates may apply. Consent is optional. Reply STOP to stop and HELP for help.

**Button:** Enable Text Messages

## Confirmation

Reliance transactional text messages are enabled for the verified number ending in the digits shown. Message frequency varies. Message and data rates may apply. Reply STOP to stop and HELP for help. Email or another available channel remains available where the product supports it.

## STOP response

You have opted out of Reliance transactional text messages to this number. No additional texts will be sent except a confirmation or messages permitted by law. Use email or contact colivera080124@gmail.com for help.

## HELP response

Reliance transactional message help: visit the Reliance support surface or email colivera080124@gmail.com. Message and data rates may apply. Reply STOP to stop.

## Delivery and security

Carriers and messaging providers are not controlled by Reliance, and delivery is not guaranteed. Do not send passwords, signed links, or other credentials by text.
<!-- END PROSPECTIVE USER-FACING COPY -->

## INTERNAL ACTIVATION NOTES - NOT USER-FACING
<!-- BEGIN INTERNAL ACTIVATION NOTES -->
- Offer SMS only when the number is verified and the provider/channel is operational and deliverable. A stored phone number alone is insufficient.
- Preserve opt-in content/version, verified number reference, timestamp, source, opt-out state, and delivery metadata; never store a raw OTP as consent evidence.
- Require Product Owner and counsel review, carrier registration, confirmed provider readiness, automated STOP/HELP handling, suppression, confirmation, email fallback, and monitoring.
- Keep the program transactional only and never make SMS a mandatory gate.
- Environment capability controls must hide unavailable channels. Employee decision SMS remains disabled.
- This internal section is excluded from the accepted text snapshot. No SMS feature is activated by this draft.
<!-- END INTERNAL ACTIVATION NOTES -->
