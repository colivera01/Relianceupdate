IF COL_LENGTH('dbo.vendor_invites', 'inviteeName') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendor_invites] ADD [inviteeName] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.vendor_invites', 'inviteeEmail') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendor_invites] ADD [inviteeEmail] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.vendor_invites', 'inviteePhone') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendor_invites] ADD [inviteePhone] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.vendor_invites', 'inviteeRole') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendor_invites] ADD [inviteeRole] NVARCHAR(1000) NULL;
END;
