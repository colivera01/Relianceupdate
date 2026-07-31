# Consent-Related Database Models Snapshot

- Original repository path: `C:\Users\Cesar Olivera\Project Reliance\prisma\schema.prisma`
- Source lines: selected excerpts from 23-114, 230-284, 323-370, 375-473, 543-595, 615-681, 698-772, 839-967
- Snapshot type: Carefully labeled excerpts
- Production data included: No

## ConsentRecord, lines 925-954

```prisma
model ConsentRecord {
  id             String   @id @default(cuid())
  token          String   @unique
  bookingId      String?
  vendorId       String
  mediaSessionId String?
  consentType    String
  status         String
  requestedAt    DateTime @default(now())
  acceptedAt     DateTime?
  declinedAt     DateTime?
  expiresAt      DateTime?
  termsVersion   String?
  privacyVersion String?
  ipAddress      String?
  userAgent      String?
  documentHash   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

## ConsentEvent, lines 956-967

```prisma
model ConsentEvent {
  id              String   @id @default(cuid())
  consentRecordId String
  eventType       String
  metadata        String?
  createdAt       DateTime @default(now())
}
```

## Related records

- `Booking` links customer, vendor, service, consent records, media sessions, reviews, and notifications. A large amount of compliance state is stored in `customerMetadata` JSON.
- `BookingNotification` stores kind, status, attempt count, channel JSON, last error, last attempt, and sent time.
- `MediaSession` links a booking, stage, employee/user, service, and uploaded assets.
- `MediaAsset` stores blob key/URL, byte count, MIME type, moderation, visibility, archive, and soft-delete state.
- `ReviewWindow` stores open/expire/close state and an optional linked review.
- `Review` stores rating/comment, source, submission channel, attribution, moderation, and visibility.
- `AdminAuditLog` stores actor, action, entity, old/new values, metadata, and time.

## Evidence gaps in the schema

There is no consent signer user ID, verified contact, signature, OTP challenge, guardian/minor field, withdrawal timestamp, withdrawal reason, exact rendered consent text, immutable legal-document revision entity, audio-specific consent, or general registration agreement record. Consent and invite tokens are stored raw in their tables, while customer booking claim and email-verification tokens use hashes.
