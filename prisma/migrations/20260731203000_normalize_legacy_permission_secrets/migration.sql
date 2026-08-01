-- Preserve existing decisions as historical facts. Legacy allows are not upgraded
-- into verified decisions because there is no evidence of recipient verification.
UPDATE [dbo].[consent_records]
SET [legacyEvidence] = 1,
    [verifiedDecision] = 0,
    [lifecycleStatus] = CASE
      WHEN LOWER([status]) = N'accepted' THEN N'ALLOWED_LEGACY'
      WHEN LOWER([status]) = N'declined' THEN N'DECLINED'
      WHEN LOWER([status]) IN (N'revoked', N'expired') THEN UPPER([status])
      ELSE N'SUPERSEDED'
    END,
    [supersededAt] = CASE
      WHEN LOWER([status]) = N'requested' THEN COALESCE([supersededAt], CURRENT_TIMESTAMP)
      ELSE [supersededAt]
    END,
    [status] = CASE WHEN LOWER([status]) = N'requested' THEN N'superseded' ELSE [status] END;

-- Remove obsolete raw action secrets from booking compatibility metadata.
UPDATE [dbo].[bookings]
SET [customerMetadata] = JSON_MODIFY([customerMetadata], N'$.vendor_job_consent_token', NULL)
WHERE [customerMetadata] IS NOT NULL
  AND ISJSON([customerMetadata]) = 1
  AND JSON_VALUE([customerMetadata], N'$.vendor_job_consent_token') IS NOT NULL;

-- Remove known raw-link properties from structured consent-event metadata.
UPDATE [dbo].[consent_events]
SET [metadata] = JSON_MODIFY(
  JSON_MODIFY(
    JSON_MODIFY([metadata], N'$.absoluteFallbackLink', NULL),
    N'$.consentUrl', NULL
  ),
  N'$.token', NULL
)
WHERE [metadata] IS NOT NULL AND ISJSON([metadata]) = 1;

-- Historical admin audit metadata may contain a fallback link from the legacy
-- delivery path. Preserve the event while removing the reusable secret.
UPDATE [dbo].[admin_audit_logs]
SET [metadata] = JSON_MODIFY(
  JSON_MODIFY(
    JSON_MODIFY([metadata], N'$.absoluteFallbackLink', NULL),
    N'$.consentUrl', NULL
  ),
  N'$.token', NULL
)
WHERE [metadata] IS NOT NULL AND ISJSON([metadata]) = 1;

IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE [name] = N'UQ_consent_records_token'
    AND [parent_object_id] = OBJECT_ID(N'dbo.consent_records')
)
BEGIN
  ALTER TABLE [dbo].[consent_records] DROP CONSTRAINT [UQ_consent_records_token];
END;

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'consent_records_token_key'
    AND [object_id] = OBJECT_ID(N'dbo.consent_records')
)
BEGIN
  DROP INDEX [consent_records_token_key] ON [dbo].[consent_records];
END;

ALTER TABLE [dbo].[consent_records] ALTER COLUMN [token] NVARCHAR(1000) NULL;
UPDATE [dbo].[consent_records] SET [token] = NULL WHERE [token] IS NOT NULL;

CREATE UNIQUE INDEX [consent_records_token_key]
  ON [dbo].[consent_records]([token])
  WHERE [token] IS NOT NULL;
