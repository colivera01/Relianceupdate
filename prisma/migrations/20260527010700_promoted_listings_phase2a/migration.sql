-- Phase 2A promoted listings business controls.
-- Adds package identity, radius targeting, and payment state without Stripe checkout.

IF COL_LENGTH('dbo.promotion_campaigns', 'packageKey') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD packageKey NVARCHAR(100) NOT NULL
      CONSTRAINT DF_promotion_campaigns_packageKey DEFAULT('browse-local-7-day');
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'paymentStatus') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD paymentStatus NVARCHAR(50) NOT NULL
      CONSTRAINT DF_promotion_campaigns_paymentStatus DEFAULT('not_started');
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'targetRadiusMiles') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD targetRadiusMiles INT NOT NULL
      CONSTRAINT DF_promotion_campaigns_targetRadiusMiles DEFAULT(10);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_paymentStatus' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_paymentStatus
    ON dbo.promotion_campaigns(paymentStatus);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_packageKey' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_packageKey
    ON dbo.promotion_campaigns(packageKey);
END;
