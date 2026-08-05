# Epic 4 Screenshot Index

All images use controlled test data. No credential, raw token, OTP, private key, or real customer information is present.

| File | Viewport | State | What to verify |
|---|---|---|---|
| `Desktop/01-declined-residence-recording-locked.png` | 1440 x 1000 | Blocked | Why, responsible participant, next action, service-continuation rule, disabled stages |
| `Mobile/01-declined-residence-recording-locked.png` | 390 x 844 | Blocked | Same evidence fits without overlap or clipped controls |
| `Desktop/02-loading-assigned-work.png` | 1440 x 900 | Loading | Page does not imply an empty queue while data is pending |
| `Desktop/03-empty-assigned-work.png` | 1440 x 900 | Empty | New employee understands how assigned work appears |
| `Desktop/04-assigned-work-failure.png` | 1440 x 900 | Failure | Failure is distinguished from empty and gives recovery steps |
| `Desktop/05-recording-unlocked-success.png` | 1440 x 1000 | Success | Canonically allowed property-only record exposes enabled stages |

## Visual QA Result

- No incoherent overlap, clipping, hidden action, or unreadable status was found.
- Blocked stage controls remain disabled and no camera action appears.
- Mobile text wraps cleanly within the work-record panel.
- A comparable before image was not available from the same build/state, so no misleading before/after pair was created.
