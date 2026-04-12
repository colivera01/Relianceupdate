-- Persist wizard/customer fields on booking create (SQL Server).
IF COL_LENGTH('dbo.bookings', 'customerMetadata') IS NULL
BEGIN
  ALTER TABLE dbo.bookings
    ADD customerMetadata NVARCHAR(MAX) NULL;
END;
GO
