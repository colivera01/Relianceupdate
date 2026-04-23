-- Vendor job service videos: structured stage (max one active session per stage per booking; enforced in API).
IF COL_LENGTH(N'media_sessions', N'vendorJobVideoStage') IS NULL
BEGIN
  ALTER TABLE [media_sessions] ADD [vendorJobVideoStage] NVARCHAR(32) NULL;
END
