-- Device UID canonicalization migration (safe/guarded for schema drift)
-- 1) Add deviceUid column if missing
-- 2) Backfill deviceUid from legacy employeeId when possible
-- 3) Add filtered unique index on non-null deviceUid

IF COL_LENGTH('dbo.devices', 'deviceUid') IS NULL
BEGIN
  ALTER TABLE dbo.devices ADD deviceUid NVARCHAR(191) NULL;
END
GO

IF COL_LENGTH('dbo.devices', 'employeeId') IS NOT NULL
BEGIN
  ;WITH candidate AS (
    SELECT
      d.id,
      d.employeeId,
      ROW_NUMBER() OVER (PARTITION BY d.employeeId ORDER BY d.createdAt DESC, d.id DESC) AS rn
    FROM dbo.devices d
    WHERE d.deviceUid IS NULL
      AND d.employeeId IS NOT NULL
      AND LTRIM(RTRIM(d.employeeId)) <> ''
  )
  UPDATE d
  SET d.deviceUid = c.employeeId
  FROM dbo.devices d
  INNER JOIN candidate c ON c.id = d.id
  WHERE c.rn = 1;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'devices_deviceUid_key'
    AND object_id = OBJECT_ID('dbo.devices')
)
BEGIN
  CREATE UNIQUE INDEX devices_deviceUid_key
    ON dbo.devices(deviceUid)
    WHERE deviceUid IS NOT NULL;
END
GO
