-- Enforce the existing application invariant: a device may have at most one
-- assignment whose unassignedAt value is NULL.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
  SELECT [deviceId]
  FROM [dbo].[device_assignments]
  WHERE [unassignedAt] IS NULL
  GROUP BY [deviceId]
  HAVING COUNT(*) > 1
)
  THROW 51001, 'Precondition failed: duplicate active device assignments exist.', 1;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [object_id] = OBJECT_ID(N'dbo.device_assignments')
    AND [name] = N'device_assignments_one_active_per_device_key'
)
  CREATE UNIQUE NONCLUSTERED INDEX [device_assignments_one_active_per_device_key]
  ON [dbo].[device_assignments]([deviceId])
  WHERE [unassignedAt] IS NULL;

COMMIT TRANSACTION;
