# Evidence Index

Audit date: 2026-07-30

Repository root: `C:\Users\Cesar Olivera\Project Reliance`

The index lists the source files materially reviewed for the audit. "Quoted" means the audit or a snapshot reproduces selected user-visible text or code. "Summarized" means the behavior is described without reproducing the whole source.

| Full repository path | Purpose | Relevant report section | Use |
|---|---|---|---|
| `C:\Users\Cesar Olivera\Project Reliance\src\app\privacy\page.tsx` | Current public Privacy Policy | 2, 12, 17, 20 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\terms\page.tsx` | Current public Terms of Service | 2, 13 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\sms-policy\page.tsx` | Current SMS program disclosure | 2, 7, 12 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\auth\register\page.tsx` | Customer and vendor account registration UI | 3, 4, 7, 13 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\customer\register\route.ts` | Customer registration persistence and booking claim | 3, 7, 14, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendor\register\route.ts` | Vendor account/profile registration and approval request | 3, 4, 7, 14, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\vendor\register\page.tsx` | Signed-in vendor profile registration UI | 3, 4 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\vendor\invite\[token]\page.tsx` | Employee invite acceptance UI | 3, 5 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendor\invite\[token]\route.ts` | Employee invite lookup, user creation, and membership activation | 3, 5, 14, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\vendor\employees\page.tsx` | Team invitation and roster UI | 4, 5, 7 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\vendor\jobs\page.tsx` | Work record creation, consent choices, assignment, resend, and manager workflow UI | 4, 6, 9, 10, 21 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\employee\jobs\page.tsx` | Employee recording, preview, replacement, and upload UI | 5, 8, 9, 21 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\consent\[token]\page.tsx` | Customer approve/decline and public/private selection UI | 6, 10, 13, 21 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\(user)\my-bookings\[bookingId]\page.tsx` | Customer video viewing and inline review flow | 10, 11, 21 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\(user)\reviews\page.tsx` | Customer-owned review hub | 11 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\reviews\ReviewCard.tsx` | Review moderation countdown copy | 11 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\bookings\route.ts` | Work record creation, location snapshot, automatic consent record, and delivery | 4, 6, 7, 14, 15 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\bookings\[id]\route.ts` | Customer booking access, update, and cancellation | 15, 17 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\bookings\[id]\media\route.ts` | Customer-scoped booking media listing | 9, 10, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\bookings\[id]\media\[assetId]\download\route.ts` | Customer-scoped approved media download | 9, 10, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\consent-flow.ts` | Consent types, statuses, versions, token generation, and hash helper | 6, 14, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\consent-record-state.ts` | Consent pending/expired response rules | 6, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\request\route.ts` | Consent creation, supersession, audit, and delivery | 6, 7, 14, 15, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\[token]\route.ts` | Public bearer-link consent lookup and lazy expiry | 6, 14, 15, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\accept\route.ts` | Consent acceptance, policy versions, IP/user agent, visibility, and location snapshot | 6, 10, 14, 15, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\decline\route.ts` | Consent decline and service-order release revocation | 6, 14, 15, 17 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\status\route.ts` | Authorized consent status lookup | 6, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\consent\consent-flow-routes.test.ts` | Current route tests for consent lookup, acceptance, and decline behavior | 6, 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\booking-notification-delivery.ts` | Queued consent notification attempt tracking | 7, 14 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-consent-link.ts` | Consent email/SMS templates | 6, 7 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-consent-decision.ts` | Manager/employee consent-decision notices | 6, 7 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-job-assignment.ts` | Employee service-order email/SMS | 5, 7 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-video-ready.ts` | Customer completed-video email/SMS | 7, 10 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-video-package-approved.ts` | Manager admin-approval email/SMS | 7, 10 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-review-reminder.ts` | Customer review reminder email/SMS | 7, 11 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\send-review-expired.ts` | Review-window closed email/SMS | 7, 11 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\review-notifications.ts` | Immediate best-effort reminder behavior and scheduler limitation | 7, 11, 23 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\notifications\notification-audit.ts` | Notification-attempt audit records | 7, 14, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\email\resend.ts` | Resend transport and provider result handling | 7, 20 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\sms\twilio.ts` | Twilio/Telnyx SMS transport and error mapping | 7, 20 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\env\notification-config.ts` | Notification configuration names and readiness checks | 7, 20, 23 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\job-recording-location.ts` | Server location radius, accuracy, and snapshot selection | 6, 9, 15, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\geocoding.ts` | Mapbox/Census address geocoding | 6, 18, 20 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\[jobId]\verify-location\route.ts` | Assigned employee location verification endpoint | 5, 9, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\[jobId]\start\route.ts` | Employee job start authorization and lifecycle change | 5, 9, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\[jobId]\stage\route.ts` | Stage-completion proof requirement | 5, 9, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\[jobId]\complete\route.ts` | Three-stage package completion and manager queue | 5, 9, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\employee\jobs\route.ts` | Assigned and released employee job listing | 5, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\employee-capture-token.ts` | Signed, expiring, assignment-bound capture link | 5, 9, 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\sessions\route.ts` | Session creation, consent and location gates, replacement handling | 6, 9, 15, 17 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\init\route.ts` | Upload authorization, quota gate, and SAS URL initialization | 9, 15, 18, 20 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\proxy\route.ts` | Authenticated phone upload fallback and size/type checks | 9, 15, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\complete\route.ts` | Blob verification, server duration probe, asset creation, moderation defaults | 9, 14, 15, 17, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\upload\complete\media-upload-complete-stage-video-duration.integration.test.ts` | Integration tests for staged video duration enforcement | 9, 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\azure-blob-storage.ts` | Azure Blob SAS, download, and physical delete helper | 9, 17, 18, 20 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\server-video-duration.ts` | Server-side video duration inspection | 9, 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\stage-video-guidance.ts` | Thirty-second stage limit | 9 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\[assetId]\route.ts` | Vendor media soft delete and restore | 17 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\media\[assetId]\download\route.ts` | Vendor-scoped media download | 9, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\[jobId]\actions\route.ts` | Assignment, release, resend, archive, and service-order deletion | 4, 5, 6, 7, 15, 17 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\vendor-job-actions.integration.test.ts` | Integration tests for vendor job actions and lifecycle auditing | 4, 5, 15, 17, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\[jobId]\approve\route.ts` | Manager package approval to admin review | 9, 10, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\[jobId]\approve\route.integration.test.ts` | Integration tests for manager package approval | 9, 10, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\[jobId]\reject\route.ts` | Manager rejection and correction state | 9, 10, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\jobs\[jobId]\reject\route.integration.test.ts` | Integration tests for manager package rejection | 9, 10, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\vendors\[vendorId]\employee-invites\route.ts` | Employee invitation creation and lifecycle auditing | 4, 5, 7, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\media-visibility.ts` | Moderation, visibility, and archive audience rules | 9, 10, 15, 17 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\proof-media-policy.ts` | Three-stage proof inclusion policy | 9, 10 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\admin\media\packages\[bookingId]\moderate\route.ts` | Admin package approve/reject/flag and effective visibility | 10, 15, 16 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\admin\media\[assetId]\moderate\route.ts` | Admin stage-level moderation and visibility override | 10, 15, 16 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\admin-media-moderation-queue.ts` | Admin moderation queue composition | 10, 16 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\ai\moderation-assistant.ts` | Metadata-only AI moderation recommendation | 12, 16, 20 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\ai\output-guards.ts` | Prevents AI claims of unsupported video review | 16, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\review-capture.ts` | Review-window creation, reopening, expiry, and ownership checks | 11, 14, 15 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\reviews\window\start\route.ts` | Completed/approved/consented review-window gate | 10, 11, 15 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\reviews\window\expire\route.ts` | Customer-triggered review-window expiry | 11, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\reviews\create\route.ts` | Authenticated review submission and moderation default | 11, 14, 15 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\reviews\route.ts` | Read-only generic review lookup and retired generic creation | 11, 15 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\admin\reviews\[reviewId]\moderate\route.ts` | Admin review publication/private/reject/flag actions and audit | 11, 15, 16 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\customer-booking-claim.ts` | Hashed, expiring customer work-order claim token | 3, 10, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\review-email-token.ts` | Signed, expiring quick-review link | 7, 11, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\auth-session.ts` | Signed and path-scoped user/admin session cookies | 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\auth.ts` | Request identity resolution and dev-only compatibility paths | 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\membership-auth.ts` | Active vendor manager/employee authorization | 4, 5, 15, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\admin-auth.ts` | Admin authorization | 15, 16, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\admin-audit.ts` | Admin audit-log compatibility writer | 14, 16, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\admin\account-actions\route.ts` | Admin suspension/deactivation and public unpublish | 16, 17 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\app\api\customer\profile\photo\route.ts` | Confirmed current use of physical blob deletion for profile photos, contrasted with service-media deletion | 17 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\src\lib\lifecycle-audit.ts` | Job and membership lifecycle audit wrapper | 5, 14, 18 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\prisma\schema.prisma` | Database models for users, vendors, bookings, consent, media, reviews, notifications, and audits | 14, 17, 18 | Both |
| `C:\Users\Cesar Olivera\Project Reliance\src\server\db.ts` | Prisma SQL Server connection layer | 14, 18, 20 | Summarized |
| `C:\Users\Cesar Olivera\Project Reliance\package.json` | Third-party runtime dependency inventory | 20 | Summarized |
