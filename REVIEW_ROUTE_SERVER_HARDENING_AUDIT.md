# Review API routes — server-side hardening audit

**Scope:** Server enforcement for customer smart-review capture routes only.  
**Files:** `src/app/api/reviews/window/start/route.ts`, `prompt-event/route.ts`, `sentiment/route.ts`, `create/route.ts`, `window/expire/route.ts`, plus `src/lib/review-capture.ts` (`assertReviewWindowActive`, `getOrCreateActiveReviewWindow`).  
**Auth helper:** `getUserIdFromRequest` in `src/lib/auth.ts` (Bearer → cookies → `x-user-id`).  
**Doc aligned to implementation:** 2026-04-12 (create + expire hardening + client `x-user-id` on review fetches from `SmartVideoPlayer`).

---

## 1. Authentication requirements per route

| Route | `getUserIdFromRequest` / auth enforced? |
|-------|----------------------------------------|
| **`POST /api/reviews/window/start`** | **No.** No call to `getUserIdFromRequest`; anonymous POST accepted if body + DB checks pass. |
| **`POST /api/reviews/prompt-event`** | **No.** |
| **`POST /api/reviews/sentiment`** | **No.** |
| **`POST /api/reviews/create`** | **Yes.** `401` if `getUserIdFromRequest` returns null (`"Authentication required"`). |
| **`POST /api/reviews/window/expire`** | **Yes.** `401` if unauthenticated; `403` if authenticated user is not the booking owner (see §3). |

---

## 2. `x-user-id` / `getUserIdFromRequest` usage

| Route | Uses `getUserIdFromRequest`? | Notes |
|-------|------------------------------|--------|
| **window/start** | **No** | Client may send `x-user-id` (`SmartVideoPlayer`); handler **does not read** it for authorization. |
| **prompt-event** | **No** | Same. |
| **sentiment** | **No** | Same. |
| **create** | **Yes** | Required for `userId`; used with booking ownership checks. |
| **window/expire** | **Yes** | Required before any response that reveals window state to a caller. |

---

## 3. Booking ownership enforcement

| Route | Enforced? | Mechanism |
|-------|-----------|-----------|
| **window/start** | **Partial / indirect** | Loads `booking` by `bookingId` with **`vendorId` only** in `select` (`id`, `vendorId`). **`userId` not loaded or compared.** Ownership is **not** tied to the HTTP principal. |
| **prompt-event** | **No** | Only `assertReviewWindowActive(reviewWindowId)`. No join to `booking.userId`. |
| **sentiment** | **No** | Same as prompt-event. |
| **create** | **Yes** | After `assertReviewWindowActive`: **`reviewWindow.bookingId` / `vendorId`** must match body **`bookingId` / `vendorId`** (`409`); optional body **`mediaSessionId`** must match window if sent (`409`); empty window **`mediaSessionId`** → `400`. Then booking by body id: **`String(booking.userId) !== String(userId)` → 403**. |
| **window/expire** | **Yes** | Loads **`booking`** by **`reviewWindow.bookingId`**; **`String(booking.userId) !== String(userId)` → 403** (including when window is not active, to avoid cross-user id probing). |

---

## 4. Are consent checks sufficient by themselves?

**`window/start` only:**

- Requires **`ConsentRecord`** with `consentType: 'video_access'`, `status: 'accepted'`, matching **`bookingId` + `vendorId` + `mediaSessionId`**.
- Plus **`mediaSession`** row must match that triple; **`booking.vendorId`** must match body `vendorId`.

**Assessment:**

- Consent is a **strong gate for starting** a window: an attacker cannot start without an accepted consent row for that exact triple (assuming consent issuance is trustworthy).
- Consent **does not** prove the **caller** is the booking customer: token-based consent may be completed in a browser session that is not the same as whoever POSTs `window/start` (depends on product threat model).
- **`window/start` does not verify `booking.userId`** against any request identity, so **consent alone is not equivalent to “authenticated booking owner”** for this endpoint.

