-- Phase 2B.5 promoted listings editable package catalog and campaign package snapshots.
-- Keeps Stripe workflow admin-recorded only; no live Stripe API/webhook behavior.

IF OBJECT_ID('dbo.promotion_packages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.promotion_packages (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    packageKey NVARCHAR(100) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    publicSummary NVARCHAR(1000) NOT NULL,
    adminDescription NVARCHAR(MAX) NOT NULL,
    bestFor NVARCHAR(1000) NOT NULL,
    placementExplanation NVARCHAR(1000) NOT NULL,
    audience NVARCHAR(1000) NOT NULL,
    placementType NVARCHAR(50) NOT NULL,
    durationDays INT NOT NULL,
    defaultRadiusMiles INT NOT NULL,
    maxRadiusMiles INT NOT NULL,
    allowCategoryTargeting BIT NOT NULL CONSTRAINT DF_promotion_packages_allowCategoryTargeting DEFAULT(0),
    maxConcurrentInZone INT NOT NULL,
    defaultPriceCents INT NOT NULL,
    isActive BIT NOT NULL CONSTRAINT DF_promotion_packages_isActive DEFAULT(1),
    isFoundingRate BIT NOT NULL CONSTRAINT DF_promotion_packages_isFoundingRate DEFAULT(0),
    pricingLabel NVARCHAR(255) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_promotion_packages_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_promotion_packages_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT UQ_promotion_packages_packageKey UNIQUE (packageKey)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_packages_active_placement' AND object_id = OBJECT_ID('dbo.promotion_packages'))
BEGIN
  CREATE INDEX IX_promotion_packages_active_placement
    ON dbo.promotion_packages(isActive, placementType);
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'packageSnapshotJson') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD packageSnapshotJson NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'packageSnapshotAt') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD packageSnapshotAt DATETIME2 NULL;
END;

MERGE dbo.promotion_packages AS target
USING (VALUES
  (
    N'pkg_browse_local_7_day',
    N'browse-local-7-day',
    N'7-day local spotlight',
    N'Entry-level browse feature for one local service area.',
    N'Best for a quick launch push, testing promoted browse demand, or giving a qualified vendor short-term visibility.',
    N'Entry-level local visibility and launch-week experiments.',
    N'Appears in the Featured local providers section on browse.',
    N'Local vendors who want a low-commitment featured browse placement.',
    N'BROWSE_FEATURED',
    7,
    10,
    10,
    1,
    2,
    2900,
    1,
    1,
    N'Founding / intro rate'
  ),
  (
    N'pkg_browse_local_30_day',
    N'browse-local-30-day',
    N'30-day local spotlight',
    N'Month-long browse feature for broader local coverage.',
    N'Best for vendors ready for a longer local campaign while Reliance is still proving early marketplace volume.',
    N'Sustained local visibility and stronger package-popularity signal.',
    N'Appears in browse with up to 30 miles of radius targeting.',
    N'Established local vendors who want a longer promoted listing run.',
    N'BROWSE_FEATURED',
    30,
    20,
    30,
    1,
    2,
    8900,
    1,
    1,
    N'Founding / intro rate'
  ),
  (
    N'pkg_home_spotlight_7_day',
    N'home-spotlight-7-day',
    N'7-day homepage spotlight',
    N'Premium homepage spotlight reservation for top visibility.',
    N'Premium inventory foundation for later homepage rendering; sell carefully until the public home placement is live.',
    N'Premium brand visibility and limited homepage inventory.',
    N'Reserved for HOME_FEATURED inventory; public homepage rendering is still deferred.',
    N'High-priority vendors suited for premium placement.',
    N'HOME_FEATURED',
    7,
    20,
    30,
    0,
    1,
    9900,
    1,
    1,
    N'Founding / intro rate'
  )
) AS source (
  id, packageKey, name, publicSummary, adminDescription, bestFor, placementExplanation, audience,
  placementType, durationDays, defaultRadiusMiles, maxRadiusMiles, allowCategoryTargeting,
  maxConcurrentInZone, defaultPriceCents, isActive, isFoundingRate, pricingLabel
)
ON target.packageKey = source.packageKey
WHEN NOT MATCHED THEN
  INSERT (
    id, packageKey, name, publicSummary, adminDescription, bestFor, placementExplanation, audience,
    placementType, durationDays, defaultRadiusMiles, maxRadiusMiles, allowCategoryTargeting,
    maxConcurrentInZone, defaultPriceCents, isActive, isFoundingRate, pricingLabel
  )
  VALUES (
    source.id, source.packageKey, source.name, source.publicSummary, source.adminDescription,
    source.bestFor, source.placementExplanation, source.audience, source.placementType,
    source.durationDays, source.defaultRadiusMiles, source.maxRadiusMiles,
    source.allowCategoryTargeting, source.maxConcurrentInZone, source.defaultPriceCents,
    source.isActive, source.isFoundingRate, source.pricingLabel
  );

EXEC(N'
UPDATE dbo.promotion_campaigns
SET packageSnapshotJson =
  CASE packageKey
    WHEN ''browse-local-7-day'' THEN ''{"packageKey":"browse-local-7-day","name":"7-day local spotlight","publicSummary":"Entry-level browse feature for one local service area.","adminDescription":"Best for a quick launch push, testing promoted browse demand, or giving a qualified vendor short-term visibility.","placementType":"BROWSE_FEATURED","durationDays":7,"targetRadiusMiles":10,"maxRadiusMiles":10,"allowCategoryTargeting":true,"priceCents":2900,"isFoundingRate":true,"pricingLabel":"Founding / intro rate","bestFor":"Entry-level local visibility and launch-week experiments.","placementExplanation":"Appears in the Featured local providers section on browse.","audience":"Local vendors who want a low-commitment featured browse placement."}''
    WHEN ''browse-local-30-day'' THEN ''{"packageKey":"browse-local-30-day","name":"30-day local spotlight","publicSummary":"Month-long browse feature for broader local coverage.","adminDescription":"Best for vendors ready for a longer local campaign while Reliance is still proving early marketplace volume.","placementType":"BROWSE_FEATURED","durationDays":30,"targetRadiusMiles":20,"maxRadiusMiles":30,"allowCategoryTargeting":true,"priceCents":8900,"isFoundingRate":true,"pricingLabel":"Founding / intro rate","bestFor":"Sustained local visibility and stronger package-popularity signal.","placementExplanation":"Appears in browse with up to 30 miles of radius targeting.","audience":"Established local vendors who want a longer promoted listing run."}''
    WHEN ''home-spotlight-7-day'' THEN ''{"packageKey":"home-spotlight-7-day","name":"7-day homepage spotlight","publicSummary":"Premium homepage spotlight reservation for top visibility.","adminDescription":"Premium inventory foundation for later homepage rendering; sell carefully until the public home placement is live.","placementType":"HOME_FEATURED","durationDays":7,"targetRadiusMiles":20,"maxRadiusMiles":30,"allowCategoryTargeting":false,"priceCents":9900,"isFoundingRate":true,"pricingLabel":"Founding / intro rate","bestFor":"Premium brand visibility and limited homepage inventory.","placementExplanation":"Reserved for HOME_FEATURED inventory; public homepage rendering is still deferred.","audience":"High-priority vendors suited for premium placement."}''
    ELSE packageSnapshotJson
  END,
  packageSnapshotAt = COALESCE(packageSnapshotAt, createdAt, SYSUTCDATETIME())
WHERE packageSnapshotJson IS NULL;
');
