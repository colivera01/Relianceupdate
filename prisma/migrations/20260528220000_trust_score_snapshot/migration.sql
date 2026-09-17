-- Trust Score Phase 1B: internal vendor trust score snapshots (current + historical).
-- Column types match the Prisma schema (String -> NVARCHAR(1000), Float -> FLOAT, Int -> INT,
-- Boolean -> BIT, String? @db.NVarChar(Max) -> NVARCHAR(MAX)). FK vendorId matches vendors.id.

IF OBJECT_ID('dbo.vendor_trust_score_snapshots', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_trust_score_snapshots (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    vendorId NVARCHAR(1000) NOT NULL,
    scoreVersion INT NOT NULL CONSTRAINT DF_vendor_trust_score_snapshots_scoreVersion DEFAULT(1),
    totalScorePct FLOAT NULL,
    workflowCompletionPct FLOAT NULL,
    videoVerificationPct FLOAT NULL,
    disputeFreePct FLOAT NULL,
    operationalReliabilityPct FLOAT NULL,
    workflowCompletionNumerator INT NOT NULL CONSTRAINT DF_vtss_wc_num DEFAULT(0),
    workflowCompletionDenominator INT NOT NULL CONSTRAINT DF_vtss_wc_den DEFAULT(0),
    videoVerificationNumerator INT NOT NULL CONSTRAINT DF_vtss_vv_num DEFAULT(0),
    videoVerificationDenominator INT NOT NULL CONSTRAINT DF_vtss_vv_den DEFAULT(0),
    disputeFreeNumerator INT NOT NULL CONSTRAINT DF_vtss_df_num DEFAULT(0),
    disputeFreeDenominator INT NOT NULL CONSTRAINT DF_vtss_df_den DEFAULT(0),
    operationalReliabilityNumerator INT NOT NULL CONSTRAINT DF_vtss_or_num DEFAULT(0),
    operationalReliabilityDenominator INT NOT NULL CONSTRAINT DF_vtss_or_den DEFAULT(0),
    computedAt DATETIME2 NOT NULL CONSTRAINT DF_vtss_computedAt DEFAULT(SYSUTCDATETIME()),
    periodStart DATETIME2 NULL,
    periodEnd DATETIME2 NULL,
    inputHash NVARCHAR(1000) NULL,
    isCurrent BIT NOT NULL CONSTRAINT DF_vtss_isCurrent DEFAULT(1),
    visibilityStatus NVARCHAR(1000) NOT NULL CONSTRAINT DF_vtss_visibility DEFAULT('internal'),
    recalcReason NVARCHAR(1000) NULL,
    recalcSource NVARCHAR(1000) NULL,
    detailJson NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_vtss_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_vtss_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_vendor_trust_score_snapshots_vendorId FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id) ON DELETE NO ACTION
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vendor_trust_score_snapshots_vendor_current' AND object_id = OBJECT_ID('dbo.vendor_trust_score_snapshots'))
BEGIN
  CREATE INDEX IX_vendor_trust_score_snapshots_vendor_current
    ON dbo.vendor_trust_score_snapshots(vendorId, isCurrent);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vendor_trust_score_snapshots_vendor_computed' AND object_id = OBJECT_ID('dbo.vendor_trust_score_snapshots'))
BEGIN
  CREATE INDEX IX_vendor_trust_score_snapshots_vendor_computed
    ON dbo.vendor_trust_score_snapshots(vendorId, computedAt);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_vendor_trust_score_snapshots_inputHash' AND object_id = OBJECT_ID('dbo.vendor_trust_score_snapshots'))
BEGIN
  CREATE INDEX IX_vendor_trust_score_snapshots_inputHash
    ON dbo.vendor_trust_score_snapshots(inputHash);
END;
GO
