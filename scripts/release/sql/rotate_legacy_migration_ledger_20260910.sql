SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo._prisma_migrations', N'U') IS NULL
  THROW 51010, 'Precondition failed: active Prisma ledger is missing.', 1;

IF OBJECT_ID(N'dbo._prisma_migrations_legacy_20260910', N'U') IS NOT NULL
  THROW 51011, 'Precondition failed: legacy Prisma ledger destination already exists.', 1;

IF (SELECT COUNT(*) FROM [dbo].[_prisma_migrations]) <> 64
  THROW 51012, 'Precondition failed: expected exactly 64 legacy ledger rows.', 1;

IF (
  SELECT COUNT(DISTINCT [migration_name])
  FROM [dbo].[_prisma_migrations]
  WHERE [finished_at] IS NOT NULL AND [rolled_back_at] IS NULL
) <> 57
  THROW 51013, 'Precondition failed: expected exactly 57 successful migration names.', 1;

EXEC sys.sp_rename N'dbo._prisma_migrations', N'_prisma_migrations_legacy_20260910';

COMMIT TRANSACTION;
