CREATE TABLE [dbo].[employee_recording_safety_evidence] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [assessmentGeneration] INT NOT NULL,
  [assessmentContractVersion] NVARCHAR(1000) NOT NULL,
  [assessmentScopeHash] NVARCHAR(64) NOT NULL,
  [locationSnapshotEvidenceHash] NVARCHAR(64) NOT NULL,
  [membershipId] NVARCHAR(1000) NOT NULL,
  [assignmentGeneration] INT NOT NULL,
  [safetyContractVersion] NVARCHAR(100) NOT NULL,
  [checkType] NVARCHAR(64) NOT NULL,
  [stage] NVARCHAR(64) NOT NULL,
  [result] NVARCHAR(64) NOT NULL,
  [issueCodesJson] NVARCHAR(MAX) NOT NULL,
  [sequence] INT NOT NULL,
  [chainKey] NVARCHAR(64) NOT NULL,
  [predecessorEvidenceId] NVARCHAR(1000) NULL,
  [predecessorEvidenceHash] NVARCHAR(64) NULL,
  [canonicalJson] NVARCHAR(MAX) NOT NULL,
  [evidenceHash] NVARCHAR(64) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_safety_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [employee_recording_safety_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [employee_recording_safety_evidence_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [employee_recording_safety_evidence_vendorId_fkey]
    FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [employee_recording_safety_evidence_assessmentId_fkey]
    FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [employee_recording_safety_evidence_membershipId_fkey]
    FOREIGN KEY ([membershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [employee_recording_safety_evidence_predecessorEvidenceId_fkey]
    FOREIGN KEY ([predecessorEvidenceId]) REFERENCES [dbo].[employee_recording_safety_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [employee_recording_safety_evidence_evidenceHash_key]
  ON [dbo].[employee_recording_safety_evidence]([evidenceHash]);

CREATE UNIQUE INDEX [employee_recording_safety_evidence_chainKey_sequence_key]
  ON [dbo].[employee_recording_safety_evidence]([chainKey], [sequence]);

CREATE INDEX [employee_recording_safety_evidence_bookingId_membershipId_stage_sequence_idx]
  ON [dbo].[employee_recording_safety_evidence]([bookingId], [membershipId], [stage], [sequence]);

CREATE INDEX [employee_recording_safety_evidence_assessmentId_stage_sequence_idx]
  ON [dbo].[employee_recording_safety_evidence]([assessmentId], [stage], [sequence]);

CREATE INDEX [employee_recording_safety_evidence_predecessorEvidenceId_idx]
  ON [dbo].[employee_recording_safety_evidence]([predecessorEvidenceId]);

CREATE INDEX [employee_recording_safety_evidence_result_createdAt_idx]
  ON [dbo].[employee_recording_safety_evidence]([result], [createdAt]);
