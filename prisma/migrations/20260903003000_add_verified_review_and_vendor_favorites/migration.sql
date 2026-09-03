ALTER TABLE [dbo].[reviews]
ADD [contractVersion] INT NULL,
    [ratingValidityStatus] NVARCHAR(1000) NULL,
    [ratingInvalidationReason] NVARCHAR(MAX) NULL,
    [ratingInvalidatedAt] DATETIME2 NULL,
    [ratingInvalidatedByUserId] NVARCHAR(1000) NULL,
    [submissionRequestId] NVARCHAR(1000) NULL,
    [submissionRequestHash] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[reviews]
ADD CONSTRAINT [reviews_ratingValidityStatus_check]
CHECK ([ratingValidityStatus] IS NULL OR [ratingValidityStatus] IN ('verified', 'invalid'));

EXEC(N'CREATE INDEX [reviews_userId_submissionRequestId_idx]
  ON [dbo].[reviews]([userId], [submissionRequestId])');

EXEC(N'CREATE INDEX [reviews_vendorId_ratingValidityStatus_idx]
  ON [dbo].[reviews]([vendorId], [ratingValidityStatus])');

EXEC(N'CREATE UNIQUE INDEX [reviews_userId_submissionRequestId_unique_not_null]
  ON [dbo].[reviews]([userId], [submissionRequestId])
  WHERE [submissionRequestId] IS NOT NULL');

CREATE TABLE [dbo].[vendor_favorites] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_favorites_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vendor_favorites_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_favorites_userId_fkey]
      FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT [vendor_favorites_vendorId_fkey]
      FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [vendor_favorites_userId_vendorId_key]
  ON [dbo].[vendor_favorites]([userId], [vendorId]);

CREATE NONCLUSTERED INDEX [vendor_favorites_userId_createdAt_idx]
  ON [dbo].[vendor_favorites]([userId], [createdAt]);

CREATE NONCLUSTERED INDEX [vendor_favorites_vendorId_idx]
  ON [dbo].[vendor_favorites]([vendorId]);
