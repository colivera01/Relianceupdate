-- Epic 3 Phase A: grant beta platform authority to the verified beta owner.
-- This migration is intentionally conditional and leaves existing grants unchanged.
INSERT INTO [dbo].[platform_role_grants]
    ([id], [userId], [role], [status], [grantedAt], [reason], [createdAt], [updatedAt])
SELECT
    'epic3_beta_admin_cmqwvc0gp0003so84j1ckab1p',
    'cmqwvc0gp0003so84j1ckab1p',
    'ADMIN',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    'Initial database-backed beta administrator grant verified for Epic 3 Phase A',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1 FROM [dbo].[users]
    WHERE [id] = 'cmqwvc0gp0003so84j1ckab1p'
      AND LOWER([accountStatus]) = 'active'
)
AND NOT EXISTS (
    SELECT 1 FROM [dbo].[platform_role_grants]
    WHERE [userId] = 'cmqwvc0gp0003so84j1ckab1p'
      AND [role] = 'ADMIN'
);
