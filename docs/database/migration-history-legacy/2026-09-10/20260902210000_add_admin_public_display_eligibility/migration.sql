ALTER TABLE [dbo].[service_video_admin_audit_decision_evidence]
ADD [publicDisplayEligibility] NVARCHAR(1000) NULL,
    [publicDisplayReason] NVARCHAR(MAX) NULL,
    [publicEligibilityHash] NVARCHAR(1000) NULL,
    [publicEligibilityEvidenceVersion] INT NULL;

EXEC(N'CREATE INDEX [service_video_admin_audit_decision_evidence_publicDisplayEligibility_decidedAt_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([publicDisplayEligibility], [decidedAt]);');

EXEC(N'CREATE INDEX [service_video_admin_audit_decision_evidence_publicEligibilityHash_idx]
  ON [dbo].[service_video_admin_audit_decision_evidence]([publicEligibilityHash]);');
