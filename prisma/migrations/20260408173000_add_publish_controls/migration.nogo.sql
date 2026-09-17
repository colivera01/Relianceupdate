-- Same migration as migration.sql but without GO batch separators
-- for compatibility with `prisma db execute`.

IF COL_LENGTH('dbo.vendors', 'isPubliclyListed') IS NULL
BEGIN
  ALTER TABLE dbo.vendors
    ADD isPubliclyListed BIT NOT NULL CONSTRAINT DF_vendors_isPubliclyListed DEFAULT(0);
END;

IF COL_LENGTH('dbo.vendors', 'publiclyListedAt') IS NULL
BEGIN
  ALTER TABLE dbo.vendors
    ADD publiclyListedAt DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.services', 'isPublished') IS NULL
BEGIN
  ALTER TABLE dbo.services
    ADD isPublished BIT NOT NULL CONSTRAINT DF_services_isPublished DEFAULT(0);
END;

IF COL_LENGTH('dbo.services', 'publishedAt') IS NULL
BEGIN
  ALTER TABLE dbo.services
    ADD publishedAt DATETIME2 NULL;
END;
