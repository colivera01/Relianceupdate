CREATE TABLE [dbo].[service_video_publication_proposals] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [packageVersion] INT NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [version] INT NOT NULL,
  [isCurrent] BIT NOT NULL CONSTRAINT [service_video_publication_proposals_isCurrent_df] DEFAULT 1,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_proposals_status_df] DEFAULT N'AWAITING_CUSTOMER_DECISION',
  [audience] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_proposals_audience_df] DEFAULT N'PUBLIC',
  [proposalHash] NVARCHAR(1000) NOT NULL,
  [proposedByUserId] NVARCHAR(1000) NOT NULL,
  [proposedByMembershipId] NVARCHAR(1000) NOT NULL,
  [submittedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_proposals_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [supersededAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_proposals_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [service_video_publication_proposals_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_publication_proposals_bookingId_version_key] UNIQUE NONCLUSTERED ([bookingId], [version])
);
CREATE INDEX [service_video_publication_proposals_bookingId_isCurrent_idx] ON [dbo].[service_video_publication_proposals]([bookingId], [isCurrent]);
CREATE INDEX [service_video_publication_proposals_vendorId_status_updatedAt_idx] ON [dbo].[service_video_publication_proposals]([vendorId], [status], [updatedAt]);
CREATE INDEX [service_video_publication_proposals_packageId_packageHash_idx] ON [dbo].[service_video_publication_proposals]([packageId], [packageHash]);
CREATE INDEX [service_video_publication_proposals_proposalHash_idx] ON [dbo].[service_video_publication_proposals]([proposalHash]);

CREATE TABLE [dbo].[service_video_publication_stages] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [stage] NVARCHAR(1000) NOT NULL,
  [stageEvidenceId] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NOT NULL,
  [stageVersion] INT NOT NULL,
  [contentHash] NVARCHAR(1000) NOT NULL,
  [presentationJson] NVARCHAR(MAX) NOT NULL,
  [presentationHash] NVARCHAR(1000) NOT NULL,
  [containsCustomerLikeness] BIT NOT NULL CONSTRAINT [service_video_publication_stages_customerLikeness_df] DEFAULT 0,
  [containsEmployeeLikeness] BIT NOT NULL CONSTRAINT [service_video_publication_stages_employeeLikeness_df] DEFAULT 0,
  [containsMinor] BIT NOT NULL CONSTRAINT [service_video_publication_stages_minor_df] DEFAULT 0,
  [containsBystander] BIT NOT NULL CONSTRAINT [service_video_publication_stages_bystander_df] DEFAULT 0,
  [includesAudio] BIT NOT NULL CONSTRAINT [service_video_publication_stages_audio_df] DEFAULT 0,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_stages_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_publication_stages_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_publication_stages_proposalId_stage_key] UNIQUE NONCLUSTERED ([proposalId], [stage])
);
CREATE INDEX [service_video_publication_stages_bookingId_stage_idx] ON [dbo].[service_video_publication_stages]([bookingId], [stage]);
CREATE INDEX [service_video_publication_stages_stageEvidenceId_contentHash_idx] ON [dbo].[service_video_publication_stages]([stageEvidenceId], [contentHash]);
CREATE INDEX [service_video_publication_stages_mediaAssetId_stageVersion_idx] ON [dbo].[service_video_publication_stages]([mediaAssetId], [stageVersion]);
CREATE INDEX [service_video_publication_stages_presentationHash_idx] ON [dbo].[service_video_publication_stages]([presentationHash]);

CREATE TABLE [dbo].[service_video_publication_customer_decisions] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [customerUserId] NVARCHAR(1000) NOT NULL,
  [authorityRole] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_customer_decisions_authorityRole_df] DEFAULT N'CUSTOMER',
  [decision] NVARCHAR(1000) NOT NULL,
  [decisionJson] NVARCHAR(MAX) NOT NULL,
  [decisionHash] NVARCHAR(1000) NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [proposalHash] NVARCHAR(1000) NOT NULL,
  [verificationMethod] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(MAX) NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_customer_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_customer_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_publication_customer_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_publication_customer_decisions_proposalId_key] UNIQUE NONCLUSTERED ([proposalId])
);
CREATE INDEX [service_video_publication_customer_decisions_bookingId_customerUserId_decidedAt_idx] ON [dbo].[service_video_publication_customer_decisions]([bookingId], [customerUserId], [decidedAt]);
CREATE INDEX [service_video_publication_customer_decisions_proposalHash_decision_idx] ON [dbo].[service_video_publication_customer_decisions]([proposalHash], [decision]);

