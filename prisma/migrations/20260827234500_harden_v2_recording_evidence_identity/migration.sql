ALTER TABLE [dbo].[employee_recording_safety_evidence]
ADD [locationAttemptId] NVARCHAR(1000) NULL,
    [locationAttemptEvidenceHash] NVARCHAR(64) NULL,
    [submissionRequestHash] NVARCHAR(64) NULL,
    [submissionBodyHash] NVARCHAR(64) NULL;

ALTER TABLE [dbo].[recording_location_attempts]
ADD [assessmentGeneration] INT NULL,
    [assignmentGeneration] INT NULL,
    [stage] NVARCHAR(64) NULL,
    [snapshotEvidenceHash] NVARCHAR(64) NULL,
    [latitude] FLOAT(53) NULL,
    [longitude] FLOAT(53) NULL,
    [capturedAt] DATETIME2 NULL,
    [evidenceVersion] NVARCHAR(100) NULL,
    [canonicalJson] NVARCHAR(MAX) NULL,
    [evidenceHash] NVARCHAR(64) NULL;

ALTER TABLE [dbo].[recording_gate_decision_evidence]
ADD [locationAttemptEvidenceHash] NVARCHAR(64) NULL,
    [safetyEvidenceId] NVARCHAR(1000) NULL,
    [safetyEvidenceHash] NVARCHAR(64) NULL,
    [stage] NVARCHAR(64) NULL,
    [evidenceVersion] NVARCHAR(100) NULL;

EXEC(N'CREATE UNIQUE INDEX [employee_recording_safety_evidence_chainKey_submissionRequestHash_key]
  ON [dbo].[employee_recording_safety_evidence]([chainKey], [submissionRequestHash])
  WHERE [submissionRequestHash] IS NOT NULL;');

EXEC(N'CREATE UNIQUE INDEX [employee_recording_safety_evidence_locationAttemptId_key]
  ON [dbo].[employee_recording_safety_evidence]([locationAttemptId])
  WHERE [locationAttemptId] IS NOT NULL;');

EXEC(N'CREATE INDEX [recording_location_attempts_bookingId_membershipId_stage_attemptedAt_idx]
  ON [dbo].[recording_location_attempts]([bookingId], [membershipId], [stage], [attemptedAt]);');

EXEC(N'CREATE INDEX [recording_location_attempts_evidenceHash_idx]
  ON [dbo].[recording_location_attempts]([evidenceHash]);');

EXEC(N'CREATE INDEX [recording_gate_decision_evidence_safetyEvidenceId_idx]
  ON [dbo].[recording_gate_decision_evidence]([safetyEvidenceId]);');

EXEC(N'CREATE INDEX [recording_gate_decision_evidence_locationAttemptId_idx]
  ON [dbo].[recording_gate_decision_evidence]([locationAttemptId]);');
