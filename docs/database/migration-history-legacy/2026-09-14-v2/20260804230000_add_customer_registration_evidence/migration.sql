CREATE TABLE [dbo].[policy_document_versions] (
  [id] NVARCHAR(1000) NOT NULL,
  [policyId] NVARCHAR(1000) NOT NULL,
  [version] NVARCHAR(1000) NOT NULL,
  [effectiveAt] DATETIME2 NOT NULL,
  [contentHash] NVARCHAR(1000) NOT NULL,
  [contentSnapshot] NVARCHAR(MAX) NOT NULL,
  [sourceRevision] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [policy_document_versions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [policy_document_versions_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [policy_document_versions_contentHash_key]
  ON [dbo].[policy_document_versions]([contentHash]);
CREATE UNIQUE INDEX [policy_document_versions_policyId_version_key]
  ON [dbo].[policy_document_versions]([policyId], [version]);
CREATE INDEX [policy_document_versions_policyId_effectiveAt_idx]
  ON [dbo].[policy_document_versions]([policyId], [effectiveAt]);

CREATE TABLE [dbo].[customer_registration_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [userId] NVARCHAR(1000) NOT NULL,
  [actorEmail] NVARCHAR(1000) NOT NULL,
  [actorRole] NVARCHAR(1000) NOT NULL CONSTRAINT [customer_registration_evidence_actorRole_df] DEFAULT N'CUSTOMER',
  [registeredAt] DATETIME2 NOT NULL,
  [termsPolicyVersionId] NVARCHAR(1000) NOT NULL,
  [privacyPolicyVersionId] NVARCHAR(1000) NOT NULL,
  [smsPolicyVersionId] NVARCHAR(1000) NULL,
  [termsAcceptedAt] DATETIME2 NOT NULL,
  [privacyAcknowledgedAt] DATETIME2 NOT NULL,
  [smsOptIn] BIT NOT NULL CONSTRAINT [customer_registration_evidence_smsOptIn_df] DEFAULT 0,
  [smsDecisionAt] DATETIME2 NOT NULL,
  [registrationIp] NVARCHAR(1000) NULL,
  [userAgent] NVARCHAR(1000) NULL,
  [verificationMethod] NVARCHAR(1000) NOT NULL,
  [verificationCompletedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [customer_registration_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [customer_registration_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [customer_registration_evidence_userId_fkey]
    FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [customer_registration_evidence_termsPolicyVersionId_fkey]
    FOREIGN KEY ([termsPolicyVersionId]) REFERENCES [dbo].[policy_document_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [customer_registration_evidence_privacyPolicyVersionId_fkey]
    FOREIGN KEY ([privacyPolicyVersionId]) REFERENCES [dbo].[policy_document_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [customer_registration_evidence_smsPolicyVersionId_fkey]
    FOREIGN KEY ([smsPolicyVersionId]) REFERENCES [dbo].[policy_document_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [customer_registration_evidence_userId_registeredAt_idx]
  ON [dbo].[customer_registration_evidence]([userId], [registeredAt]);
CREATE INDEX [customer_registration_evidence_actorEmail_registeredAt_idx]
  ON [dbo].[customer_registration_evidence]([actorEmail], [registeredAt]);
CREATE INDEX [customer_registration_evidence_verificationCompletedAt_idx]
  ON [dbo].[customer_registration_evidence]([verificationCompletedAt]);