CREATE TABLE [dbo].[service_video_publication_participant_decisions] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [stageId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [actorUserId] NVARCHAR(1000) NOT NULL,
  [authorityType] NVARCHAR(1000) NOT NULL,
  [decision] NVARCHAR(1000) NOT NULL,
  [decisionHash] NVARCHAR(1000) NOT NULL,
  [proposalHash] NVARCHAR(1000) NOT NULL,
  [presentationHash] NVARCHAR(1000) NOT NULL,
  [verificationMethod] NVARCHAR(1000) NOT NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_participant_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_participant_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_publication_participant_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_publication_participant_decisions_unique] UNIQUE NONCLUSTERED ([proposalId], [stageId], [actorUserId], [authorityType])
);
CREATE INDEX [service_video_publication_participant_decisions_booking_actor_idx] ON [dbo].[service_video_publication_participant_decisions]([bookingId], [actorUserId], [decidedAt]);
CREATE INDEX [service_video_publication_participant_decisions_proposal_decision_idx] ON [dbo].[service_video_publication_participant_decisions]([proposalHash], [decision]);

CREATE TABLE [dbo].[service_video_publication_vendor_decisions] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [managerUserId] NVARCHAR(1000) NOT NULL,
  [managerMembershipId] NVARCHAR(1000) NOT NULL,
  [decision] NVARCHAR(1000) NOT NULL,
  [decisionHash] NVARCHAR(1000) NOT NULL,
  [proposalHash] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(MAX) NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_vendor_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_vendor_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_publication_vendor_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_publication_vendor_decisions_proposalId_key] UNIQUE NONCLUSTERED ([proposalId])
);
CREATE INDEX [service_video_publication_vendor_decisions_vendor_decision_idx] ON [dbo].[service_video_publication_vendor_decisions]([vendorId], [decision], [decidedAt]);
CREATE INDEX [service_video_publication_vendor_decisions_proposalHash_idx] ON [dbo].[service_video_publication_vendor_decisions]([proposalHash]);

CREATE TABLE [dbo].[service_video_publication_admin_decisions] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [adminUserId] NVARCHAR(1000) NOT NULL,
  [decision] NVARCHAR(1000) NOT NULL,
  [approvedAudience] NVARCHAR(1000) NULL,
  [decisionHash] NVARCHAR(1000) NOT NULL,
  [proposalHash] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(MAX) NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_admin_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_admin_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_publication_admin_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_publication_admin_decisions_proposalId_key] UNIQUE NONCLUSTERED ([proposalId])
);
CREATE INDEX [service_video_publication_admin_decisions_decision_decidedAt_idx] ON [dbo].[service_video_publication_admin_decisions]([decision], [decidedAt]);
CREATE INDEX [service_video_publication_admin_decisions_proposalHash_idx] ON [dbo].[service_video_publication_admin_decisions]([proposalHash]);

