IF COL_LENGTH('dbo.reviews', 'source') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD source NVARCHAR(100) NOT NULL
      CONSTRAINT DF_reviews_source DEFAULT('customer');
END;
GO

IF COL_LENGTH('dbo.reviews', 'submittedVia') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD submittedVia NVARCHAR(100) NOT NULL
      CONSTRAINT DF_reviews_submittedVia DEFAULT('manual');
END;
GO

IF COL_LENGTH('dbo.reviews', 'bookingId') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD bookingId NVARCHAR(1000) NULL;
END;
GO

IF COL_LENGTH('dbo.reviews', 'mediaSessionId') IS NULL
BEGIN
  ALTER TABLE dbo.reviews
    ADD mediaSessionId NVARCHAR(1000) NULL;
END;
GO

IF OBJECT_ID(N'dbo.review_windows', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_windows (
    id NVARCHAR(1000) NOT NULL,
    bookingId NVARCHAR(1000) NOT NULL,
    vendorId NVARCHAR(1000) NOT NULL,
    mediaSessionId NVARCHAR(1000) NOT NULL,
    reviewId NVARCHAR(1000) NULL,
    status NVARCHAR(100) NOT NULL CONSTRAINT DF_review_windows_status DEFAULT('active'),
    openedAt DATETIME2 NOT NULL CONSTRAINT DF_review_windows_openedAt DEFAULT GETDATE(),
    expiresAt DATETIME2 NOT NULL,
    closedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_review_windows_createdAt DEFAULT GETDATE(),
    updatedAt DATETIME2 NOT NULL,
    CONSTRAINT PK_review_windows PRIMARY KEY (id),
    CONSTRAINT UQ_review_windows_reviewId UNIQUE (reviewId),
    CONSTRAINT FK_review_windows_booking FOREIGN KEY (bookingId) REFERENCES dbo.bookings(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_review_windows_vendor FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_review_windows_media_session FOREIGN KEY (mediaSessionId) REFERENCES dbo.media_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.review_prompt_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_prompt_events (
    id NVARCHAR(1000) NOT NULL,
    reviewWindowId NVARCHAR(1000) NOT NULL,
    eventType NVARCHAR(100) NOT NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_review_prompt_events_createdAt DEFAULT GETDATE(),
    CONSTRAINT PK_review_prompt_events PRIMARY KEY (id),
    CONSTRAINT FK_review_prompt_events_window FOREIGN KEY (reviewWindowId) REFERENCES dbo.review_windows(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.review_sentiments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_sentiments (
    id NVARCHAR(1000) NOT NULL,
    reviewWindowId NVARCHAR(1000) NOT NULL,
    sentiment NVARCHAR(100) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_review_sentiments_createdAt DEFAULT GETDATE(),
    CONSTRAINT PK_review_sentiments PRIMARY KEY (id),
    CONSTRAINT FK_review_sentiments_window FOREIGN KEY (reviewWindowId) REFERENCES dbo.review_windows(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.consent_records', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.consent_records (
    id NVARCHAR(1000) NOT NULL,
    token NVARCHAR(255) NOT NULL,
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
    updatedAt DATETIME2 NOT NULL,
    CONSTRAINT PK_consent_records PRIMARY KEY (id),
    CONSTRAINT UQ_consent_records_token UNIQUE (token),
    CONSTRAINT FK_consent_records_booking FOREIGN KEY (bookingId) REFERENCES dbo.bookings(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_consent_records_vendor FOREIGN KEY (vendorId) REFERENCES dbo.vendors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_consent_records_media_session FOREIGN KEY (mediaSessionId) REFERENCES dbo.media_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.consent_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.consent_events (
    id NVARCHAR(1000) NOT NULL,
    consentRecordId NVARCHAR(1000) NOT NULL,
    eventType NVARCHAR(100) NOT NULL,
    metadata NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_consent_events_createdAt DEFAULT GETDATE(),
    CONSTRAINT PK_consent_events PRIMARY KEY (id),
    CONSTRAINT FK_consent_events_record FOREIGN KEY (consentRecordId) REFERENCES dbo.consent_records(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.reviews', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_reviews_booking'
  )
  BEGIN
    ALTER TABLE dbo.reviews
      ADD CONSTRAINT FK_reviews_booking FOREIGN KEY (bookingId) REFERENCES dbo.bookings(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_reviews_media_session'
  )
  BEGIN
    ALTER TABLE dbo.reviews
      ADD CONSTRAINT FK_reviews_media_session FOREIGN KEY (mediaSessionId) REFERENCES dbo.media_sessions(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END;
END;
GO
