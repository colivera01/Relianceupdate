IF OBJECT_ID(N'[dbo].[email_verification_tokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[email_verification_tokens] (
        [id] NVARCHAR(1000) NOT NULL,
        [credentialId] NVARCHAR(1000) NOT NULL,
        [email] NVARCHAR(1000) NOT NULL,
        [tokenHash] NVARCHAR(1000) NOT NULL,
        [expiresAt] DATETIME2 NOT NULL,
        [consumedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [email_verification_tokens_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [email_verification_tokens_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [email_verification_tokens_credentialId_fkey]
            FOREIGN KEY ([credentialId]) REFERENCES [dbo].[auth_credentials]([id])
            ON DELETE CASCADE ON UPDATE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'email_verification_tokens_tokenHash_key'
      AND object_id = OBJECT_ID(N'[dbo].[email_verification_tokens]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [email_verification_tokens_tokenHash_key]
        ON [dbo].[email_verification_tokens]([tokenHash]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'email_verification_tokens_credentialId_email_consumedAt_idx'
      AND object_id = OBJECT_ID(N'[dbo].[email_verification_tokens]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [email_verification_tokens_credentialId_email_consumedAt_idx]
        ON [dbo].[email_verification_tokens]([credentialId], [email], [consumedAt]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'email_verification_tokens_email_expiresAt_idx'
      AND object_id = OBJECT_ID(N'[dbo].[email_verification_tokens]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [email_verification_tokens_email_expiresAt_idx]
        ON [dbo].[email_verification_tokens]([email], [expiresAt]);
END;
