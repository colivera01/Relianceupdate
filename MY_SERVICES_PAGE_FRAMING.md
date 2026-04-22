# My Services page — customer framing (implementation notes)

## Files changed

- **`src/app/(user)/my-bookings/page.tsx`** — customer-facing UX and copy only. **No route or API changes.**

## What was added (clarity)

1. **Page header** — Explains the page as vendor history + shared, **customer-approved** media (aligned with `GET /api/bookings/[id]/media`, which only returns approved, customer-visible assets).

2. **“Why a row appears here” callout** — Short bullets on engagements, **Show shared media**, and optional in-player review prompts.

3. **Per-row “What you can do”** — Action-oriented list:
   - **View service details** → `/service/[serviceId]` when `service.id` is present.
   - **Shared media** — State-specific copy (not loaded / empty / error / image-only / video available).
   - **Review** — Driven by existing `shouldEnableReviewCaptureForStatus` (cancelled vs eligible).

4. **Reference ID** — Same underlying `booking.id`, framed for customers with a line that it matches the booking record for support.

5. **Schedule labels** — “Scheduled date” / “Time” for readability.

6. **Primary media button** — Renamed to **Show shared media** (still calls `GET /api/bookings/[id]/media`).

7. **Post-load messaging** — After a successful fetch:
   - **Count badge** — “N item(s) from your vendor — approved for you to view” (truthful: API filters to approved + customer visibility).
   - **Empty** — Plain explanation that nothing matched yet (vendor upload / review pipeline), without claiming a specific internal moderation state.
   - **Image-only** — If `assets.length > 0` but `videos` is empty, an **amber** panel explains this page only embeds video; image count comes from the existing `images` array in the JSON response.
   - **Errors** — Server message plus optional hints when the text suggests **consent** or **forbidden** (still generic; no new APIs).

8. **Shared media panel** — Title/description updated to vendor-shared, customer-approved framing; **Service Video Review Capture** removed as the primary heading.

## How media / review availability is represented

| Signal | Source | UI behavior |
|--------|--------|-------------|
| Not requested | No `mediaState` yet | Bullet tells user to tap **Show shared media**. |
| Loading | `mediaState.loading` | “Loading shared media…”. |
| Loaded, count 0 | Successful JSON, `assets.length === 0` | Short paragraph: no approved customer-visible media yet. |
| Loaded, video | `videos.length > 0` | Player block; bullet says media is available below. |
| Loaded, non-video only | `total > 0` and `videos.length === 0` | Bullet + amber panel; `imageCount` from `images` when present. |
| Error | Failed request or non-OK response | API error string + optional hint from message keywords. |
| Review prompts | `shouldEnableReviewCaptureForStatus(status)` + `SmartVideoPlayer` | Copy explains prompts after playback when eligible; cancelled services say reviews are not offered. |

**Not invented:** We do **not** show “awaiting admin review” as a live state—only explain in generic terms when the list is empty, since the UI does not fetch pending assets.

## Backend / routes (unchanged)

- URL **`/my-bookings`**, **`/api/bookings`**, **`/api/bookings/[id]/media`**, identifiers, and Prisma models are **unchanged**.
