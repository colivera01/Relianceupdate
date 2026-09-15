CREATE TABLE [dbo].[employee_recording_certifications] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [membershipId] NVARCHAR(1000) NOT NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [assignmentGeneration] INT NOT NULL,
  [scopeHash] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [employee_recording_certifications_status_df] DEFAULT N'ACTIVE',
  [certifiedByUserId] NVARCHAR(1000) NOT NULL,
  [certifiedAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_certifications_certifiedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [invalidatedAt] DATETIME2 NULL,
  [invalidationReason] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_certifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [employee_recording_certifications_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [employee_recording_certifications_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [employee_recording_certifications_vendorId_fkey]
    FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [employee_recording_certifications_assessmentId_fkey]
    FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [employee_recording_certifications_bookingId_membershipId_status_idx]
  ON [dbo].[employee_recording_certifications]([bookingId], [membershipId], [status]);
CREATE INDEX [employee_recording_certifications_assessmentId_status_idx]
  ON [dbo].[employee_recording_certifications]([assessmentId], [status]);
CREATE INDEX [employee_recording_certifications_scopeHash_idx]
  ON [dbo].[employee_recording_certifications]([scopeHash]);

CREATE TABLE [dbo].[recording_location_attempts] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [membershipId] NVARCHAR(1000) NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL,
  [resultCode] NVARCHAR(1000) NOT NULL,
  [method] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_location_attempts_method_df] DEFAULT N'DEVICE_GEOLOCATION',
  [distanceMeters] INT NULL,
  [accuracyMeters] INT NULL,
  [actorUserId] NVARCHAR(1000) NULL,
  [attemptedAt] DATETIME2 NOT NULL CONSTRAINT [recording_location_attempts_attemptedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_location_attempts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [recording_location_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [recording_location_attempts_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [recording_location_attempts_vendorId_fkey]
    FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [recording_location_attempts_assessmentId_fkey]
    FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [recording_location_attempts_bookingId_membershipId_attemptedAt_idx]
  ON [dbo].[recording_location_attempts]([bookingId], [membershipId], [attemptedAt]);
CREATE INDEX [recording_location_attempts_assessmentId_status_attemptedAt_idx]
  ON [dbo].[recording_location_attempts]([assessmentId], [status], [attemptedAt]);

CREATE TABLE [dbo].[recording_location_exceptions] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [assessmentId] NVARCHAR(1000) NOT NULL,
  [requestedByUserId] NVARCHAR(1000) NOT NULL,
  [requestedByMembershipId] NVARCHAR(1000) NULL,
  [reason] NVARCHAR(MAX) NOT NULL,
  [evidenceJson] NVARCHAR(MAX) NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_location_exceptions_status_df] DEFAULT N'PENDING',
  [decidedByAdminUserId] NVARCHAR(1000) NULL,
  [decisionNote] NVARCHAR(MAX) NULL,
  [decidedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_location_exceptions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [recording_location_exceptions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [recording_location_exceptions_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [recording_location_exceptions_vendorId_fkey]
    FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [recording_location_exceptions_assessmentId_fkey]
    FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [recording_location_exceptions_bookingId_status_createdAt_idx]
  ON [dbo].[recording_location_exceptions]([bookingId], [status], [createdAt]);
CREATE INDEX [recording_location_exceptions_assessmentId_status_idx]
  ON [dbo].[recording_location_exceptions]([assessmentId], [status]);
CREATE INDEX [recording_location_exceptions_decidedByAdminUserId_decidedAt_idx]
  ON [dbo].[recording_location_exceptions]([decidedByAdminUserId], [decidedAt]);

CREATE TABLE [dbo].[recording_gate_metrics] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [vendorId] NVARCHAR(1000) NOT NULL,
  [surface] NVARCHAR(1000) NOT NULL,
  [blockReason] NVARCHAR(1000) NOT NULL,
  [responsibleParticipant] NVARCHAR(1000) NOT NULL,
  [actorKind] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_gate_metrics_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [recording_gate_metrics_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [recording_gate_metrics_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [recording_gate_metrics_vendorId_fkey]
    FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [recording_gate_metrics_blockReason_createdAt_idx]
  ON [dbo].[recording_gate_metrics]([blockReason], [createdAt]);
CREATE INDEX [recording_gate_metrics_bookingId_createdAt_idx]
  ON [dbo].[recording_gate_metrics]([bookingId], [createdAt]);
