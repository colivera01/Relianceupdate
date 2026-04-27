# Service Registration Flow Audit (2026-04-27)

## Category Templates
- Source config: `src/config/service-templates.ts`.
- Supported categories currently include `Cleaning`, `Barber`, `Plumbing`, `Electrician`, `Landscaping`.
- Vendor registration page loads templates when `Primary Service Category` is selected.
- Selected templates can be renamed inline before submit.

## `selectedServices` Precedence
- Backend route: `POST /api/vendor/register`.
- `upsertVendorServicesFromRegistration` precedence:
  1. Use `selectedServices` if present (authoritative list).
  2. Fallback to `serviceTypes` only if `selectedServices` absent/empty.
  3. Fallback to category template defaults only if both above are empty.
- This prevents renamed-template duplication (original template name no longer auto-inserted when renamed entry is provided).

## Custom Services
- UI supports adding multiple custom service drafts with:
  - `name` (required)
  - `defaultDuration` (optional positive number)
  - `price` (optional non-negative number)
  - `description` (optional)
- Client validation blocks:
  - empty custom names
  - invalid duration/price
  - duplicate names across template + custom sets

## Backend Persistence
- Vendor + manager membership creation/update handled in one route transaction path.
- Service persistence uses dedupe by lowercased service name against existing vendor services.
- New services created via `createMany` with:
  - `name`
  - `description` (payload or generated fallback text)
  - `price` (payload or `0`)
  - `isPublished: false`

## Surfaces Affected
- Vendor:
  - `/vendor/register` is the clearest implementation of template + custom services.
- Auth registration:
  - `/auth/register` includes similar logic and remains a parallel surface to keep aligned.
- Admin:
  - Vendor approval/publish flows are indirectly affected because vendor profile/services are now richer at creation.
- User/customer:
  - Indirectly affected through improved service catalog quality and vendor offerings.

## Remaining Gaps
- No admin UI yet for maintaining service template catalog (currently code-config only).
- Duration field is collected but not clearly persisted in canonical `Service` schema for downstream scheduling.
- Duplicate registration surfaces (`/vendor/register` vs `/auth/register` flow variants) risk behavior divergence.
- Template coverage is still narrow vs broader service catalog options presented in UI.
- No integration contract that enforces one canonical payload shape across all vendor onboarding entry points.
