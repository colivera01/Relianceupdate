-- Phase 1 promoted listings / featured placement foundation.
-- Admin-controlled campaigns only; no billing tables or payment workflow.

IF OBJECT_ID('dbo.promotion_campaigns', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.promotion_campaigns (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    vendorId NVARCHAR(1000) NOT NULL,
    serviceId NVARCHAR(1000) NULL,
    name NVARCHAR(255) NOT NULL,
    placementType NVARCHAR(50) NOT NULL CONSTRAINT DF_promotion_campaigns_placementType DEFAULT('BROWSE_FEATURED'),
    status NVARCHAR(50) NOT NULL CONSTRAINT DF_promotion_campaigns_status DEFAULT('draft'),
    startAt DATETIME2 NOT NULL,
    endAt DATETIME2 NOT NULL,
    targetCategory NVARCHAR(100) NULL,
    targetCity NVARCHAR(100) NULL,
    targetState NVARCHAR(100) NULL,
    targetZip NVARCHAR(20) NULL,
    rankPriority INT NOT NULL CONSTRAINT DF_promotion_campaigns_rankPriority DEFAULT(100),
    adminNotes NVARCHAR(MAX) NULL,
    createdByUserId NVARCHAR(1000) NULL,
    approvedByUserId NVARCHAR(1000) NULL,
    approvedAt DATETIME2 NULL,
    pausedAt DATETIME2 NULL,
    endedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_promotion_campaigns_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_promotion_campaigns_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_promotion_campaigns_vendor FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id),
    CONSTRAINT FK_promotion_campaigns_service FOREIGN KEY (serviceId) REFERENCES dbo.services(id) ON DELETE SET NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_status_placement_dates' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_status_placement_dates
    ON dbo.promotion_campaigns(status, placementType, startAt, endAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_vendor_status' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_vendor_status
    ON dbo.promotion_campaigns(vendorId, status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_service' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_service
    ON dbo.promotion_campaigns(serviceId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_targetCategory' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_targetCategory
    ON dbo.promotion_campaigns(targetCategory);
END;
GO
