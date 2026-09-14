-- Trust Score Phase 1A foundation: finalized service issues and operational outcomes.
-- Column types match the Prisma schema (String -> NVARCHAR(1000), String? @db.NVarChar(Max) -> NVARCHAR(MAX)).
-- FK columns must match the referenced bookings.id / vendors.id length (NVARCHAR(1000)).

IF OBJECT_ID('dbo.booking_service_issues', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.booking_service_issues (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    bookingId NVARCHAR(1000) NOT NULL,
    vendorId NVARCHAR(1000) NOT NULL,
    issueType NVARCHAR(1000) NOT NULL,
    status NVARCHAR(1000) NOT NULL CONSTRAINT DF_booking_service_issues_status DEFAULT('PENDING'),
    sourceEntityType NVARCHAR(1000) NULL,
    sourceEntityId NVARCHAR(1000) NULL,
    reportedByUserId NVARCHAR(1000) NULL,
    validatedAt DATETIME2 NULL,
    rejectedAt DATETIME2 NULL,
    refundApprovedAt DATETIME2 NULL,
    finalizedAt DATETIME2 NULL,
    finalizedByUserId NVARCHAR(1000) NULL,
    resolutionNotes NVARCHAR(MAX) NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_booking_service_issues_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_booking_service_issues_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_booking_service_issues_bookingId FOREIGN KEY (bookingId) REFERENCES dbo.bookings(id) ON DELETE CASCADE,
    CONSTRAINT FK_booking_service_issues_vendorId FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id) ON DELETE NO ACTION
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_booking_service_issues_booking_status' AND object_id = OBJECT_ID('dbo.booking_service_issues'))
BEGIN
  CREATE INDEX IX_booking_service_issues_booking_status
    ON dbo.booking_service_issues(bookingId, status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_booking_service_issues_vendor_status_finalized' AND object_id = OBJECT_ID('dbo.booking_service_issues'))
BEGIN
  CREATE INDEX IX_booking_service_issues_vendor_status_finalized
    ON dbo.booking_service_issues(vendorId, status, finalizedAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_booking_service_issues_type_status' AND object_id = OBJECT_ID('dbo.booking_service_issues'))
BEGIN
  CREATE INDEX IX_booking_service_issues_type_status
    ON dbo.booking_service_issues(issueType, status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_booking_service_issues_source' AND object_id = OBJECT_ID('dbo.booking_service_issues'))
BEGIN
  CREATE INDEX IX_booking_service_issues_source
    ON dbo.booking_service_issues(sourceEntityType, sourceEntityId);
END;
GO

IF OBJECT_ID('dbo.vendor_operational_outcomes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_operational_outcomes (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    vendorId NVARCHAR(1000) NOT NULL,
    bookingId NVARCHAR(1000) NULL,
    outcomeType NVARCHAR(1000) NOT NULL,
    status NVARCHAR(1000) NOT NULL CONSTRAINT DF_vendor_operational_outcomes_status DEFAULT('FINALIZED'),
    sourceEntityType NVARCHAR(1000) NULL,
    sourceEntityId NVARCHAR(1000) NULL,
    finalizedAt DATETIME2 NOT NULL,
    finalizedByUserId NVARCHAR(1000) NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_vendor_operational_outcomes_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_vendor_operational_outcomes_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_vendor_operational_outcomes_vendorId FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id) ON DELETE NO ACTION,
    CONSTRAINT FK_vendor_operational_outcomes_bookingId FOREIGN KEY (bookingId) REFERENCES dbo.bookings(id) ON DELETE NO ACTION
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vendor_operational_outcomes_vendor_type_finalized' AND object_id = OBJECT_ID('dbo.vendor_operational_outcomes'))
BEGIN
  CREATE INDEX IX_vendor_operational_outcomes_vendor_type_finalized
    ON dbo.vendor_operational_outcomes(vendorId, outcomeType, finalizedAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vendor_operational_outcomes_booking_type' AND object_id = OBJECT_ID('dbo.vendor_operational_outcomes'))
BEGIN
  CREATE INDEX IX_vendor_operational_outcomes_booking_type
    ON dbo.vendor_operational_outcomes(bookingId, outcomeType);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vendor_operational_outcomes_source' AND object_id = OBJECT_ID('dbo.vendor_operational_outcomes'))
BEGIN
  CREATE INDEX IX_vendor_operational_outcomes_source
    ON dbo.vendor_operational_outcomes(sourceEntityType, sourceEntityId);
END;
GO
