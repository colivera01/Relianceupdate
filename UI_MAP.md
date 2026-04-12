# UI Map

**Last refreshed:** 2026-04-12.

## Major pages and sections

### User and public
- `/` (home): hero/marketing entry, browse/auth/navigation CTAs; data mostly static.
- `/browse`: discovery-style preview; use `/discover` for primary API-backed marketplace.
- `/discover`: paginated marketplace list with search/category/sort and favorites; connected to discover/categories/favorites APIs.
- `/favorites`: saved services with search/remove/book/view; connected to favorites APIs.
- `/service/[serviceId]`: service detail, media, ratings, availability; book + favorite actions (mixed endpoint maturity).
- `/vendors/[vendorId]`: public vendor profile, services/media/reviews; public vendor APIs.
- `/booking/[serviceId]` + `/booking/[serviceId]/confirmation`: booking wizard and persisted confirmation; bookings + availability APIs.
- `/my-bookings`: **connected** — list/cancel/load media via `/api/bookings*` with `AuthProvider` + `localStorage.userData` identity (`x-user-id`); smart video/review overlays when media present (see `MY_BOOKINGS_FUNCTION_AUDIT.md`).
- `/consent/[token]`: consent capture for tokenized flows; consent APIs.
- `/bookings`: thin or legacy entry; prefer `/my-bookings` for full customer history.
- `/messages`, `/reviews`: still largely mock or partial vs full smart-review pipeline.
- `/user-dashboard`, `/profile-settings`: customer profile surfaces; profile read/write partially connected.

### Vendor
- `/vendor/dashboard`: KPIs; vendor dashboard API.
- `/vendor/profile`: forms, photo, devices, storage; mostly connected.
- `/vendor/jobs`: large ops page; media/session/upload flows connected; some job orchestration still hybrid.
- `/vendor/services`, `/vendor/employees`, `/vendor/analytics`, `/vendor/billing`, `/vendor/reviews`: mock-heavy or placeholder actions.
- `/dashboard/devices`, `/dashboard/employees`, `/dashboard/invites`, `/dashboard/pending`: membership/device/invite flows; core actions connected.

### Admin
- `/admin/notifications`: feed + mark read; connected.
- `/admin/audit-logs`: filter + pagination; connected.
- `/admin/publish-management`: publish toggles; connected.
- `/admin/media-moderation`: queue + moderate; connected.
- `/admin/reviews`: moderation queue; connected.
- `/admin/review-audit`: review-window audit listing; connected.
- **`/admin/vendors`:** stable **hub** (links to publish, approval queue, audit) — not legacy monolithic vendor table UI.
- `/admin/dashboard`, `/admin/users`, `/admin/reports`, `/admin/settings`, `/admin/activity`, `/admin/admin-users`, `/admin/vendors/approval-queue`: mixed mock / partial.

## Buttons/actions and connection status (summary)

### Connected (working)
- Auth submit/reset/logout; login persists `userData` and updates `AuthContext`.
- Discover / favorites / public vendor / booking create + confirmation.
- **My Bookings:** refresh, tabs, search (client-side), cancel, load authorized media, video strip when URLs exist.
- **Book New Service** on `/my-bookings` → **`/discover`** (intentional).
- Vendor profile save/photo/devices/storage; vendor jobs media pipeline; dashboard membership flows.
- Admin notifications, audit logs, publish, media moderation, reviews moderation, review audit.

### Placeholder or partial
- `/bookings` vs `/my-bookings` depth; `/messages`, user `/reviews` depth.
- Vendor services/employees/analytics/billing/reviews CRUD.
- Several admin dashboard/report/config actions.

### Resolved (no longer broken)
- `/admin/vendors` page render (hub, not missing import).

## Related docs

- `ROUTE_MAP.md` — exhaustive route list.
- `MY_BOOKINGS_FUNCTION_AUDIT.md` — customer identity + bookings behavior.
- `PROJECT_STATE.md` — overall product/engineering status.
