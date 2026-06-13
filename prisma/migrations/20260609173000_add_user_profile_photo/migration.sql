IF COL_LENGTH(N'[dbo].[users]', N'profilePhoto') IS NULL
BEGIN
    ALTER TABLE [dbo].[users]
    ADD [profilePhoto] NVARCHAR(1000) NULL;
END;
