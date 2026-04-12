# Review Audit Flow

## Fully working
- Admin retrieval API:
  - `GET /api/admin/review-audit`
- Admin UI:
  - `/admin/review-audit`
- Filter support:
  - booking
  - vendor
  - customer contact/user match
  - date range
  - review window status
  - sentiment
  - consent status
- Detail payload includes:
  - booking
  - media session
  - consent records + consent events
  - prompt events
  - sentiment entries
  - review submission result (or missing review on expiration)
  - timestamps + metadata

## Partially working
- Detail view is currently JSON-first modal rendering for speed and audit completeness.
- Existing admin audit log integration is included for key review/consent creation actions, but not every optional event in this pass.

## Documented only
- Rich timeline visualization and field-by-field diff UI.
- Export/reporting pipelines for compliance review packs.

## Temporary assumptions
- Admin retrieval uses current admin header/JWT guard pathway.
- Some metadata fields are stored as JSON strings and rendered directly in detail.

## Blockers
- No dedicated role-matrix expansion for fine-grained audit read permissions in this pass.
- Existing unrelated admin page import defects can affect full production build validation.

## Exact next recommended tasks
1. Add paginated table columns + structured detail drawer sections for each subdomain entity.
2. Add CSV/JSON export from filtered audit results.
3. Expand audit writes for consent request-open events and private feedback event taxonomy as needed.
4. Add focused tests for audit filter behavior and nested shape guarantees.
