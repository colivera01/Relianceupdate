CREATE TABLE [dbo].[recording_scope_assessments] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [generation] INT NOT NULL CONSTRAINT [recording_scope_assessments_generation_df] DEFAULT 1,
  [isCurrent] BIT NOT NULL CONSTRAINT [recording_scope_assessments_isCurrent_df] DEFAULT 1,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_scope_assessments_status_df] DEFAULT N'COMPLETE',
  [locationType] NVARCHAR(1000) NOT NULL,
  [riskLevel] NVARCHAR(1000) NOT NULL,
  [propertyScope] NVARCHAR(1000) NOT NULL,
  [peopleScope] NVARCHAR(1000) NOT NULL,
  [frameControl] NVARCHAR(1000) NOT NULL,
  [subjectJson] NVARCHAR(MAX) NOT NULL,
  [scopeJson] NVARCHAR(MAX) NOT NULL,
  [scopeHash] NVARCHAR(1000) NOT NULL,
  [audioRequested] BIT NOT NULL CONSTRAINT [recording_scope_assessments_audioRequested_df] DEFAULT 0,
  [audioAllowed] BIT NOT NULL CONSTRAINT [recording_scope_assessments_audioAllowed_df] DEFAULT 0,
  [permissionRequired] BIT NOT NULL,
  [noticeRequired] BIT NOT NULL CONSTRAINT [recording_scope_assessments_noticeRequired_df] DEFAULT 1,
  [serviceCanContinueWithoutRecording] BIT NOT NULL,
  [essentialPrivateRecording] BIT NOT NULL CONSTRAINT [recording_scope_assessments_essentialPrivateRecording_df] DEFAULT 0,
  [authorityHolderType] NVARCHAR(1000) NOT NULL,
  [completedByUserId] NVARCHAR(1000) NOT NULL,
  [completedAt] DATETIME2 NOT NULL CONSTRAINT [recording_scope_assessments_completedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [supersededAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_scope_assessments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [recording_scope_assessments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [recording_scope_assessments_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [recording_scope_assessments_vendorId_fkey]
    FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [recording_scope_assessments_bookingId_generation_key]
  ON [dbo].[recording_scope_assessments]([bookingId], [generation]);
CREATE INDEX [recording_scope_assessments_bookingId_isCurrent_idx]
  ON [dbo].[recording_scope_assessments]([bookingId], [isCurrent]);
CREATE UNIQUE INDEX [recording_scope_assessments_one_current_per_booking_key]
  ON [dbo].[recording_scope_assessments]([bookingId]) WHERE [isCurrent] = 1;
CREATE INDEX [recording_scope_assessments_vendorId_createdAt_idx]
  ON [dbo].[recording_scope_assessments]([vendorId], [createdAt]);
CREATE INDEX [recording_scope_assessments_scopeHash_idx]
  ON [dbo].[recording_scope_assessments]([scopeHash]);

CREATE TABLE [dbo].[recording_authority_requirements] (
  [id] NVARCHAR(1000) NOT NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [authorityType] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_authority_requirements_status_df] DEFAULT N'PENDING',
  [required] BIT NOT NULL CONSTRAINT [recording_authority_requirements_required_df] DEFAULT 1,
  [actorUserId] NVARCHAR(1000) NULL,
  [evidenceReference] NVARCHAR(1000) NULL,
  [verifiedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_authority_requirements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [recording_authority_requirements_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [recording_authority_requirements_assessmentId_fkey]
    FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [recording_authority_requirements_assessmentId_authorityType_key]
  ON [dbo].[recording_authority_requirements]([assessmentId], [authorityType]);
CREATE INDEX [recording_authority_requirements_assessmentId_status_idx]
  ON [dbo].[recording_authority_requirements]([assessmentId], [status]);
