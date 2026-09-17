-- SQL Server treats NULL as a value in an ordinary unique constraint. Review
-- opportunities are allowed to remain unsubmitted concurrently, so reviewId
-- is unique only after it has a value.
IF EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE [name] = N'review_windows_reviewId_key'
    AND [parent_object_id] = OBJECT_ID(N'dbo.review_windows')
)
BEGIN
  ALTER TABLE [dbo].[review_windows]
    DROP CONSTRAINT [review_windows_reviewId_key];
END;

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [name] = N'review_windows_reviewId_key'
    AND [object_id] = OBJECT_ID(N'dbo.review_windows')
)
BEGIN
  DROP INDEX [review_windows_reviewId_key]
    ON [dbo].[review_windows];
END;

EXEC(N'CREATE UNIQUE INDEX [review_windows_reviewId_key]
  ON [dbo].[review_windows]([reviewId])
  WHERE [reviewId] IS NOT NULL');

-- The application get-or-create lookup uses this exact immutable review
-- opportunity identity. Database uniqueness makes concurrent starts converge
-- on one canonical window.
EXEC(N'CREATE UNIQUE INDEX [review_windows_booking_vendor_media_key]
  ON [dbo].[review_windows]([bookingId], [vendorId], [mediaSessionId])');
