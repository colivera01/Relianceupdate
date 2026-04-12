# Smart Review Capture Plan

## Fully working
- Schema foundation for active review-capture flow:
  - `ReviewWindow`
  - `ReviewPromptEvent`
  - `ReviewSentiment`
  - `ConsentRecord`
  - `ConsentEvent`
- Review model now supports active-path capture metadata:
  - `source` (`customer`)
  - `submittedVia` (`video_overlay`, `email_link`, `sms_link`, `manual`)
  - `bookingId` (nullable)
  - `mediaSessionId` (nullable)
- Active review APIs implemented:
  - `POST /api/reviews/window/start`
  - `POST /api/reviews/prompt-event`
  - `POST /api/reviews/sentiment`
  - `POST /api/reviews/create`
  - `POST /api/reviews/window/expire`
- Core rule enforced:
  - Review submission requires authenticated booking customer ownership.
  - No inactivity auto-review creation.
  - Expiration closes window without creating public review.

## Partially working
- Customer video overlay flow is wired in active customer booking playback (`/my-bookings` media panel):
  - soft prompt around 3s after play
  - reinforcement prompt around 10s
  - sentiment capture
  - quick review submit path
  - private feedback path (non-public)
- Notification trigger points are implemented, but scheduler transport is currently a stub:
  - reminder hook at window start
  - close-without-review hook at expiration

## Documented only
- Full automated reminder scheduler infrastructure is not yet wired.
- Vendor-first orchestration UI to launch consent requests at exact media-hand-off moment is not complete; API is ready.
- Broad review/search domain refactors intentionally deferred.

## Temporary assumptions
- Review window TTL currently uses a fixed 72-hour duration.
- Reminder timing default uses a fixed config value in stub layer (30 minutes).
- Prompt exit-intent uses `beforeunload` fallback behavior and explicit in-app modal close actions.

## Blockers
- No queue/cron job infrastructure in this pass for real delayed reminder dispatch.
- Existing project has unrelated build failures in admin pages with missing component imports; independent from this flow.

## Exact next recommended tasks
1. Wire real notification scheduler/provider to `scheduleReviewReminder` and close-without-review notice hook.
2. Add vendor UI action in active media workflow to call `POST /api/consent/request` before customer video handoff.
3. Add targeted integration tests against new review/consent/audit routes and customer overlay behavior.
4. Add structured private-feedback storage endpoint if product requires reporting/triage beyond prompt-event metadata.
