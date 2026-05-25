-- Idempotent drift patch (Azure SQL / SQL Server)
-- Brings the local DB up to the columns/tables required by prisma/schema.prisma
-- for Device, DeviceEvent, DeviceAssignment.
--
-- ALL statements are guarded by sys.* / INFORMATION_SCHEMA / COL_LENGTH checks.
-- No destructive operations (no DROP, no force resets).
-- Safe to re-run.

-- ============================================================
-- 1) Devices: add missing columns (guarded)
-- ============================================================

IF COL_LENGTH('dbo.devices', 'deviceUid') IS NULL
BEGIN
  ALTER TABLE dbo.devices ADD deviceUid NVARCHAR(191) NULL;
END
GO

-- Backfill deviceUid from legacy employeeId when possible
-- (matches semantics of 20260427143000_add_deviceuid_column_backfill_legacy_employeeid)
IF COL_LENGTH('dbo.devices', 'employeeId') IS NOT NULL
   AND COL_LENGTH('dbo.devices', 'deviceUid') IS NOT NULL
BEGIN
  ;WITH candidate AS (
    SELECT
      d.id,
      d.employeeId,
      ROW_NUMBER() OVER (PARTITION BY d.employeeId ORDER BY d.id DESC) AS rn
    FROM dbo.devices d
    WHERE d.deviceUid IS NULL
      AND d.employeeId IS NOT NULL
      AND LTRIM(RTRIM(d.employeeId)) <> ''
  )
  UPDATE d SET d.deviceUid = c.employeeId
  FROM dbo.devices d
  INNER JOIN candidate c ON c.id = d.id
  WHERE c.rn = 1;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'devices_deviceUid_key' AND object_id = OBJECT_ID('dbo.devices')
)
BEGIN
  CREATE UNIQUE INDEX devices_deviceUid_key
    ON dbo.devices(deviceUid)
    WHERE deviceUid IS NOT NULL;
END
GO

IF COL_LENGTH('dbo.devices', 'pairedAt') IS NULL
BEGIN
  ALTER TABLE dbo.devices
    ADD pairedAt DATETIME2 NOT NULL
        CONSTRAINT DF_devices_pairedAt DEFAULT SYSUTCDATETIME();
END
GO

-- Backfill pairedAt from legacy createdAt for accuracy when available
IF COL_LENGTH('dbo.devices', 'createdAt') IS NOT NULL
   AND COL_LENGTH('dbo.devices', 'pairedAt') IS NOT NULL
BEGIN
  UPDATE dbo.devices
    SET pairedAt = createdAt
    WHERE createdAt IS NOT NULL AND createdAt < pairedAt;
END
GO

IF COL_LENGTH('dbo.devices', 'isActive') IS NULL
BEGIN
  ALTER TABLE dbo.devices
    ADD isActive BIT NOT NULL
        CONSTRAINT DF_devices_isActive DEFAULT 1;
END
GO

IF COL_LENGTH('dbo.devices', 'firmwareVersion') IS NULL
  ALTER TABLE dbo.devices ADD firmwareVersion NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.devices', 'model') IS NULL
  ALTER TABLE dbo.devices ADD model NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.devices', 'os') IS NULL
  ALTER TABLE dbo.devices ADD os NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.devices', 'appVersion') IS NULL
  ALTER TABLE dbo.devices ADD appVersion NVARCHAR(1000) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'devices_vendorId_deviceType_idx'
    AND object_id = OBJECT_ID('dbo.devices')
)
  CREATE INDEX devices_vendorId_deviceType_idx
    ON dbo.devices(vendorId, deviceType);
GO

-- ============================================================
-- 2) device_events: create table + indexes if missing
-- ============================================================

