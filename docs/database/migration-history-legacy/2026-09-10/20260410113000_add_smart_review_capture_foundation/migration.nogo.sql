IF COL_LENGTH('dbo.reviews', 'source') IS NULL
BEGIN
  ALTER TABLE dbo.reviews ADD source NVARCHAR(100) NOT NULL CONSTRAINT DF_reviews_source DEFAULT('customer');
END;

IF COL_LENGTH('dbo.reviews', 'submittedVia') IS NULL
BEGIN
  ALTER TABLE dbo.reviews ADD submittedVia NVARCHAR(100) NOT NULL CONSTRAINT DF_reviews_submittedVia DEFAULT('manual');
END;

IF COL_LENGTH('dbo.reviews', 'bookingId') IS NULL
BEGIN
  ALTER TABLE dbo.reviews ADD bookingId NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.reviews', 'mediaSessionId') IS NULL
BEGIN
  ALTER TABLE dbo.reviews ADD mediaSessionId NVARCHAR(1000) NULL;
END;

IF OBJECT_ID(N'dbo.review_windows', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_windows (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    bookingId NVARCHAR(1000) NOT NULL,
    vendorId NVARCHAR(1000) NOT NULL,
    mediaSessionId NVARCHAR(1000) NOT NULL,
    reviewId NVARCHAR(1000) NULL UNIQUE,
    status NVARCHAR(100) NOT NULL CONSTRAINT DF_review_windows_status DEFAULT('active'),
    openedAt DATETIME2 NOT NULL CONSTRAINT DF_review_windows_openedAt DEFAULT GETDATE(),
    expiresAt DATETIME2 NOT NULL,
    closedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_review_windows_createdAt DEFAULT GETDATE(),
    updatedAt DATETIME2 NOT NULL
  );
END;

IF OBJECT_ID(N'dbo.review_prompt_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_prompt_events (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    reviewWindowId NVARCHAR(1000) NOT NULL,
    eventType NVARCHAR(100) NOT NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_review_prompt_events_createdAt DEFAULT GETDATE()
  );
END;

IF OBJECT_ID(N'dbo.review_sentiments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_sentiments (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    reviewWindowId NVARCHAR(1000) NOT NULL,
    sentiment NVARCHAR(100) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_review_sentiments_createdAt DEFAULT GETDATE()
  );
END;

IF OBJECT_ID(N'dbo.consent_records', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.consent_records (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    token NVARCHAR(255) NOT NULL UNIQUE,
    bookingId NVARCHAR(1000) NOT NULL,
    vendorId NVARCHAR(1000) NOT NULL,
    mediaSessionId NVARCHAR(1000) NOT NULL,
    consentType NVARCHAR(100) NOT NULL,
    status NVARCHAR(100) NOT NULL CONSTRAINT DF_consent_records_status DEFAULT('requested'),
    requestedAt DATETIME2 NOT NULL CONSTRAINT DF_consent_records_requestedAt DEFAULT GETDATE(),
    acceptedAt DATETIME2 NULL,
    declinedAt DATETIME2 NULL,
    expiresAt DATETIME2 NULL,
    termsVersion NVARCHAR(100) NULL,
    privacyVersion NVARCHAR(100) NULL,
    ipAddress NVARCHAR(255) NULL,
    userAgent NVARCHAR(1024) NULL,
    documentHash NVARCHAR(255) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_consent_records_createdAt DEFAULT GETDATE(),
    updatedAt DATETIME2 NOT NULL
  );
END;

IF OBJECT_ID(N'dbo.consent_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.consent_events (
    id NVARCHAR(1000) NOT NULL PRIMARY KEY,
    consentRecordId NVARCHAR(1000) NOT NULL,
    eventType NVARCHAR(100) NOT NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_consent_events_createdAt DEFAULT GETDATE()
  );
END;
