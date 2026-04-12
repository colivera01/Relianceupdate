# Schema Map

**Last refreshed:** 2026-04-12.

Source of truth: `prisma/schema.prisma`.

## All models/entities and fields

### Vendor
- `id`, `firstName`, `lastName`, `name`, `businessName`, `businessType`, `category`, `foundedYear`, `email`, `phone`, `city`, `state`, `address`, `zipCode`, `bio`, `website`, `licenseNumber`, `insuranceStatus`, `insuranceProvider`, `insuranceExpiry`, `bondingStatus`, `emergencyContact`, `responseTimeSettings`, `profilePhoto`, `serviceTypes`, `specializations`, `serviceAreas`, `paymentsEnabled`, `reminders_review`, `reminders_invoice`, `reminders_maintenance`, `reminders_followUp`, `notifications_job`, `notifications_review`, `notifications_payout`, `notifications_support`, `notifications_marketing`, `notifications_updates`, `twoFactorEnabled`, `loginNotifications`, `sessionTimeout`, `passwordExpiry`, `failedLoginLockout`, `createdAt`, `updatedAt`, `demo`, `seedBatchId`, `planKey`, `storageLimitBytes`, `isOverLimit`, `overLimitSince`, `isPubliclyListed`, `publiclyListedAt`

### Employee
- `id`, `vendorId`, `name`, `email`, `role`, `photoUrl`, `createdAt`, `updatedAt`, `demo`, `seedBatchId`

### Service
- `id`, `vendorId`, `name`, `description`, `price`, `createdAt`, `updatedAt`, `demo`, `seedBatchId`, `isPublished`, `publishedAt`

### User
- `id`, `name`, `email`, `phone`, `createdAt`, `updatedAt`, `demo`, `seedBatchId`

### Booking
- `id`, `userId`, `serviceId`, `vendorId`, `title`, `clientName`, `amount`, `status`, `scheduledFor`, `date`, `createdAt`, `updatedAt`, `demo`, `seedBatchId`

### Review
- `id`, `userId`, `vendorId`, `bookingId`, `mediaSessionId`, `clientName`, `jobType`, `rating`, `comment`, `source`, `submittedVia`, `moderationStatus`, `visibilityStatus`, `moderationReason`, `moderatedAt`, `moderatedByUserId`, `date`, `createdAt`, `updatedAt`, `demo`, `seedBatchId`

### Device
- `id`, `vendorId`, `deviceUid`, `deviceType`, `pairedAt`, `lastSeenAt`, `isActive`, `firmwareVersion`, `model`, `os`, `appVersion`

### DevicePairingCode
- `id`, `vendorId`, `code`, `expiresAt`, `used`, `createdAt`

### VendorMembership
- `id`, `vendorId`, `userId`, `role`, `status`, `badgeId`, `requestedAt`, `approvedAt`, `approvedByUserId`, `deniedAt`, `deniedByUserId`, `revokedAt`, `revokedByUserId`, `pendingPhoneDeviceUid`, `pendingDeviceModel`, `pendingDeviceOs`, `pendingAppVersion`

### VendorInvite
- `id`, `vendorId`, `code`, `token`, `createdByUserId`, `expiresAt`, `maxUses`, `usesCount`, `isActive`, `createdAt`

### DeviceAssignment
- `id`, `vendorId`, `deviceId`, `membershipId`, `assignedAt`, `unassignedAt`, `assignedByUserId`

### MediaAsset
- `id`, `vendorId`, `mediaSessionId`, `membershipId`, `uploadedByMembershipId`, `deviceId`, `bytes`, `mimeType`, `blobKey`, `blobUrl`, `moderationStatus`, `visibilityStatus`, `archiveStatus`, `moderationReason`, `moderatedAt`, `moderatedByUserId`, `deletedAt`, `createdAt`, `updatedAt`

### MediaSession
- `id`, `vendorId`, `userId`, `employeeId`, `bookingId`, `serviceId`, `deviceId`, `deviceType`, `sessionType`, `status`, `title`, `description`, `startedAt`, `endedAt`, `createdAt`, `updatedAt`

### VendorStorageAlert
- `id`, `vendorId`, `threshold`, `sentAt`

