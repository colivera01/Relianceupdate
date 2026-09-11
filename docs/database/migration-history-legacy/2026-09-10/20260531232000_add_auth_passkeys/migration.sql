IF OBJECT_ID(N'[dbo].[auth_passkeys]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[auth_passkeys] (
        [id] NVARCHAR(1000) NOT NULL,
        [credentialId] NVARCHAR(1000) NOT NULL,
        [credentialPublicKey] NVARCHAR(MAX) NOT NULL,
        [webauthnUserId] NVARCHAR(1000) NOT NULL,
        [counter] INT NOT NULL CONSTRAINT [auth_passkeys_counter_df] DEFAULT 0,
        [transportsJson] NVARCHAR(MAX) NULL,
        [deviceType] NVARCHAR(1000) NOT NULL,
        [backedUp] BIT NOT NULL CONSTRAINT [auth_passkeys_backedUp_df] DEFAULT 0,
        [label] NVARCHAR(1000) NULL,
        [lastUsedAt] DATETIME2 NULL,
        [revokedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_passkeys_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        [updatedAt] DATETIME2 NOT NULL,
        [authCredentialId] NVARCHAR(1000) NOT NULL,
        CONSTRAINT [auth_passkeys_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [auth_passkeys_authCredentialId_fkey]
            FOREIGN KEY ([authCredentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'auth_passkeys_credentialId_key' AND object_id = OBJECT_ID(N'[dbo].[auth_passkeys]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [auth_passkeys_credentialId_key] ON [dbo].[auth_passkeys]([credentialId]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'auth_passkeys_authCredentialId_revokedAt_createdAt_idx' AND object_id = OBJECT_ID(N'[dbo].[auth_passkeys]'))
BEGIN
    CREATE NONCLUSTERED INDEX [auth_passkeys_authCredentialId_revokedAt_createdAt_idx]
        ON [dbo].[auth_passkeys]([authCredentialId], [revokedAt], [createdAt]);
END;

IF OBJECT_ID(N'[dbo].[auth_passkey_challenges]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[auth_passkey_challenges] (
        [id] NVARCHAR(1000) NOT NULL,
        [authCredentialId] NVARCHAR(1000) NOT NULL,
        [challenge] NVARCHAR(1000) NOT NULL,
        [purpose] NVARCHAR(1000) NOT NULL,
        [expiresAt] DATETIME2 NOT NULL,
        [consumedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_passkey_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [auth_passkey_challenges_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [auth_passkey_challenges_authCredentialId_fkey]
            FOREIGN KEY ([authCredentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'auth_passkey_challenges_authCredentialId_purpose_consumedAt_expiresAt_idx' AND object_id = OBJECT_ID(N'[dbo].[auth_passkey_challenges]'))
BEGIN
    CREATE NONCLUSTERED INDEX [auth_passkey_challenges_authCredentialId_purpose_consumedAt_expiresAt_idx]
        ON [dbo].[auth_passkey_challenges]([authCredentialId], [purpose], [consumedAt], [expiresAt]);
END;
