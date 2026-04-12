# Auth login flow audit (E2E smoke / `/auth/login`)

**Date:** 2026-04-12  
**Scope:** Login path used by **`/auth/login`** → **`POST /api/auth/login`** and why **`npm run test:e2e:smoke`** can remain on **`/auth/login`** after “Sign In”.

---

## 1. Credentials the smoke test submits

**Source:** `e2e/booking-smoke.spec.ts`

| Field | Value |
|--------|--------|
| **Email** | `fixture.customerEmail` from **`e2e/smoke-fixture.json`**, written by **`e2e/global-setup.ts`** as **`e2e-smoke-customer@reliance.test`**. |
| **Password** | `process.env.E2E_CUSTOMER_PASSWORD` if set, else **`E2E_Smoke_dev_only_9!`**. |

**Aligned dev user:** `src/lib/dev-registered-users.ts` defines the same email and default password for **`e2e-smoke-customer`**.

---

## 2. What `POST /api/auth/login` expects (live route)

**File:** `src/app/api/auth/login/route.ts`

- **Body:** JSON `{ email, password }` (both required strings).
- **Lookup:** `registeredUsers.find((u) => u.email === email)` from **`@/lib/dev-registered-users`** — **exact email match** (case-sensitive).
- **Password:** Plain string equality `user.password !== password` (no hashing in this dev route).
- **Success (200):** `{ success: true, message, user, token }` where **`user`** is at the **top level** and includes at least **`id`**, **`name`**, **`email`**, **`userType`**, **`availableProfiles`**, **`avatar`** (shape built in the route).
- **Failure:** **400** if email/password missing; **401** with `{ error: "Invalid email or password" }` if user not found or password mismatch; **500** on unexpected errors.

---

## 3. Is `dev-registered-users` consulted by the login route?

**Yes**, when the request hits the **Next.js route handler** at **`src/app/api/auth/login/route.ts`**. That file imports **`registeredUsers`** from **`src/lib/dev-registered-users.ts`** and uses it as the only credential source for this dev implementation.

**Caveat:** The browser may **not** hit that handler if another layer answers first (see §4).

---

## 4. Effective response for the E2E customer (two environments)

### A) Live API path (MSW off, `NEXT_PUBLIC_API_MODE` ≠ `mock`)

For **`e2e-smoke-customer@reliance.test`** + **`E2E_Smoke_dev_only_9!`** (and matching **`E2E_CUSTOMER_PASSWORD`**), the route returns **200** and a top-level **`user`** with **`id: "e2e-smoke-customer"`**, **`userType: "customer"`** (after profile logic), etc.

If email or password does not match the in-memory array, response is **401** and the login page shows **`alert(...)`** and **stays on `/auth/login`**.

### B) Mock API path (`NEXT_PUBLIC_API_MODE=mock`)

**Files:** `src/components/ClientProviders.tsx` (starts MSW when env is **`mock`**), `src/mocks/start.ts`, `src/mocks/browser.ts`, **`src/mocks/handlers.ts`**.

MSW registers **`http.post('/api/auth/login', ...)`** which returns:

```json
{
  "success": true,
  "data": {
    "user": { "id": "user1", "email": "<submitted>", "name": "Test User" },
    "token": "mock-jwt-token"
  }
}
```

The **real** route returns **`user` and `token` at the top level**, not nested under **`data`**.

**`src/app/auth/login/page.tsx`** does:

- `const data = await response.json();`
- On **`response.ok`**: uses **`data.user`** and **`data.token`** (top level).

Under MSW, **`data.user` is `undefined`** → accessing **`data.user.id`** throws → **`catch`** runs → **`alert('Login failed. Please try again.')`** → **no `router.push`** → URL **stays `/auth/login`**.

So for E2E, **mock mode produces the same visible symptom as a hard login failure** (stuck on login), even though MSW returns **200**.

---

## 5. Login page behavior (success vs failure)

**File:** `src/app/auth/login/page.tsx`

| Outcome | Behavior |
|---------|-----------|
| **`response.ok`** and **`data.user`** usable | Sets **`localStorage`** (`userData`, `authToken`), calls **`login()`** from **`AuthContext`**, then **`router.push(...)`** per **`data.user.userType`** (see §6). |
| **`!response.ok`** | **`alert(data.error || 'Login failed')`** — no redirect. |
| **Fetch / JSON / runtime error** (including bad **`data` shape**) | **`alert('Login failed. Please try again.')`** — no redirect. |

