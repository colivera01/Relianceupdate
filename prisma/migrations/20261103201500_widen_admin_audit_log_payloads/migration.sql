-- Restore the canonical unbounded audit payload contract. Some beta databases
-- drifted to Prisma's SQL Server default NVARCHAR(1000), which can silently
-- drop audit evidence when serialized metadata exceeds 1,000 characters.

IF OBJECT_ID(N'dbo.admin_audit_logs', N'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.admin_audit_logs ALTER COLUMN previousValue NVARCHAR(MAX) NULL;
  ALTER TABLE dbo.admin_audit_logs ALTER COLUMN newValue NVARCHAR(MAX) NULL;
  ALTER TABLE dbo.admin_audit_logs ALTER COLUMN metadata NVARCHAR(MAX) NULL;
END;
