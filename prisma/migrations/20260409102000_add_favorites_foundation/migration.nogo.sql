IF OBJECT_ID(N'dbo.favorites', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.favorites (
    id NVARCHAR(1000) NOT NULL,
    userId NVARCHAR(1000) NOT NULL,
    serviceId NVARCHAR(1000) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_favorites_createdAt DEFAULT GETDATE(),
    updatedAt DATETIME2 NOT NULL,
    CONSTRAINT PK_favorites PRIMARY KEY (id),
    CONSTRAINT UQ_favorites_user_service UNIQUE (userId, serviceId),
    CONSTRAINT FK_favorites_user FOREIGN KEY (userId) REFERENCES dbo.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_favorites_service FOREIGN KEY (serviceId) REFERENCES dbo.services(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_favorites_user_created'
    AND object_id = OBJECT_ID(N'dbo.favorites')
)
BEGIN
  CREATE INDEX IX_favorites_user_created ON dbo.favorites(userId, createdAt DESC);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_favorites_service'
    AND object_id = OBJECT_ID(N'dbo.favorites')
)
BEGIN
  CREATE INDEX IX_favorites_service ON dbo.favorites(serviceId);
END;
