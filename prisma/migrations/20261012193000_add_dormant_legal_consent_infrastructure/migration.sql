CREATE TABLE [dbo].[governed_content_versions] (
  [id] NVARCHAR(1000) NOT NULL,
  [contentKey] NVARCHAR(200) NOT NULL,
  [contentClass] NVARCHAR(64) NOT NULL,
  [audienceRole] NVARCHAR(64) NULL,
  [version] NVARCHAR(100) NOT NULL,
  [governanceStatus] NVARCHAR(64) NOT NULL CONSTRAINT [governed_content_versions_status_df] DEFAULT N'DRAFT',
  [contentSnapshot] NVARCHAR(MAX) NOT NULL,
  [contentHash] NVARCHAR(64) NOT NULL,
  [sourceRevision] NVARCHAR(100) NULL,
  [productOwnerApprovedByPrincipalId] NVARCHAR(255) NULL,
  [productOwnerApprovedAt] DATETIME2 NULL,
  [supersedesVersionId] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [governed_content_versions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [governed_content_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [governed_content_versions_status_ck] CHECK ([governanceStatus] IN (N'DRAFT', N'PRODUCT_OWNER_APPROVED')),
  CONSTRAINT [governed_content_versions_approval_ck] CHECK (
    ([governanceStatus] = N'DRAFT' AND [productOwnerApprovedAt] IS NULL AND [productOwnerApprovedByPrincipalId] IS NULL)
    OR
    ([governanceStatus] = N'PRODUCT_OWNER_APPROVED' AND [productOwnerApprovedAt] IS NOT NULL AND [productOwnerApprovedByPrincipalId] IS NOT NULL)
  ),
  CONSTRAINT [governed_content_versions_supersedesVersionId_fkey]
    FOREIGN KEY ([supersedesVersionId]) REFERENCES [dbo].[governed_content_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [governed_content_versions_key_version_key]
  ON [dbo].[governed_content_versions]([contentKey], [version]);
CREATE UNIQUE NONCLUSTERED INDEX [governed_content_versions_key_hash_key]
  ON [dbo].[governed_content_versions]([contentKey], [contentHash]);
CREATE NONCLUSTERED INDEX [governed_content_versions_class_status_idx]
  ON [dbo].[governed_content_versions]([contentClass], [governanceStatus], [createdAt]);
CREATE NONCLUSTERED INDEX [governed_content_versions_role_status_idx]
  ON [dbo].[governed_content_versions]([audienceRole], [governanceStatus]);
CREATE NONCLUSTERED INDEX [governed_content_versions_supersedes_idx]
  ON [dbo].[governed_content_versions]([supersedesVersionId]);

CREATE TABLE [dbo].[role_assent_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [contentVersionId] NVARCHAR(1000) NOT NULL,
  [actorPrincipalId] NVARCHAR(255) NOT NULL,
  [actorUserId] NVARCHAR(1000) NULL,
  [actorRole] NVARCHAR(64) NOT NULL,
  [vendorId] NVARCHAR(1000) NULL,
  [membershipId] NVARCHAR(1000) NULL,
  [bookingId] NVARCHAR(1000) NULL,
  [contextType] NVARCHAR(100) NOT NULL,
  [contextId] NVARCHAR(255) NOT NULL,
  [contextHash] NVARCHAR(64) NOT NULL,
  [decision] NVARCHAR(32) NOT NULL,
  [policyKey] NVARCHAR(200) NOT NULL,
  [policyVersion] NVARCHAR(100) NOT NULL,
  [contentSnapshot] NVARCHAR(MAX) NOT NULL,
  [contentHash] NVARCHAR(64) NOT NULL,
  [verificationMethod] NVARCHAR(100) NOT NULL,
  [verificationContextJson] NVARCHAR(MAX) NOT NULL,
  [chainKey] NVARCHAR(64) NOT NULL,
  [sequence] INT NOT NULL,
  [supersedesEvidenceId] NVARCHAR(1000) NULL,
  [requestId] NVARCHAR(255) NOT NULL,
  [requestHash] NVARCHAR(64) NOT NULL,
  [evidenceHash] NVARCHAR(64) NOT NULL,
  [decidedAt] DATETIME2 NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [role_assent_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [role_assent_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [role_assent_evidence_decision_ck] CHECK ([decision] IN (N'ASSENT', N'DECLINE')),
  CONSTRAINT [role_assent_evidence_contentVersionId_fkey]
    FOREIGN KEY ([contentVersionId]) REFERENCES [dbo].[governed_content_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [role_assent_evidence_supersedesEvidenceId_fkey]
    FOREIGN KEY ([supersedesEvidenceId]) REFERENCES [dbo].[role_assent_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [role_assent_evidence_hash_key]
  ON [dbo].[role_assent_evidence]([evidenceHash]);
CREATE UNIQUE NONCLUSTERED INDEX [role_assent_evidence_chain_sequence_key]
  ON [dbo].[role_assent_evidence]([chainKey], [sequence]);
CREATE UNIQUE NONCLUSTERED INDEX [role_assent_evidence_chain_request_key]
  ON [dbo].[role_assent_evidence]([chainKey], [requestId]);
CREATE NONCLUSTERED INDEX [role_assent_evidence_actor_idx]
  ON [dbo].[role_assent_evidence]([actorPrincipalId], [actorRole], [decidedAt]);
CREATE NONCLUSTERED INDEX [role_assent_evidence_policy_idx]
  ON [dbo].[role_assent_evidence]([policyKey], [policyVersion], [actorRole]);
CREATE NONCLUSTERED INDEX [role_assent_evidence_booking_idx]
  ON [dbo].[role_assent_evidence]([bookingId], [actorRole], [decidedAt]);
CREATE NONCLUSTERED INDEX [role_assent_evidence_membership_idx]
  ON [dbo].[role_assent_evidence]([membershipId], [actorRole], [decidedAt]);
CREATE NONCLUSTERED INDEX [role_assent_evidence_supersedes_idx]
  ON [dbo].[role_assent_evidence]([supersedesEvidenceId]);

CREATE TABLE [dbo].[public_choice_content_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [contentVersionId] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [packageVersion] INT NOT NULL,
  [packageHash] NVARCHAR(64) NOT NULL,
  [stageSetHash] NVARCHAR(64) NOT NULL,
  [customerUserId] NVARCHAR(1000) NOT NULL,
  [visibilityDecisionId] NVARCHAR(1000) NULL,
  [choice] NVARCHAR(32) NOT NULL,
  [contentKey] NVARCHAR(200) NOT NULL,
  [contentVersion] NVARCHAR(100) NOT NULL,
  [contentSnapshot] NVARCHAR(MAX) NOT NULL,
  [contentHash] NVARCHAR(64) NOT NULL,
  [includesAudio] BIT NOT NULL,
  [audioDisclosureIncluded] BIT NOT NULL,
  [outsideCopyDisclosureIncluded] BIT NOT NULL,
  [verificationMethod] NVARCHAR(100) NOT NULL,
  [verificationContextJson] NVARCHAR(MAX) NOT NULL,
  [requestId] NVARCHAR(255) NOT NULL,
  [requestHash] NVARCHAR(64) NOT NULL,
  [evidenceHash] NVARCHAR(64) NOT NULL,
  [recordedAt] DATETIME2 NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [public_choice_content_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [public_choice_content_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [public_choice_content_evidence_choice_ck] CHECK ([choice] IN (N'SHARE_PUBLICLY', N'MAKE_PRIVATE')),
  CONSTRAINT [public_choice_content_evidence_audio_ck] CHECK ([includesAudio] = 0 OR [audioDisclosureIncluded] = 1),
  CONSTRAINT [public_choice_content_evidence_outside_copy_ck] CHECK ([choice] <> N'SHARE_PUBLICLY' OR [outsideCopyDisclosureIncluded] = 1),
  CONSTRAINT [public_choice_content_evidence_contentVersionId_fkey]
    FOREIGN KEY ([contentVersionId]) REFERENCES [dbo].[governed_content_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [public_choice_content_evidence_hash_key]
  ON [dbo].[public_choice_content_evidence]([evidenceHash]);
CREATE UNIQUE NONCLUSTERED INDEX [public_choice_content_evidence_booking_request_key]
  ON [dbo].[public_choice_content_evidence]([bookingId], [requestId]);
CREATE NONCLUSTERED INDEX [public_choice_content_evidence_package_idx]
  ON [dbo].[public_choice_content_evidence]([bookingId], [packageId], [recordedAt]);
CREATE NONCLUSTERED INDEX [public_choice_content_evidence_customer_idx]
  ON [dbo].[public_choice_content_evidence]([customerUserId], [recordedAt]);
CREATE NONCLUSTERED INDEX [public_choice_content_evidence_visibility_idx]
  ON [dbo].[public_choice_content_evidence]([visibilityDecisionId]);
CREATE NONCLUSTERED INDEX [public_choice_content_evidence_content_idx]
  ON [dbo].[public_choice_content_evidence]([contentKey], [contentVersion]);

CREATE TABLE [dbo].[privacy_case_references] (
  [id] NVARCHAR(1000) NOT NULL,
  [referenceCode] NVARCHAR(64) NOT NULL,
  [intakeChannel] NVARCHAR(64) NOT NULL,
  [requesterPrincipalId] NVARCHAR(255) NULL,
  [requesterPrincipalHash] NVARCHAR(64) NULL,
  [requesterRole] NVARCHAR(64) NULL,
  [subjectPrincipalId] NVARCHAR(255) NULL,
  [intakeContextHash] NVARCHAR(64) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [privacy_case_references_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [privacy_case_references_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE NONCLUSTERED INDEX [privacy_case_references_referenceCode_key]
  ON [dbo].[privacy_case_references]([referenceCode]);
CREATE NONCLUSTERED INDEX [privacy_case_references_requester_idx]
  ON [dbo].[privacy_case_references]([requesterPrincipalId], [createdAt]);
CREATE NONCLUSTERED INDEX [privacy_case_references_subject_idx]
  ON [dbo].[privacy_case_references]([subjectPrincipalId], [createdAt]);
CREATE NONCLUSTERED INDEX [privacy_case_references_context_idx]
  ON [dbo].[privacy_case_references]([intakeContextHash]);

CREATE TABLE [dbo].[privacy_case_events] (
  [id] NVARCHAR(1000) NOT NULL,
  [caseId] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(100) NOT NULL,
  [actorPrincipalId] NVARCHAR(255) NULL,
  [actorRole] NVARCHAR(64) NULL,
  [metadataJson] NVARCHAR(MAX) NOT NULL,
  [evidenceHash] NVARCHAR(64) NOT NULL,
  [occurredAt] DATETIME2 NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [privacy_case_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [privacy_case_events_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [privacy_case_events_caseId_fkey]
    FOREIGN KEY ([caseId]) REFERENCES [dbo].[privacy_case_references]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [privacy_case_events_hash_key]
  ON [dbo].[privacy_case_events]([evidenceHash]);
CREATE NONCLUSTERED INDEX [privacy_case_events_case_idx]
  ON [dbo].[privacy_case_events]([caseId], [occurredAt]);
CREATE NONCLUSTERED INDEX [privacy_case_events_type_idx]
  ON [dbo].[privacy_case_events]([eventType], [occurredAt]);
