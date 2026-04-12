# Review route integration tests (pass 1)

**Date:** 2026-04-11  
**Source:** `CORE_USER_FLOW_INTEGRATION_TEST_AUDIT.md` §4 (review create / expire).

## What was added

- **`src/app/api/reviews/review-create-expire.integration.test.ts`** — Vitest suite calling **`POST`** handlers from:
  - `src/app/api/reviews/create/route.ts`
  - `src/app/api/reviews/window/expire/route.ts`

## Mocking strategy

| Dependency | Mock |
|------------|------|
| `@/server/db` (`prisma`) | `vi.hoisted` object: **`reviewWindow.findUnique`**, **`reviewWindow.update`**, **`booking.findUnique`**, **`review.findFirst`**, **`review.count`**, **`reviewPromptEvent.create`**, **`$transaction`** |
| `@/lib/auth` | **`getUserIdFromRequest`** |
| `@/lib/admin-audit` | **`createAdminAuditLog`** (create success path only) |
| `@/lib/review-notifications` | **`notifyReviewWindowClosedWithoutSubmission`** (expire active path) |

**`assertReviewWindowActive`** in `@/lib/review-capture` is **not** mocked; it uses the same hoisted **`prisma.reviewWindow.findUnique`**, so active-window rules (status `active`, future **`expiresAt`**) are exercised for create tests.

## Cases covered

### `POST /api/reviews/create`

1. **401** — unauthenticated (`getUserIdFromRequest` → `null`).
2. **403** — booking `userId` ≠ caller after window/body alignment.
3. **409** `REVIEW_WINDOW_CONTEXT_MISMATCH` — window `bookingId` ≠ body `bookingId`.
4. **409** `REVIEW_WINDOW_MEDIA_MISMATCH` — body `mediaSessionId` ≠ window `mediaSessionId`.
5. **200** — active window, matching booking/vendor, owner = caller, **`$transaction`** + **`createAdminAuditLog`**.

### `POST /api/reviews/window/expire`

1. **401** — unauthenticated.
2. **403** — booking owner ≠ caller.
3. **200** — window already **non-active** (early return; no **`update`**, no **`notifyReviewWindowClosedWithoutSubmission`**).
4. **200** — active window → **`update`**, **`reviewPromptEvent.create`**, **`notifyReviewWindowClosedWithoutSubmission`**.

## How to run

```bash
npx vitest run src/app/api/reviews/review-create-expire.integration.test.ts
```

## Follow-ups (not in this pass)

- `POST /api/reviews/window/start`, **`prompt-event`**, **`sentiment`**.
- Real DB or Playwright E2E (see core user-flow audit).
