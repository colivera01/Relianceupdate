ALTER TABLE [dbo].[service_video_publication_proposals]
ADD [contractVersion] INT NOT NULL CONSTRAINT [service_video_publication_proposals_contractVersion_df] DEFAULT 1,
    [authorizationModel] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_proposals_authorizationModel_df] DEFAULT N'LEGACY_STAGE_SELECTION',
    [packageVisibilityDecisionId] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[service_video_publication_proposals]
ALTER COLUMN [proposedByMembershipId] NVARCHAR(1000) NULL;

CREATE INDEX [service_video_publication_proposals_packageVisibilityDecisionId_idx]
  ON [dbo].[service_video_publication_proposals]([packageVisibilityDecisionId]);

CREATE TABLE [dbo].[service_video_package_visibility_decisions] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [customerUserId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [packageVersion] INT NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [stageEvidenceJson] NVARCHAR(MAX) NOT NULL,
  [stageSetHash] NVARCHAR(1000) NOT NULL,
  [decision] NVARCHAR(1000) NOT NULL,
  [version] INT NOT NULL,
  [isCurrent] BIT NOT NULL CONSTRAINT [service_video_package_visibility_decisions_isCurrent_df] DEFAULT 1,
  [evidenceVersion] INT NOT NULL CONSTRAINT [service_video_package_visibility_decisions_evidenceVersion_df] DEFAULT 2,
  [decisionHash] NVARCHAR(1000) NOT NULL,
  [verificationMethod] NVARCHAR(1000) NOT NULL,
  [publicationProposalId] NVARCHAR(1000) NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_visibility_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [supersededAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_visibility_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [service_video_package_visibility_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_package_visibility_decisions_bookingId_version_key] UNIQUE NONCLUSTERED ([bookingId], [version])
);

CREATE INDEX [service_video_package_visibility_decisions_bookingId_isCurrent_idx]
  ON [dbo].[service_video_package_visibility_decisions]([bookingId], [isCurrent]);
CREATE INDEX [service_video_package_visibility_decisions_vendorId_decision_decidedAt_idx]
  ON [dbo].[service_video_package_visibility_decisions]([vendorId], [decision], [decidedAt]);
CREATE INDEX [service_video_package_visibility_decisions_customerUserId_decision_decidedAt_idx]
  ON [dbo].[service_video_package_visibility_decisions]([customerUserId], [decision], [decidedAt]);
CREATE INDEX [service_video_package_visibility_decisions_packageId_packageHash_idx]
  ON [dbo].[service_video_package_visibility_decisions]([packageId], [packageHash]);
CREATE INDEX [service_video_package_visibility_decisions_stageSetHash_idx]
  ON [dbo].[service_video_package_visibility_decisions]([stageSetHash]);
CREATE INDEX [service_video_package_visibility_decisions_decisionHash_idx]
  ON [dbo].[service_video_package_visibility_decisions]([decisionHash]);
CREATE INDEX [service_video_package_visibility_decisions_publicationProposalId_idx]
  ON [dbo].[service_video_package_visibility_decisions]([publicationProposalId]);

ALTER TABLE [dbo].[public_service_video_eligibility]
ALTER COLUMN [vendorDecisionId] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[public_service_video_eligibility]
ADD [packageVisibilityDecisionId] NVARCHAR(1000) NULL;

CREATE INDEX [public_service_video_eligibility_packageVisibilityDecisionId_idx]
  ON [dbo].[public_service_video_eligibility]([packageVisibilityDecisionId]);