### AdminNotification
- `id`, `vendorId`, `type`, `title`, `message`, `metadata`, `read`, `createdAt`

### AdminAuditLog
- `id`, `actionType`, `entityType`, `entityId`, `actorUserId`, `previousValue`, `newValue`, `metadata`, `createdAt`

### Favorite
- `id`, `userId`, `serviceId`, `createdAt`, `updatedAt`

### ReviewWindow
- `id`, `bookingId`, `vendorId`, `mediaSessionId`, `reviewId`, `status`, `openedAt`, `expiresAt`, `closedAt`, `createdAt`, `updatedAt`

### ReviewPromptEvent
- `id`, `reviewWindowId`, `eventType`, `metadata`, `createdAt`

### ReviewSentiment
- `id`, `reviewWindowId`, `sentiment`, `createdAt`

### ConsentRecord
- `id`, `token`, `bookingId`, `vendorId`, `mediaSessionId`, `consentType`, `status`, `requestedAt`, `acceptedAt`, `declinedAt`, `expiresAt`, `termsVersion`, `privacyVersion`, `ipAddress`, `userAgent`, `documentHash`, `createdAt`, `updatedAt`

### ConsentEvent
- `id`, `consentRecordId`, `eventType`, `metadata`, `createdAt`

## Key relationships
- `Vendor` is the root aggregate for operational entities (`Employee`, `Service`, `Booking`, `Review`, `Device`, `VendorMembership`, `VendorInvite`, `DeviceAssignment`, `MediaAsset`, `MediaSession`, `VendorStorageAlert`, `AdminNotification`).
- `User` participates through `Booking`, `Review`, `VendorMembership`, `Favorite`, and optional `MediaSession` ownership.
- `Favorite` creates many-to-many linkage between `User` and `Service` with uniqueness on `(userId, serviceId)`.
- `VendorMembership` links team users to vendors; `DeviceAssignment` links assigned headset device to a specific membership.
- `MediaSession` can associate with `Booking`, `Service`, `Employee`, `User`, and `Device`; `MediaAsset` links back to `MediaSession`; `MediaSession` has `reviewWindows` and `consentRecords`.
- `ReviewWindow` ties a booking/vendor/media session to optional `Review`; prompt events and sentiment rows hang off the window.
- `ConsentRecord` + `ConsentEvent` capture tokenized consent for a booking/media session; feeds gating for review window start in APIs.
- `AdminAuditLog` (`entityType` includes `notification` for outbound comms attempts) and moderation/publish fields on `Review` and `MediaAsset` support governance.

## Missing fields needed by current UI
- Booking workflow gaps:
  - `Booking.employeeId` (assignment owner)
  - `Booking.startedAt`, `Booking.completedAt`, `Booking.canceledAt`
  - `Booking.notes` or `internalNotes` for job timeline UX
- Device/member linkage hardening:
  - explicit active phone binding on membership (for example `VendorMembership.phoneDeviceId`)
  - explicit device display name (for example `Device.name`)
- UI detail parity:
  - vendor/service metrics currently synthesized in APIs; optional denormalized counters could reduce expensive queries (`serviceCount`, `publicMediaCount`, `publicReviewCount`)

## Missing fields needed for media, mobile, and headset support

### Media
- `MediaAsset.durationMs`
- `MediaAsset.width`, `MediaAsset.height`
- `MediaAsset.thumbnailBlobKey`, `MediaAsset.thumbnailUrl`
- `MediaAsset.codec`, `MediaAsset.container`
- `MediaAsset.checksum`
- `MediaAsset.processingStatus` (uploaded/transcoding/failed/ready)

### Mobile capture + session diagnostics
- `MediaSession.captureSource` (phone/headset/manual)
- `MediaSession.failureReason`, `MediaSession.errorCode`
- `MediaSession.phoneDeviceUidSnapshot`, `MediaSession.headsetDeviceUidSnapshot`
- `MediaSession.consentCapturedAt` (if policy requires)

### Headset/device reliability
- `Device.batteryLevel`
- `Device.networkType` or `networkQuality`
- `Device.lastHeartbeatAt`
- optional `Device.userAgent` snapshot for phone-captured assets
