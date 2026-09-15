-- Review attribution fields for vendor + employee rollups from one review row.
ALTER TABLE [dbo].[reviews]
ADD [assignedMembershipId] NVARCHAR(1000),
    [assignedEmployeeName] NVARCHAR(1000),
    [assignedUserId] NVARCHAR(1000),
    [attributionVersion] INT NOT NULL CONSTRAINT [reviews_attributionVersion_df] DEFAULT 1;

-- Supporting indexes for rating aggregation queries.
CREATE INDEX [reviews_bookingId_idx] ON [dbo].[reviews]([bookingId]);
CREATE INDEX [reviews_vendorId_assignedMembershipId_idx] ON [dbo].[reviews]([vendorId], [assignedMembershipId]);
CREATE INDEX [reviews_vendorId_moderationStatus_idx] ON [dbo].[reviews]([vendorId], [moderationStatus]);
CREATE INDEX [reviews_assignedMembershipId_moderationStatus_idx] ON [dbo].[reviews]([assignedMembershipId], [moderationStatus]);

-- Enforce one review per booking only when bookingId is present.
CREATE UNIQUE INDEX [reviews_bookingId_unique_not_null]
ON [dbo].[reviews]([bookingId])
WHERE [bookingId] IS NOT NULL;
