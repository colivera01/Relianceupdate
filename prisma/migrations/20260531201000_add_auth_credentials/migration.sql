IF OBJECT_ID(N'dbo.auth_credentials', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[auth_credentials] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [emailVerifiedAt] DATETIME2 NULL,
    [passwordUpdatedAt] DATETIME2 NOT NULL CONSTRAINT [auth_credentials_passwordUpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_credentials_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [auth_credentials_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [auth_credentials_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [auth_credentials_userId_key] UNIQUE NONCLUSTERED ([userId]),
    CONSTRAINT [auth_credentials_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [auth_credentials_userId_fkey]
      FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'auth_credentials_email_idx'
    AND object_id = OBJECT_ID(N'dbo.auth_credentials')
)
BEGIN
  CREATE NONCLUSTERED INDEX [auth_credentials_email_idx]
    ON [dbo].[auth_credentials]([email]);
END;
