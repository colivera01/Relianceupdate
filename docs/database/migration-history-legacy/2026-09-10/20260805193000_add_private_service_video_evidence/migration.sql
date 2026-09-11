ALTER TABLE [dbo].[media_assets]
ADD [uploadState] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_uploadState_df] DEFAULT N'SAVED',
    [contentHash] NVARCHAR(1000) NULL,
    [hashAlgorithm] NVARCHAR(1000) NULL CONSTRAINT [media_assets_hashAlgorithm_df] DEFAULT N'SHA-256',
    [captureProvenance] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_captureProvenance_df] DEFAULT N'LEGACY_UNKNOWN',
    [stageVersion] INT NULL,
    [replacesMediaAssetId] NVARCHAR(1000) NULL,
    [publicEligible] BIT NULL;

CREATE INDEX [media_assets_contentHash_idx] ON [dbo].[media_assets]([contentHash]);
CREATE INDEX [media_assets_replacesMediaAssetId_idx] ON [dbo].[media_assets]([replacesMediaAssetId]);

ALTER TABLE [dbo].[media_sessions]
ADD [recordingGateDecisionId] NVARCHAR(1000) NULL,
    [capturedByMembershipId] NVARCHAR(1000) NULL;

CREATE INDEX [media_sessions_recordingGateDecisionId_idx]
  ON [dbo].[media_sessions]([recordingGateDecisionId]);

