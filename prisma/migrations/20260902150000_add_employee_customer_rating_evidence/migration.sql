CREATE TABLE [dbo].[employee_customer_rating_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [reviewId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [customerUserId] NVARCHAR(1000) NOT NULL,
    [employeeMembershipId] NVARCHAR(1000) NOT NULL,
    [employeeUserId] NVARCHAR(1000) NOT NULL,
    [employeeNameSnapshot] NVARCHAR(1000) NOT NULL,
    [rating] INT NOT NULL,
    [evidenceVersion] INT NOT NULL CONSTRAINT [employee_customer_rating_evidence_evidenceVersion_df] DEFAULT 1,
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [employee_customer_rating_evidence_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_customer_rating_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_customer_rating_evidence_rating_check] CHECK ([rating] >= 1 AND [rating] <= 5),
    CONSTRAINT [employee_customer_rating_evidence_reviewId_fkey]
      FOREIGN KEY ([reviewId]) REFERENCES [dbo].[reviews]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [employee_customer_rating_evidence_reviewId_key]
  ON [dbo].[employee_customer_rating_evidence]([reviewId]);

CREATE UNIQUE NONCLUSTERED INDEX [employee_customer_rating_evidence_bookingId_key]
  ON [dbo].[employee_customer_rating_evidence]([bookingId]);

CREATE NONCLUSTERED INDEX [employee_customer_rating_evidence_vendorId_employeeMembershipId_submittedAt_idx]
  ON [dbo].[employee_customer_rating_evidence]([vendorId], [employeeMembershipId], [submittedAt]);

CREATE NONCLUSTERED INDEX [employee_customer_rating_evidence_employeeUserId_submittedAt_idx]
  ON [dbo].[employee_customer_rating_evidence]([employeeUserId], [submittedAt]);

CREATE NONCLUSTERED INDEX [employee_customer_rating_evidence_customerUserId_submittedAt_idx]
  ON [dbo].[employee_customer_rating_evidence]([customerUserId], [submittedAt]);
