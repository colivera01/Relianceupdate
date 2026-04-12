# Favorites + service detail — customer identity alignment audit

**Date:** 2026-04-12  
**Scope:** `/discover`, `/favorites`, `/service/[serviceId]`, `src/sdk/favorites.ts`, `src/hooks/useFavorites.ts`, and callers of the favorites API from those surfaces.

## Goal

Use one resolution order for customer id on favorites reads/writes: **`useAuth().user.id`** first, then **`resolveCustomerUserId`** fallbacks (`localStorage.userData` → legacy `localStorage.user`). Keep **`x-user-id`** and **`userId`** query/body aligned with that id where the API accepts them.

## Findings (before this pass)

| Location | Issue |
|----------|--------|
| `src/sdk/favorites.ts` | `getLocalUserId()` read **`userData`** then **`user`** only — no auth context (SDK is non-React). |
| `src/hooks/useFavorites.ts` | Called SDK without passing session id — could not prefer **`AuthProvider`** user when both storage and context differed. |
| `src/app/(user)/service/[serviceId]/page.tsx` | **`getUserIdFromLocal()`** read **only** legacy **`localStorage.user`**, ignoring **`userData`** and **`useAuth().user`**. |
| `src/app/(user)/discover/page.tsx` | No direct storage reads; identity came only via **`useFavorites`** → SDK. |
| `src/app/(user)/favorites/page.tsx` | Same as discover. |

**Grep note:** Other **`localStorage.getItem('user')`** usages remain on **admin** tooling pages and are out of this favorites/customer scope.

## Changes (this pass)

1. **`src/sdk/favorites.ts`**  
   - Removed bespoke **`getLocalUserId`**.  
   - **`requestJson`**, **`listFavorites`**, **`addFavorite`**, **`removeFavorite`** accept optional **`authUserIdFromCaller`** and resolve via **`resolveCustomerUserId(authUserIdFromCaller)`** for **`userId`** query string, **`x-user-id`**, and POST body **`userId`** when present.

2. **`src/hooks/useFavorites.ts`**  
   - **`useAuth()`**; passes **`user?.id`** into all **`favoritesSDK`** methods.  
   - Query keys include **`_authUserId`** so lists refresh when auth user changes.

3. **`src/app/(user)/service/[serviceId]/page.tsx`**  
   - **`useAuth`** + **`resolveCustomerUserId(user?.id)`** for favorites GET/POST/DELETE (same headers/query/body shape as before).  
   - **`useEffect`** depends on **`[serviceId, user?.id]`** so favorite state reloads when auth hydrates.

## API contract (unchanged behavior, consistent identity)

- **`GET /api/users/favorites`:** `getUserIdFromRequest` → **`x-user-id`** / **`userId`** query (and auth). Client sends the same resolved id on query + header when available.  
- **`POST /api/users/favorites`:** `authUserId || x-user-id || body/query userId`.  
- **`DELETE /api/users/favorites/[id]`:** Same pattern as GET for caller id.

## Verification

- Typecheck: `npx tsc --noEmit` (project root).  
- Manual: logged-in customer on discover/favorites/service — heart and list match the same user; after login hydration, service detail favorite row updates without requiring only legacy **`user`** key.

## Out of scope

- Admin pages using **`localStorage.user`** for dev convenience.  
- **`DELETE`** using **`favoriteId || serviceId`** on service detail (pre-existing; not changed here).
