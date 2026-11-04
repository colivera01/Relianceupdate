DECLARE @customerReadAtAdded BIT = 0;

IF OBJECT_ID(N'dbo.booking_notifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.booking_notifications', N'customerReadAt') IS NULL
BEGIN
  ALTER TABLE dbo.booking_notifications ADD customerReadAt DATETIME2 NULL;
  SET @customerReadAtAdded = 1;
END;

-- Existing delivery rows predate the in-app Notification Center. Mark only the
-- customer-facing allowlist as already read so launch does not create a false
-- unread spike. Internal/admin/vendor delivery records remain excluded.
IF OBJECT_ID(N'dbo.booking_notifications', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.bookings', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.booking_notifications', N'customerReadAt') IS NOT NULL
   AND @customerReadAtAdded = 1
BEGIN
  -- SQL Server compiles a batch before executing its ALTER TABLE statements.
  -- Keep references to the newly added column in dynamic SQL so a database
  -- that does not yet have customerReadAt can compile this migration safely.
  EXEC sys.sp_executesql N'
    UPDATE notification
    SET customerReadAt = COALESCE(
      notification.sentAt,
      notification.updatedAt,
      notification.createdAt,
      SYSUTCDATETIME()
    )
    FROM dbo.booking_notifications AS notification
    INNER JOIN dbo.bookings AS booking
      ON booking.id = notification.bookingId
    WHERE notification.customerReadAt IS NULL
      AND booking.userId IS NOT NULL
      AND (
        notification.kind IN (
          N''PRIVATE_PROOF_READY_ADMIN_AUDIT_V1'',
          N''PRIVATE_PROOF_AUDIT_REJECTED_V1'',
          N''CUSTOMER_CONSENT_REQUEST'',
          N''CUSTOMER_PERMISSION_REQUEST'',
          N''CUSTOMER_RECORDING_NOTICE''
        )
        OR notification.kind LIKE N''SERVICE[_]REQUEST[_]NEW[_]REQUEST[_]CUSTOMER[_]V1:%''
        OR notification.kind LIKE N''SERVICE[_]REQUEST[_]ACCEPTED[_]CUSTOMER[_]V1:%''
        OR notification.kind LIKE N''SERVICE[_]REQUEST[_]DECLINED[_]CUSTOMER[_]V1:%''
        OR notification.kind LIKE N''SERVICE[_]REQUEST[_]COUNTEROFFER[_]CUSTOMER[_]V1:%''
        OR notification.kind LIKE N''SERVICE[_]REQUEST[_]REMINDER[_]CUSTOMER[_]V1:%''
        OR notification.kind LIKE N''CUSTOMER[_]CONSENT[_]REQUEST:%''
        OR notification.kind LIKE N''CUSTOMER[_]PERMISSION[_]REQUEST:%''
        OR notification.kind LIKE N''CUSTOMER[_]RECORDING[_]NOTICE:%''
      );
  ';
END;

IF OBJECT_ID(N'dbo.booking_notifications', N'U') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM sys.indexes
     WHERE object_id = OBJECT_ID(N'dbo.booking_notifications')
       AND name = N'booking_notifications_customerReadAt_createdAt_idx'
   )
BEGIN
  EXEC sys.sp_executesql N'
    CREATE INDEX booking_notifications_customerReadAt_createdAt_idx
      ON dbo.booking_notifications(customerReadAt, createdAt);
  ';
END;
