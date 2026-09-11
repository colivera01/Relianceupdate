IF COL_LENGTH('bookings', 'rejectionReason') IS NULL
BEGIN
  ALTER TABLE [dbo].[bookings] ADD [rejectionReason] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('bookings', 'rejectedAt') IS NULL
BEGIN
  ALTER TABLE [dbo].[bookings] ADD [rejectedAt] DATETIME2 NULL;
END;

IF COL_LENGTH('bookings', 'rejectedBy') IS NULL
BEGIN
  ALTER TABLE [dbo].[bookings] ADD [rejectedBy] NVARCHAR(191) NULL;
END;
