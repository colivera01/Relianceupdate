-- Phase L: review moderation and public visibility governance foundation
-- Conservative defaults:
-- - moderationStatus='approved' (avoid mass "pending" operational backlog)
-- - visibilityStatus='private' (prevents automatic public exposure of existing reviews)

IF COL_LENGTH('dbo.reviews', 'moderationStatus') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD moderationStatus NVARCHAR(50) NOT NULL
      CONSTRAINT DF_reviews_moderationStatus DEFAULT('approved');
END;
GO

IF COL_LENGTH('dbo.reviews', 'visibilityStatus') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD visibilityStatus NVARCHAR(50) NOT NULL
      CONSTRAINT DF_reviews_visibilityStatus DEFAULT('private');
END;
GO

IF COL_LENGTH('dbo.reviews', 'moderationReason') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD moderationReason NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.reviews', 'moderatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD moderatedAt DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.reviews', 'moderatedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD moderatedByUserId NVARCHAR(100) NULL;
END;
GO
