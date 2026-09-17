ALTER TABLE [dbo].[recording_scope_assessments]
ADD [contractVersion] NVARCHAR(1000) NULL;

CREATE INDEX [recording_scope_assessments_contractVersion_idx]
  ON [dbo].[recording_scope_assessments]([contractVersion]);
