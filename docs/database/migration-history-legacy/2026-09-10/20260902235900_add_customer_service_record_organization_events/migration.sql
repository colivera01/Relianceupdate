CREATE TABLE [dbo].[customer_service_record_organization_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [customerUserId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [sequence] INT NOT NULL,
    [requestId] NVARCHAR(255) NOT NULL,
    [requestHash] NVARCHAR(1000) NOT NULL,
    [previousEventId] NVARCHAR(1000) NULL,
    [previousEvidenceHash] NVARCHAR(1000) NULL,
    [evidenceVersion] INT NOT NULL CONSTRAINT [customer_service_record_organization_events_evidenceVersion_df] DEFAULT 1,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [actedAt] DATETIME2 NOT NULL CONSTRAINT [customer_service_record_organization_events_actedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [customer_service_record_organization_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [customer_service_record_organization_events_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [customer_service_record_organization_events_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [customer_service_record_organization_events_customerUserId_fkey] FOREIGN KEY ([customerUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX [customer_service_record_organization_events_bookingId_customerUserId_sequence_key]
  ON [dbo].[customer_service_record_organization_events]([bookingId], [customerUserId], [sequence]);

CREATE UNIQUE INDEX [customer_service_record_organization_events_bookingId_customerUserId_requestId_key]
  ON [dbo].[customer_service_record_organization_events]([bookingId], [customerUserId], [requestId]);

CREATE INDEX [customer_service_record_organization_events_customerUserId_actedAt_idx]
  ON [dbo].[customer_service_record_organization_events]([customerUserId], [actedAt]);

CREATE INDEX [customer_service_record_organization_events_bookingId_actedAt_idx]
  ON [dbo].[customer_service_record_organization_events]([bookingId], [actedAt]);

CREATE INDEX [customer_service_record_organization_events_evidenceHash_idx]
  ON [dbo].[customer_service_record_organization_events]([evidenceHash]);
