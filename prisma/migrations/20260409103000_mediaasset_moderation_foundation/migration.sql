BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[media_assets]
ADD
  [moderationStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_moderationStatus_df] DEFAULT 'pending_review',
  [visibilityStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_visibilityStatus_df] DEFAULT 'private',
  [archiveStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_archiveStatus_df] DEFAULT 'active',
  [moderationReason] NVARCHAR(1000) NULL,
  [moderatedAt] DATETIME2 NULL,
  [moderatedByUserId] NVARCHAR(1000) NULL,
  [uploadedByMembershipId] NVARCHAR(1000) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
