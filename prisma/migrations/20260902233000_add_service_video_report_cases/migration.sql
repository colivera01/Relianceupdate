ALTER TABLE [dbo].[content_reports]
ADD [caseReference] NVARCHAR(1000) NULL,
    [contractVersion] INT NOT NULL CONSTRAINT [content_reports_contractVersion_df] DEFAULT 1,
    [accessBasis] NVARCHAR(1000) NULL,
    [packageId] NVARCHAR(1000) NULL,
    [packageVersion] INT NULL,
    [packageHash] NVARCHAR(1000) NULL,
    [stageEvidenceId] NVARCHAR(1000) NULL,
    [stage] NVARCHAR(1000) NULL,
    [stageVersion] INT NULL,
    [stageHash] NVARCHAR(1000) NULL,
    [mediaContentHash] NVARCHAR(1000) NULL,
    [adminAuditDecisionId] NVARCHAR(1000) NULL,
    [visibilityAtReport] NVARCHAR(1000) NULL,
    [policyCategory] NVARCHAR(1000) NULL,
    [groupingKey] NVARCHAR(1000) NULL,
    [lifecycleCaseId] NVARCHAR(1000) NULL,
    [publicHoldAppliedAt] DATETIME2 NULL,
    [notificationAttemptedAt] DATETIME2 NULL,
    [notificationFailedAt] DATETIME2 NULL,
    [notificationProviderResult] NVARCHAR(MAX) NULL,
    [reporterNotificationAttemptedAt] DATETIME2 NULL,
    [reporterNotificationSentAt] DATETIME2 NULL,
    [reporterNotificationFailedAt] DATETIME2 NULL,
    [reporterNotificationProviderResult] NVARCHAR(MAX) NULL,
    [closedAt] DATETIME2 NULL;

CREATE TABLE [dbo].[content_report_requests] (
    [id] NVARCHAR(1000) NOT NULL,
    [idempotencyKey] NVARCHAR(1000) NOT NULL,
    [semanticKey] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000) NOT NULL,
    [reporterUserId] NVARCHAR(1000) NOT NULL,
    [targetType] NVARCHAR(1000) NOT NULL,
    [targetId] NVARCHAR(1000) NOT NULL,
    [payloadHash] NVARCHAR(1000) NOT NULL,
    [reportId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [content_report_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [content_report_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [content_report_requests_reportId_fkey] FOREIGN KEY ([reportId]) REFERENCES [dbo].[content_reports]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE [dbo].[content_report_case_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [reportId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(1000) NULL,
    [actorRole] NVARCHAR(1000) NOT NULL,
    [priorStatus] NVARCHAR(1000) NULL,
    [resultingStatus] NVARCHAR(1000) NULL,
    [reason] NVARCHAR(MAX) NULL,
    [metadataJson] NVARCHAR(MAX) NOT NULL,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [content_report_case_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [content_report_case_events_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [content_report_case_events_reportId_fkey] FOREIGN KEY ([reportId]) REFERENCES [dbo].[content_reports]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

EXEC(N'CREATE UNIQUE INDEX [content_reports_caseReference_key] ON [dbo].[content_reports]([caseReference]) WHERE [caseReference] IS NOT NULL;');
EXEC(N'CREATE INDEX [content_reports_packageId_createdAt_idx] ON [dbo].[content_reports]([packageId], [createdAt]);');
EXEC(N'CREATE INDEX [content_reports_groupingKey_createdAt_idx] ON [dbo].[content_reports]([groupingKey], [createdAt]);');
EXEC(N'CREATE INDEX [content_reports_lifecycleCaseId_idx] ON [dbo].[content_reports]([lifecycleCaseId]);');
EXEC(N'CREATE UNIQUE INDEX [content_report_requests_idempotencyKey_key] ON [dbo].[content_report_requests]([idempotencyKey]);');
EXEC(N'CREATE UNIQUE INDEX [content_report_requests_semanticKey_key] ON [dbo].[content_report_requests]([semanticKey]);');
EXEC(N'CREATE UNIQUE INDEX [content_report_requests_reportId_key] ON [dbo].[content_report_requests]([reportId]);');
EXEC(N'CREATE INDEX [content_report_requests_reporterUserId_targetType_targetId_createdAt_idx] ON [dbo].[content_report_requests]([reporterUserId], [targetType], [targetId], [createdAt]);');
EXEC(N'CREATE INDEX [content_report_case_events_reportId_createdAt_idx] ON [dbo].[content_report_case_events]([reportId], [createdAt]);');
EXEC(N'CREATE INDEX [content_report_case_events_eventType_createdAt_idx] ON [dbo].[content_report_case_events]([eventType], [createdAt]);');
EXEC(N'CREATE INDEX [content_report_case_events_evidenceHash_idx] ON [dbo].[content_report_case_events]([evidenceHash]);');
