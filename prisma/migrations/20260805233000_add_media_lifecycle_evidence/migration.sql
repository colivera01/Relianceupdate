CREATE TABLE [dbo].[media_lifecycle_cases] (
  [id] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL, [vendorId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NULL, [proposalId] NVARCHAR(1000) NULL, [mediaAssetId] NVARCHAR(1000) NULL,
  [contentReportId] NVARCHAR(1000) NULL, [category] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_cases_status_df] DEFAULT N'SUBMITTED',
  [exposureOutcome] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_cases_exposure_df] DEFAULT N'RESTRICTED',
  [reasonDetail] NVARCHAR(MAX) NULL, [openedByUserId] NVARCHAR(1000) NOT NULL, [openedByRole] NVARCHAR(1000) NOT NULL,
  [assignedAdminUserId] NVARCHAR(1000) NULL, [decision] NVARCHAR(1000) NULL, [decisionReason] NVARCHAR(MAX) NULL,
  [lifecycleVersion] INT NOT NULL CONSTRAINT [media_lifecycle_cases_version_df] DEFAULT 1,
  [submittedAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_cases_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [restrictedAt] DATETIME2 NULL, [decidedAt] DATETIME2 NULL, [finalizedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_cases_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_lifecycle_cases_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [media_lifecycle_cases_booking_status_idx] ON [dbo].[media_lifecycle_cases]([bookingId], [status], [createdAt]);
CREATE INDEX [media_lifecycle_cases_vendor_status_idx] ON [dbo].[media_lifecycle_cases]([vendorId], [status], [createdAt]);
CREATE INDEX [media_lifecycle_cases_asset_status_idx] ON [dbo].[media_lifecycle_cases]([mediaAssetId], [status]);
CREATE INDEX [media_lifecycle_cases_admin_status_idx] ON [dbo].[media_lifecycle_cases]([assignedAdminUserId], [status]);

CREATE TABLE [dbo].[media_lifecycle_restrictions] (
  [id] NVARCHAR(1000) NOT NULL, [caseId] NVARCHAR(1000) NULL, [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL, [mediaAssetId] NVARCHAR(1000) NULL, [scope] NVARCHAR(1000) NOT NULL,
  [outcome] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_restrictions_outcome_df] DEFAULT N'RESTRICTED',
  [reasonCode] NVARCHAR(1000) NOT NULL, [active] BIT NOT NULL CONSTRAINT [media_lifecycle_restrictions_active_df] DEFAULT 1,
  [appliedByUserId] NVARCHAR(1000) NOT NULL, [appliedByRole] NVARCHAR(1000) NOT NULL,
  [appliedAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_restrictions_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [releasedByUserId] NVARCHAR(1000) NULL, [releasedAt] DATETIME2 NULL, [releaseReason] NVARCHAR(MAX) NULL,
  [evidenceHash] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_restrictions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [media_lifecycle_restrictions_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [media_lifecycle_restrictions_booking_idx] ON [dbo].[media_lifecycle_restrictions]([bookingId], [active], [scope]);
CREATE INDEX [media_lifecycle_restrictions_asset_idx] ON [dbo].[media_lifecycle_restrictions]([mediaAssetId], [active], [scope]);
CREATE INDEX [media_lifecycle_restrictions_case_idx] ON [dbo].[media_lifecycle_restrictions]([caseId], [active]);
CREATE INDEX [media_lifecycle_restrictions_hash_idx] ON [dbo].[media_lifecycle_restrictions]([evidenceHash]);

CREATE TABLE [dbo].[media_withdrawal_evidence] (
  [id] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL, [vendorId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NULL, [proposalId] NVARCHAR(1000) NULL, [stageId] NVARCHAR(1000) NULL,
  [mediaAssetId] NVARCHAR(1000) NULL, [actorUserId] NVARCHAR(1000) NOT NULL, [actorRole] NVARCHAR(1000) NOT NULL,
  [authorityType] NVARCHAR(1000) NOT NULL, [scope] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_withdrawal_evidence_status_df] DEFAULT N'APPLIED',
  [reason] NVARCHAR(MAX) NULL, [evidenceHash] NVARCHAR(1000) NOT NULL,
  [appliedAt] DATETIME2 NOT NULL CONSTRAINT [media_withdrawal_evidence_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [supersededAt] DATETIME2 NULL, [supersededById] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_withdrawal_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [media_withdrawal_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [media_withdrawal_booking_idx] ON [dbo].[media_withdrawal_evidence]([bookingId], [scope], [status], [appliedAt]);
CREATE INDEX [media_withdrawal_asset_idx] ON [dbo].[media_withdrawal_evidence]([mediaAssetId], [scope], [status]);
CREATE INDEX [media_withdrawal_actor_idx] ON [dbo].[media_withdrawal_evidence]([actorUserId], [appliedAt]);
CREATE INDEX [media_withdrawal_hash_idx] ON [dbo].[media_withdrawal_evidence]([evidenceHash]);

CREATE TABLE [dbo].[media_retention_schedules] (
  [id] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL, [vendorId] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NOT NULL, [materialClass] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_retention_schedules_status_df] DEFAULT N'ACTIVE',
  [retainUntil] DATETIME2 NULL, [evidenceRetainUntil] DATETIME2 NULL,
  [approvalActive] BIT NOT NULL CONSTRAINT [media_retention_schedules_approval_df] DEFAULT 0,
  [scheduledAt] DATETIME2 NOT NULL CONSTRAINT [media_retention_schedules_scheduledAt_df] DEFAULT CURRENT_TIMESTAMP,
  [lastEvaluatedAt] DATETIME2 NULL, [dispositionReason] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_retention_schedules_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_retention_schedules_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [media_retention_schedules_asset_key] UNIQUE NONCLUSTERED ([mediaAssetId])
);
CREATE INDEX [media_retention_schedules_due_idx] ON [dbo].[media_retention_schedules]([status], [retainUntil]);
CREATE INDEX [media_retention_schedules_booking_idx] ON [dbo].[media_retention_schedules]([bookingId], [status]);

CREATE TABLE [dbo].[media_evidence_holds] (
  [id] NVARCHAR(1000) NOT NULL, [caseId] NVARCHAR(1000) NULL, [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL, [mediaAssetId] NVARCHAR(1000) NULL, [scopeJson] NVARCHAR(MAX) NOT NULL,
  [purpose] NVARCHAR(MAX) NOT NULL, [authority] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_evidence_holds_status_df] DEFAULT N'ACTIVE',
  [startedByUserId] NVARCHAR(1000) NOT NULL,
  [startedAt] DATETIME2 NOT NULL CONSTRAINT [media_evidence_holds_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [reviewDueAt] DATETIME2 NOT NULL, [releasedByUserId] NVARCHAR(1000) NULL, [releasedAt] DATETIME2 NULL,
  [releaseReason] NVARCHAR(MAX) NULL, [evidenceHash] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_evidence_holds_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_evidence_holds_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [media_evidence_holds_booking_idx] ON [dbo].[media_evidence_holds]([bookingId], [status], [reviewDueAt]);
CREATE INDEX [media_evidence_holds_asset_idx] ON [dbo].[media_evidence_holds]([mediaAssetId], [status]);
CREATE INDEX [media_evidence_holds_case_idx] ON [dbo].[media_evidence_holds]([caseId], [status]);

CREATE TABLE [dbo].[media_deletion_requests] (
  [id] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL, [vendorId] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NOT NULL, [requestedByUserId] NVARCHAR(1000) NOT NULL, [requestedByRole] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_deletion_requests_status_df] DEFAULT N'REQUESTED',
  [reason] NVARCHAR(MAX) NULL,
  [requestedAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_requests_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [restrictedAt] DATETIME2 NULL, [reviewedByUserId] NVARCHAR(1000) NULL, [reviewedAt] DATETIME2 NULL,
  [deniedReason] NVARCHAR(MAX) NULL, [completedAt] DATETIME2 NULL, [evidenceHash] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_deletion_requests_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [media_deletion_requests_booking_idx] ON [dbo].[media_deletion_requests]([bookingId], [status], [requestedAt]);
CREATE INDEX [media_deletion_requests_asset_idx] ON [dbo].[media_deletion_requests]([mediaAssetId], [status]);
CREATE INDEX [media_deletion_requests_vendor_idx] ON [dbo].[media_deletion_requests]([vendorId], [status]);

CREATE TABLE [dbo].[media_deletion_jobs] (
  [id] NVARCHAR(1000) NOT NULL, [deletionRequestId] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL, [mediaAssetId] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_deletion_jobs_status_df] DEFAULT N'QUEUED',
  [attemptCount] INT NOT NULL CONSTRAINT [media_deletion_jobs_attemptCount_df] DEFAULT 0,
  [maxAttempts] INT NOT NULL CONSTRAINT [media_deletion_jobs_maxAttempts_df] DEFAULT 5,
  [nextAttemptAt] DATETIME2 NULL, [leaseExpiresAt] DATETIME2 NULL, [verifiedAbsentAt] DATETIME2 NULL,
  [lastErrorCode] NVARCHAR(1000) NULL, [lastErrorDetail] NVARCHAR(MAX) NULL, [completedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_jobs_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_deletion_jobs_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [media_deletion_jobs_request_key] UNIQUE NONCLUSTERED ([deletionRequestId])
);
CREATE INDEX [media_deletion_jobs_due_idx] ON [dbo].[media_deletion_jobs]([status], [nextAttemptAt]);
CREATE INDEX [media_deletion_jobs_asset_idx] ON [dbo].[media_deletion_jobs]([mediaAssetId], [status]);

CREATE TABLE [dbo].[media_deletion_attempts] (
  [id] NVARCHAR(1000) NOT NULL, [deletionJobId] NVARCHAR(1000) NOT NULL, [attemptNumber] INT NOT NULL,
  [status] NVARCHAR(1000) NOT NULL, [deleteAccepted] BIT NOT NULL CONSTRAINT [media_deletion_attempts_delete_df] DEFAULT 0,
  [verifiedAbsent] BIT NOT NULL CONSTRAINT [media_deletion_attempts_absent_df] DEFAULT 0,
  [errorCode] NVARCHAR(1000) NULL, [errorDetail] NVARCHAR(MAX) NULL,
  [startedAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_attempts_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [finishedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_attempts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [media_deletion_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [media_deletion_attempts_job_number_key] UNIQUE NONCLUSTERED ([deletionJobId], [attemptNumber])
);
CREATE INDEX [media_deletion_attempts_job_idx] ON [dbo].[media_deletion_attempts]([deletionJobId], [createdAt]);

CREATE TABLE [dbo].[media_lifecycle_appeals] (
  [id] NVARCHAR(1000) NOT NULL, [caseId] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL, [appellantUserId] NVARCHAR(1000) NOT NULL, [appellantRole] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_appeals_status_df] DEFAULT N'SUBMITTED',
  [reason] NVARCHAR(MAX) NOT NULL, [reviewerUserId] NVARCHAR(1000) NULL, [decision] NVARCHAR(1000) NULL,
  [decisionReason] NVARCHAR(MAX) NULL,
  [submittedAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_appeals_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [decidedAt] DATETIME2 NULL, [evidenceHash] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_appeals_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_lifecycle_appeals_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [media_lifecycle_appeals_case_actor_key] UNIQUE NONCLUSTERED ([caseId], [appellantUserId])
);
CREATE INDEX [media_lifecycle_appeals_status_idx] ON [dbo].[media_lifecycle_appeals]([status], [submittedAt]);
CREATE INDEX [media_lifecycle_appeals_booking_idx] ON [dbo].[media_lifecycle_appeals]([bookingId], [status]);

CREATE TABLE [dbo].[media_lifecycle_audit_events] (
  [id] NVARCHAR(1000) NOT NULL, [bookingId] NVARCHAR(1000) NOT NULL, [vendorId] NVARCHAR(1000) NOT NULL,
  [caseId] NVARCHAR(1000) NULL, [mediaAssetId] NVARCHAR(1000) NULL, [actorUserId] NVARCHAR(1000) NULL,
  [actorRole] NVARCHAR(1000) NOT NULL, [eventType] NVARCHAR(1000) NOT NULL, [priorState] NVARCHAR(1000) NULL,
  [resultingState] NVARCHAR(1000) NOT NULL, [evidenceHash] NVARCHAR(1000) NOT NULL,
  [metadataJson] NVARCHAR(MAX) NOT NULL, [ipAddress] NVARCHAR(1000) NULL, [userAgent] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_audit_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [media_lifecycle_audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [media_lifecycle_audit_booking_idx] ON [dbo].[media_lifecycle_audit_events]([bookingId], [createdAt]);
CREATE INDEX [media_lifecycle_audit_case_idx] ON [dbo].[media_lifecycle_audit_events]([caseId], [createdAt]);
CREATE INDEX [media_lifecycle_audit_asset_idx] ON [dbo].[media_lifecycle_audit_events]([mediaAssetId], [createdAt]);
CREATE INDEX [media_lifecycle_audit_type_idx] ON [dbo].[media_lifecycle_audit_events]([eventType], [createdAt]);
CREATE INDEX [media_lifecycle_audit_hash_idx] ON [dbo].[media_lifecycle_audit_events]([evidenceHash]);
