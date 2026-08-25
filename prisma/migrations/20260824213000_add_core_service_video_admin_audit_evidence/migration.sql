ALTER TABLE [dbo].[service_video_package_evidence]
ADD [adminAuditDecisionId] NVARCHAR(1000) NULL,
    [auditEvidenceVersion] INT NULL;

CREATE INDEX [service_video_package_evidence_adminAuditDecisionId_idx]
  ON [dbo].[service_video_package_evidence]([adminAuditDecisionId]);

ALTER TABLE [dbo].[service_video_manager_decision_evidence]
ADD [packageVersion] INT NULL,
    [attestationJson] NVARCHAR(MAX) NULL,
    [attestationHash] NVARCHAR(1000) NULL,
    [evidenceVersion] INT NOT NULL CONSTRAINT [service_video_manager_decision_evidence_evidenceVersion_df] DEFAULT 1;

CREATE INDEX [service_video_manager_decision_evidence_attestationHash_idx]
  ON [dbo].[service_video_manager_decision_evidence]([attestationHash]);

CREATE TABLE [dbo].[service_video_admin_audit_decision_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [packageId] NVARCHAR(1000) NOT NULL,
  [packageVersion] INT NOT NULL,
  [packageHash] NVARCHAR(1000) NOT NULL,
  [stageEvidenceJson] NVARCHAR(MAX) NOT NULL,
  [managerDecisionId] NVARCHAR(1000) NOT NULL,
  [adminUserId] NVARCHAR(1000) NOT NULL,
  [adminRole] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_adminRole_df] DEFAULT N'ADMIN',
  [decision] NVARCHAR(1000) NOT NULL,
  [rejectionCategory] NVARCHAR(1000) NULL,
  [reason] NVARCHAR(MAX) NULL,
  [decisionHash] NVARCHAR(1000) NOT NULL,
  [evidenceVersion] INT NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_evidenceVersion_df] DEFAULT 1,
  [customerProofReleased] BIT NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_customerProofReleased_df] DEFAULT 0,
  [customerAccessGrantId] NVARCHAR(1000) NULL,
  [customerNotificationId] NVARCHAR(1000) NULL,
  [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [service_video_admin_audit_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [service_video_admin_audit_decision_evidence_packageId_key] UNIQUE NONCLUSTERED ([packageId])
);

CREATE INDEX [service_video_admin_audit_decision_evidence_bookingId_decidedAt_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([bookingId], [decidedAt]);
CREATE INDEX [service_video_admin_audit_decision_evidence_vendorId_decision_decidedAt_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([vendorId], [decision], [decidedAt]);
CREATE INDEX [service_video_admin_audit_decision_evidence_managerDecisionId_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([managerDecisionId]);
CREATE INDEX [service_video_admin_audit_decision_evidence_packageHash_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([packageHash]);
CREATE INDEX [service_video_admin_audit_decision_evidence_decisionHash_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([decisionHash]);

ALTER TABLE [dbo].[private_proof_access_grants]
ADD [adminAuditDecisionId] NVARCHAR(1000) NULL;

CREATE INDEX [private_proof_access_grants_adminAuditDecisionId_idx]
  ON [dbo].[private_proof_access_grants]([adminAuditDecisionId]);
