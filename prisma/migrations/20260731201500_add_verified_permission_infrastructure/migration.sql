ALTER TABLE [dbo].[booking_notifications]
  ADD [nextAttemptAt] DATETIME2 NULL,
      [leaseExpiresAt] DATETIME2 NULL,
      [deadLetteredAt] DATETIME2 NULL,
      [maxAttempts] INT NOT NULL CONSTRAINT [booking_notifications_maxAttempts_df] DEFAULT 4,
      [idempotencyKey] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[consent_records]
  ADD [lifecycleStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [consent_records_lifecycleStatus_df] DEFAULT N'PENDING',
      [generation] INT NOT NULL CONSTRAINT [consent_records_generation_df] DEFAULT 1,
      [isCurrent] BIT NOT NULL CONSTRAINT [consent_records_isCurrent_df] DEFAULT 0,
      [verifiedDecision] BIT NOT NULL CONSTRAINT [consent_records_verifiedDecision_df] DEFAULT 0,
      [legacyEvidence] BIT NOT NULL CONSTRAINT [consent_records_legacyEvidence_df] DEFAULT 0,
      [recipientName] NVARCHAR(1000) NULL,
      [recipientEmailHash] NVARCHAR(1000) NULL,
      [recipientPhoneHash] NVARCHAR(1000) NULL,
      [recipientEmailMasked] NVARCHAR(1000) NULL,
      [recipientPhoneMasked] NVARCHAR(1000) NULL,
      [recipientMismatch] BIT NOT NULL CONSTRAINT [consent_records_recipientMismatch_df] DEFAULT 0,
      [scopeJson] NVARCHAR(MAX) NULL,
      [scopeHash] NVARCHAR(1000) NULL,
      [audioEnabled] BIT NOT NULL CONSTRAINT [consent_records_audioEnabled_df] DEFAULT 0,
      [contentVersionId] NVARCHAR(1000) NULL,
      [supersededAt] DATETIME2 NULL,
      [wrongRecipientAt] DATETIME2 NULL;

CREATE TABLE [dbo].[consent_content_versions] (
  [id] NVARCHAR(1000) NOT NULL,
  [version] NVARCHAR(1000) NOT NULL,
  [contentJson] NVARCHAR(MAX) NOT NULL,
  [contentHash] NVARCHAR(1000) NOT NULL,
  [scopeSchemaVersion] NVARCHAR(1000) NOT NULL,
  [effectiveAt] DATETIME2 NOT NULL,
  [retiredAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_content_versions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [consent_content_versions_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [consent_content_versions_version_key]
  ON [dbo].[consent_content_versions]([version]);
CREATE UNIQUE INDEX [consent_content_versions_contentHash_key]
  ON [dbo].[consent_content_versions]([contentHash]);
CREATE INDEX [consent_content_versions_effectiveAt_retiredAt_idx]
  ON [dbo].[consent_content_versions]([effectiveAt], [retiredAt]);

IF NOT EXISTS (
  SELECT 1 FROM [dbo].[consent_content_versions]
  WHERE [version] = N'recording-permission-v1'
)
BEGIN
  INSERT INTO [dbo].[consent_content_versions] (
    [id], [version], [contentJson], [contentHash], [scopeSchemaVersion], [effectiveAt]
  ) VALUES (
    N'permission_content_recording_v1',
    N'recording-permission-v1',
    N'{"audio":"Audio is off.","decline":"You may decline or decide later. The service may continue without Reliance recording.","initialAudience":"The recordings start Private and are available to you and the service provider.","publication":"Public sharing is a separate decision after the recordings exist.","purpose":"Your service provider is asking to record proof of this service in Reliance.","stages":["Starting Condition","Work in Progress","Final Result"]}',
    N'a52a21a38b3832cc0d9b7cc6d4a430e593e6276b54a76cfe833a9ef9eb10cf0a',
    N'recording-scope-v1',
    CONVERT(DATETIME2, N'2026-07-31T00:00:00.000Z', 127)
  );
END;

CREATE TABLE [dbo].[consent_request_links] (
  [id] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NOT NULL,
  [secretHash] NVARCHAR(1000) NOT NULL,
  [generation] INT NOT NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [revokedAt] DATETIME2 NULL,
  [revocationReason] NVARCHAR(1000) NULL,
  [lastViewedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_request_links_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [consent_request_links_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [consent_request_links_consentRecordId_fkey]
    FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [consent_request_links_secretHash_key]
  ON [dbo].[consent_request_links]([secretHash]);
CREATE UNIQUE INDEX [consent_request_links_consentRecordId_generation_key]
  ON [dbo].[consent_request_links]([consentRecordId], [generation]);
CREATE INDEX [consent_request_links_consentRecordId_revokedAt_expiresAt_idx]
  ON [dbo].[consent_request_links]([consentRecordId], [revokedAt], [expiresAt]);

CREATE TABLE [dbo].[consent_verification_challenges] (
  [id] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NOT NULL,
  [requestLinkId] NVARCHAR(1000) NOT NULL,
  [channel] NVARCHAR(1000) NOT NULL,
  [destinationHash] NVARCHAR(1000) NOT NULL,
  [codeHash] NVARCHAR(1000) NOT NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [failedAttempts] INT NOT NULL CONSTRAINT [consent_verification_challenges_failedAttempts_df] DEFAULT 0,
  [maxAttempts] INT NOT NULL CONSTRAINT [consent_verification_challenges_maxAttempts_df] DEFAULT 5,
  [consumedAt] DATETIME2 NULL,
  [requestIpHash] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_verification_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [consent_verification_challenges_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [consent_verification_challenges_consentRecordId_fkey]
    FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [consent_verification_challenges_requestLinkId_fkey]
    FOREIGN KEY ([requestLinkId]) REFERENCES [dbo].[consent_request_links]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [consent_verification_challenges_consentRecordId_channel_createdAt_idx]
  ON [dbo].[consent_verification_challenges]([consentRecordId], [channel], [createdAt]);
CREATE INDEX [consent_verification_challenges_destinationHash_createdAt_idx]
  ON [dbo].[consent_verification_challenges]([destinationHash], [createdAt]);
CREATE INDEX [consent_verification_challenges_expiresAt_consumedAt_idx]
  ON [dbo].[consent_verification_challenges]([expiresAt], [consumedAt]);

CREATE TABLE [dbo].[consent_decision_sessions] (
  [id] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NOT NULL,
  [secretHash] NVARCHAR(1000) NOT NULL,
  [verificationMethod] NVARCHAR(1000) NOT NULL,
  [verifiedContactHash] NVARCHAR(1000) NULL,
  [verifiedUserId] NVARCHAR(1000) NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [consumedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_decision_sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [consent_decision_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [consent_decision_sessions_consentRecordId_fkey]
    FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [consent_decision_sessions_secretHash_key]
  ON [dbo].[consent_decision_sessions]([secretHash]);
CREATE INDEX [consent_decision_sessions_consentRecordId_expiresAt_consumedAt_idx]
  ON [dbo].[consent_decision_sessions]([consentRecordId], [expiresAt], [consumedAt]);

CREATE TABLE [dbo].[consent_decision_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NOT NULL,
  [decision] NVARCHAR(1000) NOT NULL,
  [actorUserId] NVARCHAR(1000) NULL,
  [claimedRole] NVARCHAR(1000) NOT NULL,
  [authorityScope] NVARCHAR(1000) NOT NULL,
  [verificationMethod] NVARCHAR(1000) NOT NULL,
  [verifiedContactHash] NVARCHAR(1000) NULL,
  [requestHash] NVARCHAR(1000) NOT NULL,
  [scopeHash] NVARCHAR(1000) NOT NULL,
  [contentHash] NVARCHAR(1000) NOT NULL,
  [contentVersion] NVARCHAR(1000) NOT NULL,
  [ipAddress] NVARCHAR(1000) NULL,
  [userAgent] NVARCHAR(1000) NULL,
  [metadata] NVARCHAR(MAX) NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [consent_decision_evidence_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [consent_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [consent_decision_evidence_consentRecordId_fkey]
    FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [consent_decision_evidence_consentRecordId_key]
  ON [dbo].[consent_decision_evidence]([consentRecordId]);
CREATE INDEX [consent_decision_evidence_decision_decidedAt_idx]
  ON [dbo].[consent_decision_evidence]([decision], [decidedAt]);
CREATE INDEX [consent_decision_evidence_actorUserId_decidedAt_idx]
  ON [dbo].[consent_decision_evidence]([actorUserId], [decidedAt]);

CREATE TABLE [dbo].[booking_notification_attempts] (
  [id] NVARCHAR(1000) NOT NULL,
  [notificationId] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NULL,
  [channel] NVARCHAR(1000) NOT NULL,
  [destinationMasked] NVARCHAR(1000) NULL,
  [status] NVARCHAR(1000) NOT NULL,
  [attemptNumber] INT NOT NULL,
  [providerMessageId] NVARCHAR(1000) NULL,
  [errorCode] NVARCHAR(1000) NULL,
  [errorMessage] NVARCHAR(MAX) NULL,
  [attemptedAt] DATETIME2 NOT NULL CONSTRAINT [booking_notification_attempts_attemptedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [booking_notification_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [booking_notification_attempts_notificationId_fkey]
    FOREIGN KEY ([notificationId]) REFERENCES [dbo].[booking_notifications]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [booking_notification_attempts_notificationId_channel_attemptNumber_key]
  ON [dbo].[booking_notification_attempts]([notificationId], [channel], [attemptNumber]);
CREATE INDEX [booking_notification_attempts_consentRecordId_attemptedAt_idx]
  ON [dbo].[booking_notification_attempts]([consentRecordId], [attemptedAt]);
CREATE INDEX [booking_notification_attempts_status_attemptedAt_idx]
  ON [dbo].[booking_notification_attempts]([status], [attemptedAt]);

CREATE INDEX [booking_notifications_status_nextAttemptAt_idx]
  ON [dbo].[booking_notifications]([status], [nextAttemptAt]);
CREATE INDEX [booking_notifications_idempotencyKey_idx]
  ON [dbo].[booking_notifications]([idempotencyKey]);

CREATE INDEX [consent_records_lifecycleStatus_expiresAt_idx]
  ON [dbo].[consent_records]([lifecycleStatus], [expiresAt]);
CREATE INDEX [consent_records_bookingId_isCurrent_idx]
  ON [dbo].[consent_records]([bookingId], [isCurrent]);
CREATE UNIQUE INDEX [consent_records_one_current_per_booking_key]
  ON [dbo].[consent_records]([bookingId])
  WHERE [isCurrent] = 1;
CREATE INDEX [consent_records_recipientEmailHash_idx]
  ON [dbo].[consent_records]([recipientEmailHash]);
CREATE INDEX [consent_records_recipientPhoneHash_idx]
  ON [dbo].[consent_records]([recipientPhoneHash]);
CREATE INDEX [consent_records_contentVersionId_idx]
  ON [dbo].[consent_records]([contentVersionId]);

ALTER TABLE [dbo].[consent_records]
  ADD CONSTRAINT [consent_records_contentVersionId_fkey]
  FOREIGN KEY ([contentVersionId]) REFERENCES [dbo].[consent_content_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
