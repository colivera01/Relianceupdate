-- Restore the database-level one-review-per-booking invariant that was
-- intended by 20260427094000_review_attribution_and_unique_booking_review.
-- Historical reviews without booking attribution remain valid.
IF EXISTS (
  SELECT [bookingId]
  FROM [dbo].[reviews]
  WHERE [bookingId] IS NOT NULL
  GROUP BY [bookingId]
  HAVING COUNT_BIG(*) > 1
)
BEGIN
  THROW 51056, 'Cannot restore one-review-per-booking: duplicate non-null reviews.bookingId values exist.', 1;
END;

IF EXISTS (
  SELECT 1
  FROM sys.indexes AS i
  WHERE i.[object_id] = OBJECT_ID(N'dbo.reviews')
    AND i.[name] = N'reviews_bookingId_unique_not_null'
    AND (
      i.[is_unique] <> 1
      OR i.[is_disabled] <> 0
      OR i.[has_filter] <> 1
      OR i.[filter_definition] NOT LIKE N'%[[]bookingId[]]%IS NOT NULL%'
      OR NOT EXISTS (
        SELECT 1
        FROM sys.index_columns AS ic
        INNER JOIN sys.columns AS c
          ON c.[object_id] = ic.[object_id]
          AND c.[column_id] = ic.[column_id]
        WHERE ic.[object_id] = i.[object_id]
          AND ic.[index_id] = i.[index_id]
          AND ic.[key_ordinal] = 1
          AND c.[name] = N'bookingId'
      )
      OR EXISTS (
        SELECT 1
        FROM sys.index_columns AS ic
        WHERE ic.[object_id] = i.[object_id]
          AND ic.[index_id] = i.[index_id]
          AND ic.[key_ordinal] > 1
      )
    )
)
BEGIN
  THROW 51057, 'reviews_bookingId_unique_not_null exists with unexpected semantics.', 1;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [object_id] = OBJECT_ID(N'dbo.reviews')
    AND [name] = N'reviews_bookingId_unique_not_null'
)
BEGIN
  EXEC(N'CREATE UNIQUE INDEX [reviews_bookingId_unique_not_null]
    ON [dbo].[reviews]([bookingId])
    WHERE [bookingId] IS NOT NULL');
END;
