-- Phase I: admin audit logging for publish/listing controls

IF OBJECT_ID('dbo.admin_audit_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_audit_logs (
    id NVARCHAR(100) NOT NULL PRIMARY KEY,
    actionType NVARCHAR(100) NOT NULL,
    entityType NVARCHAR(50) NOT NULL,
    entityId NVARCHAR(100) NOT NULL,
    actorUserId NVARCHAR(100) NOT NULL,
    previousValue NVARCHAR(MAX) NULL,
    newValue NVARCHAR(MAX) NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_admin_audit_logs_createdAt DEFAULT(SYSUTCDATETIME())
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_admin_audit_logs_entity' AND object_id = OBJECT_ID('dbo.admin_audit_logs'))
BEGIN
  CREATE INDEX IX_admin_audit_logs_entity
    ON dbo.admin_audit_logs(entityType, entityId, createdAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_admin_audit_logs_actor' AND object_id = OBJECT_ID('dbo.admin_audit_logs'))
BEGIN
  CREATE INDEX IX_admin_audit_logs_actor
    ON dbo.admin_audit_logs(actorUserId, createdAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_admin_audit_logs_action' AND object_id = OBJECT_ID('dbo.admin_audit_logs'))
BEGIN
  CREATE INDEX IX_admin_audit_logs_action
    ON dbo.admin_audit_logs(actionType, createdAt);
END;
GO
