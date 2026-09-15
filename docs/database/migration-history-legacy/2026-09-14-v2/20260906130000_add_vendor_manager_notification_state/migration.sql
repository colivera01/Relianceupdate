CREATE TABLE [dbo].[vendor_manager_notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [sourceAdminDecisionId] NVARCHAR(1000) NOT NULL,
    [sourceBookingNotificationId] NVARCHAR(1000) NULL,
    [recipientMembershipId] NVARCHAR(1000) NOT NULL,
    [notificationType] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(MAX) NOT NULL,
    [targetUrl] NVARCHAR(2048) NOT NULL,
    [presentationState] NVARCHAR(1000) NOT NULL CONSTRAINT [vendor_manager_notifications_presentationState_df] DEFAULT 'UNREAD',
    [viewedAt] DATETIME2 NULL,
    [readAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_manager_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vendor_manager_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_manager_notifications_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [vendor_manager_notifications_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [vendor_manager_notifications_recipientMembershipId_fkey] FOREIGN KEY ([recipientMembershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [vendor_manager_notifications_source_recipient_type_key]
  ON [dbo].[vendor_manager_notifications]([sourceAdminDecisionId], [recipientMembershipId], [notificationType]);

CREATE NONCLUSTERED INDEX [vendor_manager_notifications_recipient_state_created_idx]
  ON [dbo].[vendor_manager_notifications]([vendorId], [recipientMembershipId], [presentationState], [createdAt]);

CREATE NONCLUSTERED INDEX [vendor_manager_notifications_booking_created_idx]
  ON [dbo].[vendor_manager_notifications]([bookingId], [createdAt]);

CREATE NONCLUSTERED INDEX [vendor_manager_notifications_package_idx]
  ON [dbo].[vendor_manager_notifications]([packageId]);