**Downstream routes (`prompt-event`, `sentiment`):** **No** consent check; they rely on **`reviewWindowId`** + window state only.  
**`expire` and `create`:** Now additionally tied to **authenticated booking owner** (and **`create`** ties body to window).

---

## 5. `prompt-event` / `sentiment` / `expire` — authentication stance

**Implemented:** **`expire`** requires **`getUserIdFromRequest`** and **booking owner** match via **`reviewWindow.bookingId`**. First-party client sends **`x-user-id`** on this call (`SmartVideoPlayer`).

**Remaining lower-priority surface:**

- **prompt-event / sentiment:** Still **unauthenticated** on the server; any holder of an **active** `reviewWindowId` can append telemetry until the window closes. Mitigations: UUID secrecy, **`assertReviewWindowActive`**, optional future **auth + owner** check (TODO in route files).

**`window/start`:** Optional future **`getUserIdFromRequest`** + **`booking.userId`** alignment **in addition to** existing consent (TODO in route file). **Do not** remove or weaken consent checks when adding this.

---

## 6. Risk analysis

### Spoofed `bookingId` / `vendorId` / `mediaSessionId` on **window/start**

- **Booking/vendor mismatch:** rejected (`404` invalid pair).
- **Media session mismatch:** rejected (`404`).
- **Consent missing:** rejected (`403`).
- **Residual:** If an attacker can **create or obtain accepted consent** for someone else’s triple, they can **start windows** without being the booking user (server does not check `userId` on this route).

### Replay / misuse of **`reviewWindowId`**

- **prompt-event / sentiment:** Valid **active** window id allows writes. **No** per-request nonce.
- **expire:** **Mitigated** — unauthenticated or wrong-user expiry is **rejected** (`401` / `403`).

### Cross-user misuse on **`create`**

- **Ownership:** Enforced (`booking.userId` vs authenticated user).
- **Cross-window / body mismatch:** **Mitigated** — **`reviewWindow.bookingId` / `vendorId`** (and optional **`mediaSessionId`**) must match the submitted body before review creation.

### **`create` + `reviewWindowId`**

- Window is closed to **`submitted`** after success; replay blocked by **existing review** check and window status.

---

## 7. Follow-ups (lower priority only)

1. **`POST /api/reviews/window/start`:** Optional **`getUserIdFromRequest`** + **`booking.userId`** match while **preserving** consent + FK checks. **File:** `window/start/route.ts` (TODO present).
2. **`POST /api/reviews/prompt-event`** and **`POST /api/reviews/sentiment`:** Optional auth + **“caller owns `reviewWindow.bookingId`”** after `assertReviewWindowActive`. **Files:** respective `route.ts` (TODOs present).

**Implemented (not listed above):** **`create`** window ↔ booking/vendor (+ optional **`mediaSessionId`**) alignment; **`expire`** auth + booking ownership.

---

## Quick reference matrix

| Route | Auth | `x-user-id` used server-side | Booking owner | Consent | Window / body integrity |
|-------|------|------------------------------|---------------|---------|-------------------------|
| window/start | None | No | No | Yes (`video_access` accepted) | FK + get/create |
| prompt-event | None | No | No | No | Active only |
| sentiment | None | No | No | No | Active only |
| create | Required | Yes (via `getUserIdFromRequest`) | Yes | No (indirect via window) | Active + **window ↔ body** match |
| window/expire | Required | Yes (via `getUserIdFromRequest`) | Yes | No | Active → expired (owner only) |

**Client (`SmartVideoPlayer`):** Sends **`x-user-id`** on all five review `POST`s when **`userId`** is present; missing **`userId`** ⇒ no review calls (watch-only). Server **`window/start`** / **`prompt-event`** / **`sentiment`** do not yet **require** that header for authorization.
