IF OBJECT_ID(N'[dbo].[auth_trusted_devices]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[auth_trusted_devices] (
        [id] NVARCHAR(1000) NOT NULL,
        [credentialId] NVARCHAR(1000) NOT NULL,
        [userId] NVARCHAR(1000) NOT NULL,
        [tokenHash] NVARCHAR(1000) NOT NULL,
        [label] NVARCHAR(1000) NULL,
        [expiresAt] DATETIME2 NOT NULL,
        [revokedAt] DATETIME2 NULL,
        [lastUsedAt] DATETIME2 NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_trusted_devices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [auth_trusted_devices_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [auth_trusted_devices_credentialId_fkey]
            FOREIGN KEY ([credentialId]) REFERENCES [dbo].[auth_credentials]([id])
            ON DELETE CASCADE ON UPDATE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'auth_trusted_devices_tokenHash_key'
      AND object_id = OBJECT_ID(N'[dbo].[auth_trusted_devices]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [auth_trusted_devices_tokenHash_key]
        ON [dbo].[auth_trusted_devices]([tokenHash]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'auth_trusted_devices_userId_revokedAt_expiresAt_idx'
      AND object_id = OBJECT_ID(N'[dbo].[auth_trusted_devices]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [auth_trusted_devices_userId_revokedAt_expiresAt_idx]
        ON [dbo].[auth_trusted_devices]([userId], [revokedAt], [expiresAt]);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'auth_trusted_devices_credentialId_expiresAt_idx'
      AND object_id = OBJECT_ID(N'[dbo].[auth_trusted_devices]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [auth_trusted_devices_credentialId_expiresAt_idx]
        ON [dbo].[auth_trusted_devices]([credentialId], [expiresAt]);
END;
