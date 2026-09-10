CREATE TABLE [dbo].[employee_public_media_consent_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [coversLikeness] BIT NOT NULL,
    [coversAudio] BIT NOT NULL,
    [effectScope] NVARCHAR(1000) NOT NULL,
    [policyVersion] NVARCHAR(1000) NOT NULL,
    [contractVersion] INT NOT NULL CONSTRAINT [employee_public_media_consent_decisions_contractVersion_df] DEFAULT 1,
    [consentTextSnapshot] NVARCHAR(MAX) NOT NULL,
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [employee_public_media_consent_decisions_isCurrent_df] DEFAULT 1,
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [employee_public_media_consent_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_public_media_consent_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [employee_public_media_consent_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_public_media_consent_decisions_membershipId_version_key] UNIQUE NONCLUSTERED ([membershipId], [version])
);

CREATE INDEX [employee_public_media_consent_decisions_membershipId_isCurrent_idx]
ON [dbo].[employee_public_media_consent_decisions]([membershipId], [isCurrent]);
CREATE INDEX [employee_public_media_consent_decisions_userId_isCurrent_idx]
ON [dbo].[employee_public_media_consent_decisions]([userId], [isCurrent]);
CREATE INDEX [employee_public_media_consent_decisions_vendorId_decision_isCurrent_idx]
ON [dbo].[employee_public_media_consent_decisions]([vendorId], [decision], [isCurrent]);
CREATE INDEX [employee_public_media_consent_decisions_decisionHash_idx]
ON [dbo].[employee_public_media_consent_decisions]([decisionHash]);

CREATE TABLE [dbo].[employee_public_media_notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [employeeUserId] NVARCHAR(1000) NOT NULL,
    [employeeMembershipId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [notificationType] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(MAX) NOT NULL,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_public_media_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_public_media_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_public_media_notifications_proposalId_employeeMembershipId_notificationType_key]
      UNIQUE NONCLUSTERED ([proposalId], [employeeMembershipId], [notificationType])
);

CREATE INDEX [employee_public_media_notifications_employeeUserId_createdAt_idx]
ON [dbo].[employee_public_media_notifications]([employeeUserId], [createdAt]);
CREATE INDEX [employee_public_media_notifications_employeeMembershipId_createdAt_idx]
ON [dbo].[employee_public_media_notifications]([employeeMembershipId], [createdAt]);
CREATE INDEX [employee_public_media_notifications_bookingId_createdAt_idx]
ON [dbo].[employee_public_media_notifications]([bookingId], [createdAt]);

ALTER TABLE [dbo].[public_service_video_eligibility]
ADD [standingConsentDecisionIdsJson] NVARCHAR(MAX) NULL;
