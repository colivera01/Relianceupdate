-- Create filtered unique index for active device assignments
-- SQL Server supports filtered unique indexes
-- This ensures only one active assignment per headset

CREATE UNIQUE INDEX UX_DeviceAssignment_Active
ON DeviceAssignment(deviceId)
WHERE unassignedAt IS NULL;

