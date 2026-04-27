-- Idempotent hotfix for review attribution fields + supporting indexes.
-- Safe for baseline databases where Prisma migrate deploy is blocked.

IF COL_LENGTH('dbo.reviews', 'assignedMembershipId') IS NULL
BEGIN
  ALTER TABLE [dbo].[reviews] ADD [assignedMembershipId] NVARCHAR(1000) NULL;
END

IF COL_LENGTH('dbo.reviews', 'assignedEmployeeName') IS NULL
BEGIN
  ALTER TABLE [dbo].[reviews] ADD [assignedEmployeeName] NVARCHAR(1000) NULL;
END

IF COL_LENGTH('dbo.reviews', 'assignedUserId') IS NULL
BEGIN
  ALTER TABLE [dbo].[reviews] ADD [assignedUserId] NVARCHAR(1000) NULL;
END

IF COL_LENGTH('dbo.reviews', 'attributionVersion') IS NULL
BEGIN
  ALTER TABLE [dbo].[reviews]
    ADD [attributionVersion] INT NOT NULL
      CONSTRAINT [reviews_attributionVersion_df] DEFAULT 1;
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'reviews_vendorId_assignedMembershipId_idx'
    AND object_id = OBJECT_ID('dbo.reviews')
)
BEGIN
  CREATE INDEX [reviews_vendorId_assignedMembershipId_idx]
  ON [dbo].[reviews]([vendorId], [assignedMembershipId]);
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'reviews_vendorId_moderationStatus_idx'
    AND object_id = OBJECT_ID('dbo.reviews')
)
BEGIN
  CREATE INDEX [reviews_vendorId_moderationStatus_idx]
  ON [dbo].[reviews]([vendorId], [moderationStatus]);
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'reviews_assignedMembershipId_moderationStatus_idx'
    AND object_id = OBJECT_ID('dbo.reviews')
)
BEGIN
  CREATE INDEX [reviews_assignedMembershipId_moderationStatus_idx]
  ON [dbo].[reviews]([assignedMembershipId], [moderationStatus]);
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'reviews_bookingId_unique_not_null'
    AND object_id = OBJECT_ID('dbo.reviews')
)
BEGIN
  CREATE UNIQUE INDEX [reviews_bookingId_unique_not_null]
  ON [dbo].[reviews]([bookingId])
  WHERE [bookingId] IS NOT NULL;
END
