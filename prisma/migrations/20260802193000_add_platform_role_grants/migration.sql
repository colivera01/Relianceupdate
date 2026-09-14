-- Epic 3 Phase A: additive database-backed platform authority.
CREATE TABLE [dbo].[platform_role_grants] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [platform_role_grants_status_df] DEFAULT 'ACTIVE',
    [grantedAt] DATETIME2 NOT NULL CONSTRAINT [platform_role_grants_grantedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [grantedByUserId] NVARCHAR(1000),
    [revokedAt] DATETIME2,
    [revokedByUserId] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [platform_role_grants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [platform_role_grants_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE NONCLUSTERED INDEX [platform_role_grants_userId_role_key]
ON [dbo].[platform_role_grants]([userId], [role]);

CREATE NONCLUSTERED INDEX [platform_role_grants_role_status_idx]
ON [dbo].[platform_role_grants]([role], [status]);

CREATE NONCLUSTERED INDEX [platform_role_grants_userId_status_idx]
ON [dbo].[platform_role_grants]([userId], [status]);

ALTER TABLE [dbo].[platform_role_grants]
ADD CONSTRAINT [platform_role_grants_userId_fkey]
FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [dbo].[platform_role_grants]
ADD CONSTRAINT [platform_role_grants_grantedByUserId_fkey]
FOREIGN KEY ([grantedByUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Verified by an exact, unique database lookup on 2026-08-02:
-- the approved beta admin account resolves to active user
-- D43B6BB3-1A72-45EC-A362-A6E1E0580EA0.
INSERT INTO [dbo].[platform_role_grants]
    ([id], [userId], [role], [status], [grantedAt], [reason], [createdAt], [updatedAt])
SELECT
    'epic3_admin_D43B6BB3-1A72-45EC-A362-A6E1E0580EA0',
    'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0',
    'ADMIN',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    'Initial database-backed admin grant verified for Epic 3 Phase A',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1 FROM [dbo].[users]
    WHERE [id] = 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0'
      AND LOWER([accountStatus]) = 'active'
)
AND NOT EXISTS (
    SELECT 1 FROM [dbo].[platform_role_grants]
    WHERE [userId] = 'D43B6BB3-1A72-45EC-A362-A6E1E0580EA0'
      AND [role] = 'ADMIN'
);
