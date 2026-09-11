-- Create filtered unique index for active device assignments
-- SQL Server supports filtered unique indexes
-- This ensures only one active assignment per headset

IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'UX_DeviceAssignment_Active' 
    AND object_id = OBJECT_ID('DeviceAssignment')
)
BEGIN
    CREATE UNIQUE INDEX UX_DeviceAssignment_Active
    ON DeviceAssignment(deviceId)
    WHERE unassignedAt IS NULL;
END

