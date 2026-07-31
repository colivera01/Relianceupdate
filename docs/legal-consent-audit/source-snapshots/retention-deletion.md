# Retention, Deletion, and Withdrawal Snapshot

- Original repository paths:
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\privacy\page.tsx`, lines 67-110
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\[assetId]\route.ts`, lines 12-154
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\[jobId]\actions\route.ts`, lines 1107-1148 and 1164-1297
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\bookings\[id]\route.ts`, lines 263-319
  - `C:\Users\Cesar Olivera\Project Reliance\src\lib\azure-blob-storage.ts`, lines 346-372
  - `C:\Users\Cesar Olivera\Project Reliance\src\app\api\admin\account-actions\route.ts`, lines 108-233
- Snapshot type: Carefully labeled excerpts
- Production data included: No

## Current policy

The Privacy Policy uses a general "as long as reasonably necessary" standard and permits retention for legal/compliance, consent/moderation history, disputes, security, and fraud prevention. It does not assign record-specific periods.

## Current application behavior

- Vendor media delete is a reversible soft delete: `deletedAt` is set and `archiveStatus` becomes archived.
- Restore clears `deletedAt` and returns archive status to active.
- Moving job content to archive ends sessions and soft-deletes assets.
- Vendor service-order deletion is allowed for selected non-completed states. It hard-deletes the booking but archives/detaches linked sessions and soft-deletes linked assets.
- Completed service orders cannot be vendor-deleted.
- Customer booking deletion changes status to `CANCELED`; it does not erase the booking or related records.
- Admin account actions can deactivate/restrict accounts and unpublish vendor content, but they do not erase the user.
- A physical Azure blob delete helper exists, but the vendor media and work-order deletion routes reviewed do not call it.

## What was not found

- scheduled retention or purge jobs;
- category-specific retention periods;
- customer self-service media deletion;
- self-service consent withdrawal/revocation;
- a workflow that unpublishes previously public media after consent withdrawal;
- account erasure or export;
- automated physical blob deletion for soft-deleted assets;
- orphan-upload cleanup;
- legal-hold fields or a legal-hold release process.

The application therefore supports operational hiding, archiving, cancellation, and deactivation more strongly than verified physical deletion.
