# Consent Flow Spec

## Scope
Active-path consent required before customer review/video access in smart review capture flow.

## Fully working
- Routes:
  - `POST /api/consent/request`
  - `POST /api/consent/accept`
  - `POST /api/consent/decline`
  - `GET /api/consent/[token]`
- Consent records are tied to:
  - `bookingId`
  - `vendorId`
  - `mediaSessionId`
  - `consentType`
- Acceptance records persist:
  - timestamp
  - IP address
  - user agent
  - terms version
  - privacy version
  - document hash
- Customer-facing consent page exists at:
  - `/consent/[token]`
  - displays vendor + booking/service summary
  - includes terms/privacy links
  - requires explicit checkbox acceptance
  - supports decline path
- Review/video access gate:
  - `POST /api/reviews/window/start` requires accepted `video_access` consent for booking/vendor/mediaSession.

## Partially working
- Vendor-side initiation UX is API-supported but not deeply integrated into all vendor flow screens.
- Optional SMS checkbox is captured client-side in consent UX, but downstream SMS dispatch is not wired in this pass.

## Documented only
- External legal document version registry and immutable legal document snapshot storage.
- Multi-token orchestrations for separate consent records by type in one guided wizard.

## Temporary assumptions
- Terms/privacy versions use current draft identifiers (`terms-draft-v1`, `privacy-draft-v1`) in current client flow.
- `video_access` consent type is used as the minimum gate for review/video access.

## Blockers
- Notification transport/scheduler for consent reminder nudges is not wired.
- Existing auth model remains mixed (JWT/cookie/dev headers); production-hardening of secure identity proofing is outside this pass.

## Exact next recommended tasks
1. Add vendor UI controls in active media session path to create/send consent requests directly from workflow.
2. Add optional resend/expire/revoke controls and customer-visible status timeline.
3. Add tests for token expiration handling and repeated accept/decline conflict behavior.
4. Add signed legal document snapshot storage source and strict version provenance.
