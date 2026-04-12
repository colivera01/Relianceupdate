# Notifications integration (Resend + Twilio)

**Date:** 2026-04-12

## Scope

Server-side email (Resend) and SMS (Twilio) for **consent links** and **review reminder / expiry** paths. Secrets are read only from environment variables (see `ENV_SETUP_NOTES.md`).

## Files added

| Path | Purpose |
|------|---------|
| `src/lib/env/notification-config.ts` | Read `RESEND_*`, `TWILIO_*`, `APP_BASE_URL`, `EMAIL_ENABLED`, `SMS_ENABLED`; one-time console warnings. |
| `src/lib/email/resend.ts` | `sendEmail()` via `https://api.resend.com/emails` with structured logging + `reply_to` from `EMAIL_REPLY_TO`. |
| `src/lib/sms/twilio.ts` | `sendSms()` via Twilio REST helper; maps trial / invalid-number style failures. |
| `src/lib/notifications/notification-audit.ts` | `logNotificationAttempt` → `admin_audit_logs` (`notification_attempt`, entityType `notification`). |
| `src/lib/notifications/send-consent-link.ts` | Consent URL email + SMS; always exposes absolute fallback link. |
| `src/lib/notifications/send-review-reminder.ts` | Review reminder (used synchronously; not a queue). |
| `src/lib/notifications/send-review-expired.ts` | Expiry notice after window close without submission. |
| `src/app/api/dev/notifications-test/route.ts` | Dev-only verification endpoint. |
| `src/instrumentation.ts` | Calls `logNotificationEnvWarnings()` on Node startup. |

## Files changed

| Path | Change |
|------|--------|
| `src/app/api/consent/request/route.ts` | Validates booking/vendor; loads user email/phone; sends notifications; returns `notification`, `manualLinkRequired`, `consentAbsoluteUrl`. |
| `src/lib/review-notifications.ts` | Loads booking user; calls reminder / expired orchestrators; documents `queued: false`. |
| `src/app/api/reviews/window/start/route.ts` | Returns `reminderDispatch` payload from `scheduleReviewReminder`. |
| `src/app/api/reviews/window/expire/route.ts` | Returns `expiryNotification` from `notifyReviewWindowClosedWithoutSubmission`. |
| `src/lib/admin-audit.ts` | Extended `entityType` union with `notification`. |
| `package.json` / lock | Added runtime dependency `twilio`. |

## Manual verification

1. Copy `.env.example` → `.env.local` and set all variables in `ENV_SETUP_NOTES.md`.
2. Set `NOTIFICATIONS_TEST_SECRET` for dev test route.
3. `POST /api/dev/notifications-test` with header `x-notifications-test-secret: <secret>` and JSON `{"email":"you@verified-domain","phone":"+1..."}`.
4. `POST /api/consent/request` with valid `bookingId` / `vendorId` / `mediaSessionId` / `consentType`; confirm response includes `consentAbsoluteUrl` and `manualLinkRequired` reflects delivery.
5. Check `admin_audit_logs` (or admin audit UI) for `notification_attempt` rows.

## Intentional limitations

- **No background scheduler:** Reminders run once at review window creation (best-effort). Delay parameter on `scheduleReviewReminder` is informational only.
- **APP_BASE_URL:** If unset, absolute links in templates may be path-only in some edge cases; `consentAbsoluteUrl` still prefers `APP_BASE_URL` when present.
- **Twilio trial:** Unverified destination numbers fail with explicit error codes in logs and channel results.

## Build / tests

- `npm run build` and `npm test` should remain green after integration.
