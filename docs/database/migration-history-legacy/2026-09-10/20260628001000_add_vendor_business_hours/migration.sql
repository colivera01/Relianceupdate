IF COL_LENGTH('dbo.vendors', 'businessHoursJson') IS NULL
BEGIN
  ALTER TABLE [dbo].[vendors] ADD [businessHoursJson] NVARCHAR(MAX) NULL;
END;
