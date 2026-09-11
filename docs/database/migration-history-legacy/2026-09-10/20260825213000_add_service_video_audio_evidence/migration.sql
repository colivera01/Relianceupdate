ALTER TABLE [dbo].[recording_gate_decision_evidence]
ADD [audioExpected] BIT NOT NULL CONSTRAINT [recording_gate_decision_evidence_audioExpected_df] DEFAULT 0,
    [audioContractVersion] INT NOT NULL CONSTRAINT [recording_gate_decision_evidence_audioContractVersion_df] DEFAULT 1;

ALTER TABLE [dbo].[media_upload_attempts]
ADD [audioExpected] BIT NOT NULL CONSTRAINT [media_upload_attempts_audioExpected_df] DEFAULT 0,
    [audioPresence] NVARCHAR(1000) NOT NULL CONSTRAINT [media_upload_attempts_audioPresence_df] DEFAULT N'LEGACY_UNKNOWN',
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [media_upload_attempts_audioEvidenceVersion_df] DEFAULT 1;

ALTER TABLE [dbo].[media_assets]
ADD [audioExpected] BIT NOT NULL CONSTRAINT [media_assets_audioExpected_df] DEFAULT 0,
    [audioPresence] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_audioPresence_df] DEFAULT N'LEGACY_UNKNOWN',
    [audioTrackCount] INT NULL,
    [audioCodec] NVARCHAR(1000) NULL,
    [audioDetectionMethod] NVARCHAR(1000) NULL,
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [media_assets_audioEvidenceVersion_df] DEFAULT 1,
    [audioDetectedAt] DATETIME2 NULL;

ALTER TABLE [dbo].[media_sessions]
ADD [audioExpected] BIT NOT NULL CONSTRAINT [media_sessions_audioExpected_df] DEFAULT 0,
    [audioContractVersion] INT NOT NULL CONSTRAINT [media_sessions_audioContractVersion_df] DEFAULT 1;

ALTER TABLE [dbo].[service_video_stage_evidence]
ADD [audioExpected] BIT NOT NULL CONSTRAINT [service_video_stage_evidence_audioExpected_df] DEFAULT 0,
    [audioPresence] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_stage_evidence_audioPresence_df] DEFAULT N'LEGACY_UNKNOWN',
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [service_video_stage_evidence_audioEvidenceVersion_df] DEFAULT 1;

ALTER TABLE [dbo].[service_video_package_evidence]
ADD [audioExpected] BIT NOT NULL CONSTRAINT [service_video_package_evidence_audioExpected_df] DEFAULT 0,
    [audioConformance] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_package_evidence_audioConformance_df] DEFAULT N'LEGACY_VIDEO_ONLY',
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [service_video_package_evidence_audioEvidenceVersion_df] DEFAULT 1;

CREATE INDEX [media_assets_audioPresence_idx]
  ON [dbo].[media_assets]([audioPresence]);
CREATE INDEX [service_video_stage_evidence_bookingId_audioPresence_idx]
  ON [dbo].[service_video_stage_evidence]([bookingId], [audioPresence]);
