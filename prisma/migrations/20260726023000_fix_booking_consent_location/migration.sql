-- SQL Server unique constraints treat NULL as a value. Use a filtered unique
-- index so unclaimed work-order users may keep phone NULL without colliding.
IF EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE [name] = N'users_phone_key'
    AND [parent_object_id] = OBJECT_ID(N'dbo.users')
)
BEGIN
  ALTER TABLE [dbo].[users] DROP CONSTRAINT [users_phone_key];
END;

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [name] = N'users_phone_key'
    AND [object_id] = OBJECT_ID(N'dbo.users')
)
BEGIN
  DROP INDEX [users_phone_key] ON [dbo].[users];
END;

CREATE UNIQUE INDEX [users_phone_key]
  ON [dbo].[users]([phone])
  WHERE [phone] IS NOT NULL;

-- Consent links are booking records, not disposable media. Keep the token when
-- a supporting media session is archived or removed.
DECLARE @consentMediaSessionFk NVARCHAR(128);
SELECT TOP (1) @consentMediaSessionFk = fk.[name]
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fkc
  ON fkc.[constraint_object_id] = fk.[object_id]
WHERE fk.[parent_object_id] = OBJECT_ID(N'dbo.consent_records')
  AND fk.[referenced_object_id] = OBJECT_ID(N'dbo.media_sessions')
  AND COL_NAME(fkc.[parent_object_id], fkc.[parent_column_id]) = N'mediaSessionId';

IF @consentMediaSessionFk IS NOT NULL
BEGIN
  DECLARE @dropConsentMediaSessionFkSql NVARCHAR(MAX);
  SET @dropConsentMediaSessionFkSql =
    N'ALTER TABLE [dbo].[consent_records] DROP CONSTRAINT [' +
    REPLACE(@consentMediaSessionFk, N']', N']]') +
    N']';
  EXEC sys.sp_executesql @dropConsentMediaSessionFkSql;
END;

ALTER TABLE [dbo].[consent_records]
  ALTER COLUMN [mediaSessionId] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[consent_records]
  ADD CONSTRAINT [FK_consent_records_media_session]
  FOREIGN KEY ([mediaSessionId])
  REFERENCES [dbo].[media_sessions]([id])
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
