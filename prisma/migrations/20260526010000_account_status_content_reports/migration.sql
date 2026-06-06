-- Launch-safety foundation: account status controls and unified content reports.

IF COL_LENGTH('dbo.users', 'accountStatus') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD accountStatus NVARCHAR(50) NOT NULL
      CONSTRAINT DF_users_accountStatus DEFAULT('active');
END;
GO

IF COL_LENGTH('dbo.users', 'accountStatusUpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD accountStatusUpdatedAt DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'accountStatusReason') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD accountStatusReason NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'accountStatusAdminNotes') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD accountStatusAdminNotes NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.vendors', 'accountStatus') IS NULL
BEGIN
  ALTER TABLE dbo.vendors
    ADD accountStatus NVARCHAR(50) NOT NULL
      CONSTRAINT DF_vendors_accountStatus DEFAULT('active');
END;
GO

IF COL_LENGTH('dbo.vendors', 'accountStatusUpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.vendors
    ADD accountStatusUpdatedAt DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.vendors', 'accountStatusReason') IS NULL
BEGIN
  ALTER TABLE dbo.vendors
    ADD accountStatusReason NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('dbo.vendors', 'accountStatusAdminNotes') IS NULL
BEGIN
  ALTER TABLE dbo.vendors
    ADD accountStatusAdminNotes NVARCHAR(MAX) NULL;
END;
GO

IF OBJECT_ID('dbo.content_reports', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.content_reports (
    id NVARCHAR(100) NOT NULL PRIMARY KEY,
    targetType NVARCHAR(50) NOT NULL,
    targetId NVARCHAR(100) NOT NULL,
    bookingId NVARCHAR(100) NULL,
    vendorId NVARCHAR(100) NULL,
    reportedUserId NVARCHAR(100) NULL,
    reportedVendorId NVARCHAR(100) NULL,
    reporterUserId NVARCHAR(100) NULL,
    reporterVendorId NVARCHAR(100) NULL,
    reporterRole NVARCHAR(50) NOT NULL,
    reasonCategory NVARCHAR(100) NOT NULL,
    reasonDetail NVARCHAR(MAX) NULL,
    status NVARCHAR(50) NOT NULL CONSTRAINT DF_content_reports_status DEFAULT('open'),
    severity NVARCHAR(50) NOT NULL CONSTRAINT DF_content_reports_severity DEFAULT('medium'),
    autoHidden BIT NOT NULL CONSTRAINT DF_content_reports_autoHidden DEFAULT(0),
    adminOwnerUserId NVARCHAR(100) NULL,
    notificationSentAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_content_reports_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_reports_updatedAt DEFAULT(SYSUTCDATETIME()),
    resolvedAt DATETIME2 NULL,
    resolutionNotes NVARCHAR(MAX) NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_content_reports_target' AND object_id = OBJECT_ID('dbo.content_reports'))
BEGIN
  CREATE INDEX IX_content_reports_target
    ON dbo.content_reports(targetType, targetId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_content_reports_status' AND object_id = OBJECT_ID('dbo.content_reports'))
BEGIN
  CREATE INDEX IX_content_reports_status
    ON dbo.content_reports(status, createdAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_content_reports_vendor' AND object_id = OBJECT_ID('dbo.content_reports'))
BEGIN
  CREATE INDEX IX_content_reports_vendor
    ON dbo.content_reports(vendorId, createdAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_content_reports_reported_user' AND object_id = OBJECT_ID('dbo.content_reports'))
BEGIN
  CREATE INDEX IX_content_reports_reported_user
    ON dbo.content_reports(reportedUserId, createdAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_content_reports_reported_vendor' AND object_id = OBJECT_ID('dbo.content_reports'))
BEGIN
  CREATE INDEX IX_content_reports_reported_vendor
    ON dbo.content_reports(reportedVendorId, createdAt);
END;
GO
