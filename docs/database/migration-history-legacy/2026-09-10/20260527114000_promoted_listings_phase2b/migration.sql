-- Phase 2B promoted listings payment tracking and Stripe Payment Link foundation.
-- Adds campaign-level payment fields without requiring live Stripe API integration.

IF COL_LENGTH('dbo.promotion_campaigns', 'amountDueCents') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD amountDueCents INT NOT NULL
      CONSTRAINT DF_promotion_campaigns_amountDueCents DEFAULT(0);
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'stripePaymentLinkUrl') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD stripePaymentLinkUrl NVARCHAR(2048) NULL;
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'paymentReference') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD paymentReference NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'paidAt') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD paidAt DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.promotion_campaigns', 'paymentNotes') IS NULL
BEGIN
  ALTER TABLE dbo.promotion_campaigns
    ADD paymentNotes NVARCHAR(MAX) NULL;
END;

EXEC(N'
UPDATE dbo.promotion_campaigns
SET amountDueCents =
  CASE packageKey
    WHEN ''browse-local-7-day'' THEN 4900
    WHEN ''browse-local-30-day'' THEN 14900
    WHEN ''home-spotlight-7-day'' THEN 9900
    ELSE amountDueCents
  END
WHERE amountDueCents = 0;
');

EXEC(N'
UPDATE dbo.promotion_campaigns
SET paidAt = COALESCE(paidAt, updatedAt, createdAt)
WHERE paymentStatus IN (''paid'', ''waived'') AND paidAt IS NULL;
');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promotion_campaigns_paidAt' AND object_id = OBJECT_ID('dbo.promotion_campaigns'))
BEGIN
  CREATE INDEX IX_promotion_campaigns_paidAt
    ON dbo.promotion_campaigns(paidAt);
END;
