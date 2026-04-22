# Media execution flow integration tests (2026-04-15)

## Added test suites

- `src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`
- `src/app/api/admin/media/admin-media-moderation.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/vendor-media-archive.integration.test.ts`
- `src/app/api/vendors/[vendorId]/memberships/memberships.integration.test.ts`

## Behaviors now covered

### Vendor job actions (`/api/vendors/[vendorId]/jobs/[jobId]/actions`)
- `PATCH`:
  - Forbidden vendor access (`403`)
  - Missing job (`404`)
  - `ARCHIVE_JOB` success status transition
  - `MOVE_CONTENT_TO_ARCHIVE` empty-state (`sessionCount=0`, `archivedAssetCount=0`)
  - `MOVE_CONTENT_TO_ARCHIVE` linked-session/media archive behavior
- `GET`:
  - Delete preview metadata (`canVendorDelete`, linked session/asset counts)
- `DELETE`:
  - Completed-job delete blocked (`403`, `JOB_DELETE_BLOCKED_COMPLETED`)
  - Pending-job hard delete with linked content archival transaction path

### Admin media moderation + queue (`/api/admin/media/*`)
- `PATCH /api/admin/media/[assetId]/moderate`:
  - Forbidden admin access (`403`)
  - Reject validation requiring `moderationReason` (`422`)
  - Approve + visibility propagation (`approve_vendor_archive_only`)
  - Explicit visibility-only action (`set_visibility_private`)
  - Reject transition to `rejected + private`
- `GET /api/admin/media/moderation-queue`:
  - Forbidden admin access (`403`)
  - Empty queue response
  - Search filtering over title/job/client fields

### Vendor content archive routes (`/api/vendors/[vendorId]/media*`)
- `GET /api/vendors/[vendorId]/media`:
  - Forbidden vendor access (`403`)
  - Empty archive payload
  - Enriched archive row mapping (title/job/client/service/employee)
  - Canonical status mapping including `archiveStatus=archived` for deleted assets
- `DELETE /api/vendors/[vendorId]/media/[assetId]`:
  - Vendor ownership enforcement (`403`)
  - Archive transition writes `archiveStatus=archived`
- `PATCH /api/vendors/[vendorId]/media/[assetId]`:
  - Unsupported action (`422`)
  - Restore transition writes `archiveStatus=active`

### Vendor employees API path (`/api/vendors/[vendorId]/memberships`)
- Forbidden manager check (`403`)
- Empty state response
- Normalized membership list mapping + status filter forwarding

## Intentional gaps left uncovered

- UI-level behavior in `src/app/vendor/jobs/page.tsx` (covered via route integration, not component/E2E assertions).
- `src/app/api/services/route.ts` and `src/app/api/reviews/route.ts` remain largely mock-backed and were not expanded in this pass.
- Storage/download edge cases (`/download` SAS generation, Azure failures) are not covered by these route suites.
- Cross-route "live DB" contract tests are still mocked integration tests (consistent with existing project style).
