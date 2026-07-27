ALTER TABLE [dbo].[bookings]
  ADD [creationRequestKey] NVARCHAR(255) NULL;

EXEC(N'CREATE UNIQUE INDEX [bookings_creationRequestKey_key]
  ON [dbo].[bookings]([creationRequestKey])
  WHERE [creationRequestKey] IS NOT NULL');

CREATE TABLE [dbo].[booking_notifications] (
  [id] NVARCHAR(1000) NOT NULL,
  [bookingId] NVARCHAR(1000) NOT NULL,
  [consentRecordId] NVARCHAR(1000) NULL,
  [kind] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [booking_notifications_status_df] DEFAULT N'QUEUED',
  [attemptCount] INT NOT NULL CONSTRAINT [booking_notifications_attemptCount_df] DEFAULT 0,
  [channelsJson] NVARCHAR(MAX) NULL,
  [lastError] NVARCHAR(MAX) NULL,
  [lastAttemptAt] DATETIME2 NULL,
  [sentAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [booking_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [booking_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [booking_notifications_bookingId_fkey]
    FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [booking_notifications_bookingId_kind_key]
  ON [dbo].[booking_notifications]([bookingId], [kind]);

CREATE INDEX [booking_notifications_status_lastAttemptAt_idx]
  ON [dbo].[booking_notifications]([status], [lastAttemptAt]);

CREATE INDEX [booking_notifications_consentRecordId_idx]
  ON [dbo].[booking_notifications]([consentRecordId]);
