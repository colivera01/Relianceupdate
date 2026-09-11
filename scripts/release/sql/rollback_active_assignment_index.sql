SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [object_id] = OBJECT_ID(N'dbo.device_assignments')
    AND [name] = N'device_assignments_one_active_per_device_key'
)
  DROP INDEX [device_assignments_one_active_per_device_key] ON [dbo].[device_assignments];

COMMIT TRANSACTION;