The smoke test attaches **`page.on('dialog', d => d.accept())`**, so failure **alerts** are dismissed automatically; the page **still** remains **`/auth/login`**.

---

## 6. Redirect after successful login

**Same file:** `src/app/auth/login/page.tsx`

| `data.user.userType` (from API payload) | Redirect |
|----------------------------------------|----------|
| **`vendor`** | `/vendor/dashboard` |
| **`both`** | `/user-dashboard` |
| **else** (customer / admin normalization) | `/user-dashboard` |

For the E2E customer, a **correct** live API response yields **`userType: "customer"`** → **`/user-dashboard`**.

---

## Root-cause findings (ordered by likelihood for this repo)

1. **`NEXT_PUBLIC_API_MODE=mock`** (e.g. in **`.env.local`**) → MSW **`/api/auth/login`** returns the **wrong JSON shape** → login page **throws** in success branch → **catch** → **alert** → **no redirect** → smoke “stuck on login”. **Evidence fit:** no 401, still full login UI; matches observed failures after globalSetup passed.
2. **`E2E_CUSTOMER_PASSWORD`** set to a **non-default** value that does **not** match **`dev-registered-users`** → **401** → alert → stay on login.
3. **Stale or alternate server bundle** without the **`e2e-smoke-customer`** row (rare if source is current) → **401** “user not found”.
4. **Not** primarily “missing redirect on success” — redirect exists; it simply does not run unless the client receives a **`data.user`**-compatible **200** response.

---

## Exact files involved

| Role | Path |
|------|------|
| Smoke credentials | `e2e/booking-smoke.spec.ts`, `e2e/smoke-fixture.json` (generated), `e2e/global-setup.ts` |
| Dev users | `src/lib/dev-registered-users.ts` |
| Login UI | `src/app/auth/login/page.tsx` |
| Login API (live) | `src/app/api/auth/login/route.ts` |
| MSW mock login | `src/mocks/handlers.ts` |
| MSW bootstrap | `src/components/ClientProviders.tsx`, `src/mocks/start.ts`, `src/mocks/browser.ts` |

---

## Smallest code fixes (pick one track)

| Track | Smallest change |
|--------|------------------|
| **E2E / env only** | Run smoke with **live** API: ensure **`NEXT_PUBLIC_API_MODE`** is **`live`** or **unset** for the Playwright **`webServer`** process (e.g. in `playwright.config.ts` **`webServer.env`** or shell), matching **`npm run dev:live`**. No handler edits. |
| **MSW alignment** | In **`src/mocks/handlers.ts`**, change the **`http.post('/api/auth/login')`** response to mirror **`src/app/api/auth/login/route.ts`** (top-level **`user`**, **`token`**, **`userType`**, **`name`**, etc.). One handler, fixes all mock-mode logins. |
| **Credentials only** | If truly on live mode: align **`E2E_CUSTOMER_PASSWORD`** with **`dev-registered-users`** or remove the env var so the default applies. |

---

## Bug classification (for the stuck-on-login symptom)

| Label | Applies when |
|--------|----------------|
| **Bad credentials** | Live route, **401**, email/password mismatch vs **`dev-registered-users`**. |
| **Login API failure** | **500**, network error, or **non-JSON** response — usually **`alert('Login failed. Please try again.')`**. |
| **Missing auth sync** | Misleading here: failure is not “Prisma user missing” for **`/api/auth/login`** (that route does not read Prisma). Prisma user is required **later** for bookings. |
| **Missing redirect** | **Not** the primary bug: redirect is implemented; it does not run when success handling throws or when **`response.ok`** is false. |
| **Mock / response-shape (recommended primary suspect in dev)** | **`NEXT_PUBLIC_API_MODE=mock`** + MSW body shape ≠ login page expectations → **exception path** → no redirect. |

---

## Quick verification checklist

1. In the browser (or Playwright trace), inspect **`POST /api/auth/login`**: status **200** vs **401**, and JSON shape (**`user` at top level** vs nested under **`data`**).
2. Print or log **`process.env.NEXT_PUBLIC_API_MODE`** for the dev server used by smoke.
3. If mock: fix handler (§) or force **live** for E2E **`webServer`**.