CREATE TABLE [dbo].[public_service_video_eligibility] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [stageId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [proposalHash] NVARCHAR(1000) NOT NULL,
  [presentationHash] NVARCHAR(1000) NOT NULL,
  [contentHash] NVARCHAR(1000) NOT NULL,
  [eligibilityHash] NVARCHAR(1000) NOT NULL,
  [audience] NVARCHAR(1000) NOT NULL CONSTRAINT [public_service_video_eligibility_audience_df] DEFAULT N'PUBLIC',
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [public_service_video_eligibility_status_df] DEFAULT N'ACTIVE',
  [adminDecisionId] NVARCHAR(1000) NOT NULL,
  [customerDecisionId] NVARCHAR(1000) NOT NULL,
  [vendorDecisionId] NVARCHAR(1000) NOT NULL,
  [participantDecisionIdsJson] NVARCHAR(MAX) NOT NULL,
  [eligibleAt] DATETIME2 NOT NULL CONSTRAINT [public_service_video_eligibility_eligibleAt_df] DEFAULT CURRENT_TIMESTAMP,
  [invalidatedAt] DATETIME2 NULL,
  [invalidationReason] NVARCHAR(MAX) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [public_service_video_eligibility_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [public_service_video_eligibility_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [public_service_video_eligibility_stageId_key] UNIQUE NONCLUSTERED ([stageId])
);
CREATE INDEX [public_service_video_eligibility_vendor_status_idx] ON [dbo].[public_service_video_eligibility]([vendorId], [status], [eligibleAt]);
CREATE INDEX [public_service_video_eligibility_booking_status_idx] ON [dbo].[public_service_video_eligibility]([bookingId], [status]);
CREATE INDEX [public_service_video_eligibility_asset_hash_idx] ON [dbo].[public_service_video_eligibility]([mediaAssetId], [contentHash]);
CREATE INDEX [public_service_video_eligibility_eligibilityHash_idx] ON [dbo].[public_service_video_eligibility]([eligibilityHash]);

CREATE TABLE [dbo].[service_video_publication_audit_events] (
  [id] NVARCHAR(1000) NOT NULL,
  [proposalId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [actorUserId] NVARCHAR(1000) NULL,
  [actorRole] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(1000) NOT NULL,
  [evidenceHash] NVARCHAR(1000) NOT NULL,
  [metadataJson] NVARCHAR(MAX) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_audit_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_publication_audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [service_video_publication_audit_events_proposal_createdAt_idx] ON [dbo].[service_video_publication_audit_events]([proposalId], [createdAt]);
CREATE INDEX [service_video_publication_audit_events_booking_createdAt_idx] ON [dbo].[service_video_publication_audit_events]([bookingId], [createdAt]);
CREATE INDEX [service_video_publication_audit_events_event_createdAt_idx] ON [dbo].[service_video_publication_audit_events]([eventType], [createdAt]);
CREATE INDEX [service_video_publication_audit_events_evidenceHash_idx] ON [dbo].[service_video_publication_audit_events]([evidenceHash]);

CREATE TABLE [dbo].[legacy_public_restriction_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [mediaAssetId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NULL,
  [previousVisibility] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(1000) NOT NULL,
  [restrictedAt] DATETIME2 NOT NULL CONSTRAINT [legacy_public_restriction_evidence_restrictedAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [legacy_public_restriction_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [legacy_public_restriction_evidence_mediaAssetId_key] UNIQUE NONCLUSTERED ([mediaAssetId])
);
CREATE INDEX [legacy_public_restriction_evidence_vendor_restricted_idx] ON [dbo].[legacy_public_restriction_evidence]([vendorId], [restrictedAt]);
CREATE INDEX [legacy_public_restriction_evidence_booking_restricted_idx] ON [dbo].[legacy_public_restriction_evidence]([bookingId], [restrictedAt]);

-- PO-12: existing Public flags are not exact-media approvals. Preserve the media
-- and moderation history while returning those records to Private.
INSERT INTO [dbo].[legacy_public_restriction_evidence]
  ([id], [mediaAssetId], [vendorId], [bookingId], [previousVisibility], [reason], [restrictedAt])
SELECT
  CONVERT(NVARCHAR(1000), NEWID()),
  asset.[id],
  asset.[vendorId],
  sessionRow.[bookingId],
  asset.[visibilityStatus],
  N'EXACT_MEDIA_APPROVAL_REQUIRED',
  CURRENT_TIMESTAMP
FROM [dbo].[media_assets] asset
LEFT JOIN [dbo].[media_sessions] sessionRow ON sessionRow.[id] = asset.[mediaSessionId]
WHERE LOWER(asset.[visibilityStatus]) = N'public';

UPDATE [dbo].[media_assets]
SET [visibilityStatus] = N'private'
WHERE LOWER([visibilityStatus]) = N'public';
