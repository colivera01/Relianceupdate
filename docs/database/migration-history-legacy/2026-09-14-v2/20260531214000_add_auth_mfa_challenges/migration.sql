IF OBJECT_ID(N'[dbo].[auth_mfa_challenges]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[auth_mfa_challenges] (
        [id] NVARCHAR(1000) NOT NULL,
        [credentialId] NVARCHAR(1000) NOT NULL,
        [userId] NVARCHAR(1000) NOT NULL,
        [email] NVARCHAR(1000) NOT NULL,
        [codeHash] NVARCHAR(1000) NOT NULL,
        [purpose] NVARCHAR(1000) NOT NULL,
        [expiresAt] DATETIME2 NOT NULL,
        [consumedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_mfa_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [auth_mfa_challenges_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [auth_mfa_challenges_credentialId_fkey]
            FOREIGN KEY ([credentialId]) REFERENCES [dbo].[auth_credentials]([id])
            ON DELETE CASCADE ON UPDATE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'auth_mfa_challenges_userId_purpose_consumedAt_idx'
      AND object_id = OBJECT_ID(N'[dbo].[auth_mfa_challenges]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [auth_mfa_challenges_userId_purpose_consumedAt_idx]
        ON [dbo].[auth_mfa_challenges]([userId], [purpose], [consumedAt]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'auth_mfa_challenges_credentialId_purpose_expiresAt_idx'
      AND object_id = OBJECT_ID(N'[dbo].[auth_mfa_challenges]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [auth_mfa_challenges_credentialId_purpose_expiresAt_idx]
        ON [dbo].[auth_mfa_challenges]([credentialId], [purpose], [expiresAt]);
END;