CREATE TABLE [dbo].[recording_gate_decision_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [assessmentGeneration] INT NOT NULL,
  [scopeHash] NVARCHAR(1000) NOT NULL,
  [permissionBasis] NVARCHAR(1000) NOT NULL,
  [permissionEvidenceId] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NULL,
  [certificationId] NVARCHAR(1000) NOT NULL,
  [membershipId] NVARCHAR(1000) NOT NULL,
  [assignmentGeneration] INT NOT NULL,
  [locationAttemptId] NVARCHAR(1000) NULL,
  [locationExceptionId] NVARCHAR(1000) NULL,
  [surface] NVARCHAR(1000) NOT NULL,
  [actorKind] NVARCHAR(1000) NULL,
  [decision] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_gate_decision_evidence_decision_df] DEFAULT N'ALLOWED',
  [evidenceHash] NVARCHAR(1000) NOT NULL,
  [snapshotJson] NVARCHAR(MAX) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_gate_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [recording_gate_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [recording_gate_decision_evidence_bookingId_createdAt_idx] ON [dbo].[recording_gate_decision_evidence]([bookingId], [createdAt]);
CREATE INDEX [recording_gate_decision_evidence_vendorId_createdAt_idx] ON [dbo].[recording_gate_decision_evidence]([vendorId], [createdAt]);
CREATE INDEX [recording_gate_decision_evidence_assessmentId_membershipId_idx] ON [dbo].[recording_gate_decision_evidence]([assessmentId], [membershipId]);
CREATE INDEX [recording_gate_decision_evidence_evidenceHash_idx] ON [dbo].[recording_gate_decision_evidence]([evidenceHash]);

CREATE TABLE [dbo].[media_upload_attempts] (
  [id] NVARCHAR(1000) NOT NULL,
  [assetId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [mediaSessionId] NVARCHAR(1000) NOT NULL,
  [membershipId] NVARCHAR(1000) NOT NULL,
  [stage] NVARCHAR(1000) NOT NULL,
  [captureProvenance] NVARCHAR(1000) NOT NULL,
  [state] NVARCHAR(1000) NOT NULL CONSTRAINT [media_upload_attempts_state_df] DEFAULT N'UPLOADING',
  [blobKey] NVARCHAR(1000) NOT NULL,
  [expectedBytes] BIGINT NOT NULL,
  [actualBytes] BIGINT NULL,
  [mimeType] NVARCHAR(1000) NOT NULL,
  [durationSeconds] FLOAT(53) NULL,
  [failureCode] NVARCHAR(1000) NULL,
  [failureMessage] NVARCHAR(1000) NULL,
  [attemptCount] INT NOT NULL CONSTRAINT [media_upload_attempts_attemptCount_df] DEFAULT 1,
  [savedAt] DATETIME2 NULL,
  [rejectedAt] DATETIME2 NULL,
  [retryRequiredAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_upload_attempts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [media_upload_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [media_upload_attempts_assetId_key] UNIQUE NONCLUSTERED ([assetId])
);
CREATE INDEX [media_upload_attempts_bookingId_stage_createdAt_idx] ON [dbo].[media_upload_attempts]([bookingId], [stage], [createdAt]);
CREATE INDEX [media_upload_attempts_mediaSessionId_state_idx] ON [dbo].[media_upload_attempts]([mediaSessionId], [state]);
CREATE INDEX [media_upload_attempts_vendorId_state_updatedAt_idx] ON [dbo].[media_upload_attempts]([vendorId], [state], [updatedAt]);

CREATE TABLE [dbo].[service_video_stage_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [stage] NVARCHAR(1000) NOT NULL,
  [stageVersion] INT NOT NULL,
  [isCurrent] BIT NOT NULL CONSTRAINT [service_video_stage_evidence_isCurrent_df] DEFAULT 1,
  [mediaSessionId] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NOT NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [assessmentGeneration] INT NOT NULL,
  [permissionBasis] NVARCHAR(1000) NOT NULL,
  [permissionEvidenceId] NVARCHAR(1000) NOT NULL,
  [recordingGateDecisionId] NVARCHAR(1000) NOT NULL,
  [employeeMembershipId] NVARCHAR(1000) NOT NULL,
  [captureProvenance] NVARCHAR(1000) NOT NULL,
  [contentHash] NVARCHAR(1000) NOT NULL,
  [hashAlgorithm] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_stage_evidence_hashAlgorithm_df] DEFAULT N'SHA-256',
  [verifiedDurationSeconds] FLOAT(53) NOT NULL,
  [uploadState] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_stage_evidence_uploadState_df] DEFAULT N'SAVED',
  [replacesStageEvidenceId] NVARCHAR(1000) NULL,
  [publicEligible] BIT NOT NULL CONSTRAINT [service_video_stage_evidence_publicEligible_df] DEFAULT 0,
  [savedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_stage_evidence_savedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_stage_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_stage_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_stage_evidence_mediaAssetId_key] UNIQUE NONCLUSTERED ([mediaAssetId]),
  CONSTRAINT [service_video_stage_evidence_bookingId_stage_stageVersion_key] UNIQUE NONCLUSTERED ([bookingId], [stage], [stageVersion])
);
CREATE INDEX [service_video_stage_evidence_bookingId_isCurrent_idx] ON [dbo].[service_video_stage_evidence]([bookingId], [isCurrent]);
CREATE INDEX [service_video_stage_evidence_recordingGateDecisionId_idx] ON [dbo].[service_video_stage_evidence]([recordingGateDecisionId]);
CREATE INDEX [service_video_stage_evidence_contentHash_idx] ON [dbo].[service_video_stage_evidence]([contentHash]);

CREATE TABLE [dbo].[service_video_package_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [version] INT NOT NULL,
  [isCurrent] BIT NOT NULL CONSTRAINT [service_video_package_evidence_isCurrent_df] DEFAULT 1,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_package_evidence_status_df] DEFAULT N'AWAITING_MANAGER_REVIEW',
  [stageEvidenceJson] NVARCHAR(MAX) NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [submittedByUserId] NVARCHAR(1000) NULL,
  [submittedByMembershipId] NVARCHAR(1000) NOT NULL,
  [submittedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_evidence_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [managerDecisionId] NVARCHAR(1000) NULL,
  [customerAccessGrantId] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [service_video_package_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_package_evidence_bookingId_version_key] UNIQUE NONCLUSTERED ([bookingId], [version])
);
CREATE INDEX [service_video_package_evidence_bookingId_isCurrent_idx] ON [dbo].[service_video_package_evidence]([bookingId], [isCurrent]);
CREATE INDEX [service_video_package_evidence_vendorId_status_updatedAt_idx] ON [dbo].[service_video_package_evidence]([vendorId], [status], [updatedAt]);
CREATE INDEX [service_video_package_evidence_packageHash_idx] ON [dbo].[service_video_package_evidence]([packageHash]);

CREATE TABLE [dbo].[service_video_manager_decision_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [decision] NVARCHAR(1000) NOT NULL,
  [targetedStagesJson] NVARCHAR(MAX) NOT NULL,
  [reason] NVARCHAR(1000) NULL,
  [managerUserId] NVARCHAR(1000) NOT NULL,
  [managerMembershipId] NVARCHAR(1000) NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_manager_decision_evidence_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_manager_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_manager_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [service_video_manager_decision_evidence_packageId_decidedAt_idx] ON [dbo].[service_video_manager_decision_evidence]([packageId], [decidedAt]);
CREATE INDEX [service_video_manager_decision_evidence_bookingId_decidedAt_idx] ON [dbo].[service_video_manager_decision_evidence]([bookingId], [decidedAt]);

CREATE TABLE [dbo].[private_proof_access_grants] (
  [id] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [customerUserId] NVARCHAR(1000) NOT NULL,
  [managerDecisionId] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [private_proof_access_grants_status_df] DEFAULT N'ACTIVE',
  [grantedByUserId] NVARCHAR(1000) NOT NULL,
  [grantedAt] DATETIME2 NOT NULL CONSTRAINT [private_proof_access_grants_grantedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [revokedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [private_proof_access_grants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [private_proof_access_grants_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [private_proof_access_grants_packageId_key] UNIQUE NONCLUSTERED ([packageId])
);
CREATE INDEX [private_proof_access_grants_bookingId_customerUserId_status_idx] ON [dbo].[private_proof_access_grants]([bookingId], [customerUserId], [status]);
CREATE INDEX [private_proof_access_grants_vendorId_status_grantedAt_idx] ON [dbo].[private_proof_access_grants]([vendorId], [status], [grantedAt]);

CREATE TABLE [dbo].[private_proof_access_events] (
  [id] NVARCHAR(1000) NOT NULL,
  [accessGrantId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NULL,
  [actorUserId] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(1000) NOT NULL,
  [ipAddress] NVARCHAR(1000) NULL,
  [userAgent] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [private_proof_access_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [private_proof_access_events_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [private_proof_access_events_accessGrantId_createdAt_idx] ON [dbo].[private_proof_access_events]([accessGrantId], [createdAt]);
CREATE INDEX [private_proof_access_events_bookingId_actorUserId_createdAt_idx] ON [dbo].[private_proof_access_events]([bookingId], [actorUserId], [createdAt]);
