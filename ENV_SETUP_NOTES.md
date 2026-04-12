# Environment setup — notifications (Resend + Twilio)

Do **not** commit real secrets. Use `.env.local` (gitignored).

## Required variables (read by Reliance notification code)

| Variable | Used for |
|----------|-----------|
| `RESEND_API_KEY` | Resend API bearer token |
| `EMAIL_FROM` | Verified sender in Resend (e.g. `Reliance <onboarding@resend.dev>` in sandbox) |
| `EMAIL_REPLY_TO` | Optional `reply_to` on outbound email |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_PHONE_NUMBER` | E.164 sender (e.g. `+15551234567`) |
| `APP_BASE_URL` | Origin for absolute consent/review links (no trailing slash required) |
| `EMAIL_ENABLED` | `true` / `false` — master switch for email attempts |
| `SMS_ENABLED` | `true` / `false` — master switch for SMS attempts |

## Dev-only test route

| Variable | Used for |
|----------|-----------|
| `NOTIFICATIONS_TEST_SECRET` | Required to call `POST /api/dev/notifications-test` (header `x-notifications-test-secret`) |

If this secret is unset, the test route returns `503` with instructions. The route is disabled in production (`404`).

## Startup behavior

On server start (`src/instrumentation.ts`) and on first consent/dev notification call, missing or inconsistent configuration is logged once as:

`[notification-env] Configuration warnings:`

Examples:

- `EMAIL_ENABLED` true but `RESEND_API_KEY` missing  
- `SMS_ENABLED` true but Twilio vars missing  
- `APP_BASE_URL` missing (links may be suboptimal)

## Twilio trial mode

Trial accounts cannot SMS arbitrary numbers until verified. Errors such as unverified destination appear in:

- API channel results (`errorCode` / `errorMessage`)
- Server logs from `[sms:twilio]`

## Resend

- Use a **verified domain** or Resend-provided sandbox sender for `EMAIL_FROM`.
- `reply_to` is sent as the `reply_to` JSON field on the Resend create-email API when `EMAIL_REPLY_TO` is non-empty.

## Related docs

- `NOTIFICATIONS_INTEGRATION_CHECK.md` — code map and manual checks  
- `PROJECT_STATE.md` — product-level status  