IF NOT EXISTS (
  SELECT 1 FROM sys.tables
  WHERE name = 'device_events' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE dbo.device_events (
    id              NVARCHAR(1000) NOT NULL,
    eventId         NVARCHAR(1000) NOT NULL,
    eventType       NVARCHAR(1000) NOT NULL,
    occurredAt      DATETIME2 NOT NULL,
    receivedAt      DATETIME2 NOT NULL
                    CONSTRAINT DF_device_events_receivedAt DEFAULT SYSUTCDATETIME(),
    deviceId        NVARCHAR(1000) NOT NULL,
    vendorId        NVARCHAR(1000) NOT NULL,
    membershipId    NVARCHAR(1000) NULL,
    bookingId       NVARCHAR(1000) NULL,
    mediaSessionId  NVARCHAR(1000) NULL,
    assetId         NVARCHAR(1000) NULL,
    stage           NVARCHAR(1000) NULL,
    payloadJson     NVARCHAR(MAX) NULL,
    contextJson     NVARCHAR(MAX) NULL,
    firmwareVersion NVARCHAR(1000) NULL,
    phoneAppVersion NVARCHAR(1000) NULL,
    CONSTRAINT PK_device_events PRIMARY KEY CLUSTERED (id)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_events_eventId_key'
    AND object_id = OBJECT_ID('dbo.device_events')
)
  CREATE UNIQUE INDEX device_events_eventId_key
    ON dbo.device_events(eventId);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_events_deviceId_occurredAt_idx'
    AND object_id = OBJECT_ID('dbo.device_events')
)
  CREATE INDEX device_events_deviceId_occurredAt_idx
    ON dbo.device_events(deviceId, occurredAt);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_events_vendorId_occurredAt_idx'
    AND object_id = OBJECT_ID('dbo.device_events')
)
  CREATE INDEX device_events_vendorId_occurredAt_idx
    ON dbo.device_events(vendorId, occurredAt);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_events_eventType_occurredAt_idx'
    AND object_id = OBJECT_ID('dbo.device_events')
)
  CREATE INDEX device_events_eventType_occurredAt_idx
    ON dbo.device_events(eventType, occurredAt);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_events_membershipId_occurredAt_idx'
    AND object_id = OBJECT_ID('dbo.device_events')
)
  CREATE INDEX device_events_membershipId_occurredAt_idx
    ON dbo.device_events(membershipId, occurredAt);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_device_events_device'
)
  ALTER TABLE dbo.device_events
    ADD CONSTRAINT FK_device_events_device
    FOREIGN KEY (deviceId) REFERENCES dbo.devices(id)
    ON DELETE CASCADE ON UPDATE NO ACTION;
GO

-- ============================================================
-- 3) device_assignments: create table + indexes if missing
-- ============================================================

IF NOT EXISTS (
  SELECT 1 FROM sys.tables
  WHERE name = 'device_assignments' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE dbo.device_assignments (
    id               NVARCHAR(1000) NOT NULL,
    vendorId         NVARCHAR(1000) NOT NULL,
    deviceId         NVARCHAR(1000) NOT NULL,
    membershipId     NVARCHAR(1000) NOT NULL,
    assignedAt       DATETIME2 NOT NULL
                     CONSTRAINT DF_device_assignments_assignedAt DEFAULT SYSUTCDATETIME(),
    unassignedAt     DATETIME2 NULL,
    assignedByUserId NVARCHAR(1000) NOT NULL,
    CONSTRAINT PK_device_assignments PRIMARY KEY CLUSTERED (id)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_assignments_vendorId_idx'
    AND object_id = OBJECT_ID('dbo.device_assignments')
)
  CREATE INDEX device_assignments_vendorId_idx
    ON dbo.device_assignments(vendorId);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'device_assignments_deviceId_unassignedAt_idx'
    AND object_id = OBJECT_ID('dbo.device_assignments')
)
  CREATE INDEX device_assignments_deviceId_unassignedAt_idx
    ON dbo.device_assignments(deviceId, unassignedAt);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_device_assignments_vendor'
)
  ALTER TABLE dbo.device_assignments
    ADD CONSTRAINT FK_device_assignments_vendor
    FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_device_assignments_device'
)
  ALTER TABLE dbo.device_assignments
    ADD CONSTRAINT FK_device_assignments_device
    FOREIGN KEY (deviceId) REFERENCES dbo.devices(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_device_assignments_membership'
)
  ALTER TABLE dbo.device_assignments
    ADD CONSTRAINT FK_device_assignments_membership
    FOREIGN KEY (membershipId) REFERENCES dbo.vendor_memberships(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
