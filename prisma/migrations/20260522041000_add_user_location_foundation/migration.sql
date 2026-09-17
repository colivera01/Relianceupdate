IF COL_LENGTH('dbo.users', 'address') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [address] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.users', 'city') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [city] NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.users', 'state') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [state] NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.users', 'zipCode') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [zipCode] NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.users', 'latitude') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [latitude] FLOAT NULL;
END;

IF COL_LENGTH('dbo.users', 'longitude') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [longitude] FLOAT NULL;
END;

IF COL_LENGTH('dbo.users', 'geocodedAt') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [geocodedAt] DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.users', 'locationPreferenceEnabled') IS NULL
BEGIN
  ALTER TABLE [dbo].[users] ADD [locationPreferenceEnabled] BIT NOT NULL CONSTRAINT [DF_users_locationPreferenceEnabled] DEFAULT 0;
END;

IF COL_LENGTH('dbo.vendors', 'latitude') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendors] ADD [latitude] FLOAT NULL;
END;

IF COL_LENGTH('dbo.vendors', 'longitude') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendors] ADD [longitude] FLOAT NULL;
END;

IF COL_LENGTH('dbo.vendors', 'geocodedAt') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendors] ADD [geocodedAt] DATETIME2 NULL;
END;
