ALTER TABLE [dbo].[vendor_memberships]
ADD [membershipGeneration] INT NOT NULL
    CONSTRAINT [vendor_memberships_membershipGeneration_df] DEFAULT 1;

ALTER TABLE [dbo].[recording_gate_decision_evidence]
ADD [employeeParticipationEvidenceJson] NVARCHAR(MAX) NULL;

ALTER TABLE [dbo].[employee_public_media_consent_decisions]
ADD [membershipGeneration] INT NULL,
    [verificationSessionId] NVARCHAR(1000) NULL,
    [verifiedContactHash] NVARCHAR(64) NULL,
    [verifiedChannel] NVARCHAR(32) NULL,
    [consentTextHash] NVARCHAR(64) NULL,
    [ipAddress] NVARCHAR(1000) NULL,
    [userAgent] NVARCHAR(MAX) NULL;

CREATE TABLE [dbo].[employee_decision_verification_challenges] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [membershipGeneration] INT NOT NULL,
    [bookingId] NVARCHAR(1000) NULL,
    [assessmentId] NVARCHAR(1000) NULL,
    [assignmentGeneration] INT NULL,
    [purpose] NVARCHAR(100) NOT NULL,
    [contextHash] NVARCHAR(64) NOT NULL,
    [channel] NVARCHAR(32) NOT NULL,
    [destinationHash] NVARCHAR(64) NOT NULL,
    [codeHash] NVARCHAR(64) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [failedAttempts] INT NOT NULL CONSTRAINT [employee_decision_challenges_failedAttempts_df] DEFAULT 0,
    [maxAttempts] INT NOT NULL CONSTRAINT [employee_decision_challenges_maxAttempts_df] DEFAULT 5,
    [deliveryStatus] NVARCHAR(32) NOT NULL CONSTRAINT [employee_decision_challenges_deliveryStatus_df] DEFAULT 'PENDING',
    [deliveryReference] NVARCHAR(1000) NULL,
    [deliveryError] NVARCHAR(MAX) NULL,
    [requestIpHash] NVARCHAR(64) NULL,
    [consumedAt] DATETIME2 NULL,
    [verifiedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_decision_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_decision_verification_challenges_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_decision_challenges_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_decision_challenges_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_decision_challenges_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_decision_challenges_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_decision_challenges_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE [dbo].[employee_verified_decision_sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [challengeId] NVARCHAR(1000) NOT NULL,
    [secretHash] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [membershipGeneration] INT NOT NULL,
    [bookingId] NVARCHAR(1000) NULL,
    [assessmentId] NVARCHAR(1000) NULL,
    [assignmentGeneration] INT NULL,
    [purpose] NVARCHAR(100) NOT NULL,
    [contextHash] NVARCHAR(64) NOT NULL,
    [verifiedChannel] NVARCHAR(32) NOT NULL,
    [verifiedContactHash] NVARCHAR(64) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [consumedAt] DATETIME2 NULL,
    [consumedByType] NVARCHAR(100) NULL,
    [consumedById] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_verified_decision_sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_verified_decision_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_verified_decision_sessions_challengeId_key] UNIQUE NONCLUSTERED ([challengeId]),
    CONSTRAINT [employee_verified_decision_sessions_secretHash_key] UNIQUE NONCLUSTERED ([secretHash]),
    CONSTRAINT [employee_verified_sessions_challengeId_fkey] FOREIGN KEY ([challengeId]) REFERENCES [dbo].[employee_decision_verification_challenges]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_verified_sessions_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_verified_sessions_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_verified_sessions_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_verified_sessions_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_verified_sessions_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE [dbo].[employee_recording_participation_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [membershipGeneration] INT NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [assignmentGeneration] INT NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [assessmentGeneration] INT NOT NULL,
    [scopeHash] NVARCHAR(64) NOT NULL,
    [audioAllowed] BIT NOT NULL,
    [recordingBoundary] NVARCHAR(MAX) NOT NULL,
    [participantPlan] NVARCHAR(MAX) NOT NULL,
    [decision] NVARCHAR(32) NOT NULL,
    [policyVersion] NVARCHAR(100) NOT NULL,
    [contractVersion] INT NOT NULL CONSTRAINT [employee_recording_participation_contractVersion_df] DEFAULT 1,
    [consentTextSnapshot] NVARCHAR(MAX) NOT NULL,
    [consentTextHash] NVARCHAR(64) NOT NULL,
    [verificationSessionId] NVARCHAR(1000) NOT NULL,
    [verifiedContactHash] NVARCHAR(64) NOT NULL,
    [verifiedChannel] NVARCHAR(32) NOT NULL,
    [verificationMethod] NVARCHAR(100) NOT NULL,
    [ipAddress] NVARCHAR(1000) NULL,
    [userAgent] NVARCHAR(MAX) NULL,
    [evidenceHash] NVARCHAR(64) NOT NULL,
    [version] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [employee_recording_participation_isCurrent_df] DEFAULT 1,
    [capturedMediaAffected] BIT NOT NULL CONSTRAINT [employee_recording_participation_capturedMediaAffected_df] DEFAULT 0,
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_participation_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2 NULL,
    [invalidatedAt] DATETIME2 NULL,
    [invalidationReason] NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_participation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_recording_participation_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_recording_participation_evidenceHash_key] UNIQUE NONCLUSTERED ([evidenceHash]),
    CONSTRAINT [employee_recording_participation_booking_membership_version_key] UNIQUE NONCLUSTERED ([bookingId], [membershipId], [version]),
    CONSTRAINT [employee_recording_participation_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_recording_participation_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_recording_participation_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_recording_participation_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_recording_participation_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [employee_recording_participation_verificationSessionId_fkey] FOREIGN KEY ([verificationSessionId]) REFERENCES [dbo].[employee_verified_decision_sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [employee_decision_challenges_membership_purpose_channel_created_idx]
ON [dbo].[employee_decision_verification_challenges]([membershipId], [purpose], [channel], [createdAt]);

CREATE INDEX [employee_decision_challenges_requestIpHash_createdAt_idx]
ON [dbo].[employee_decision_verification_challenges]([requestIpHash], [createdAt]);

CREATE INDEX [employee_decision_challenges_expiresAt_consumedAt_idx]
ON [dbo].[employee_decision_verification_challenges]([expiresAt], [consumedAt]);

CREATE INDEX [employee_decision_challenges_contextHash_idx]
ON [dbo].[employee_decision_verification_challenges]([contextHash]);

CREATE INDEX [employee_verified_sessions_membership_purpose_expiry_idx]
ON [dbo].[employee_verified_decision_sessions]([membershipId], [purpose], [expiresAt], [consumedAt]);

CREATE INDEX [employee_verified_sessions_contextHash_idx]
ON [dbo].[employee_verified_decision_sessions]([contextHash]);

CREATE INDEX [employee_recording_participation_booking_membership_current_idx]
ON [dbo].[employee_recording_participation_decisions]([bookingId], [membershipId], [isCurrent]);

CREATE INDEX [employee_recording_participation_assessment_assignment_current_idx]
ON [dbo].[employee_recording_participation_decisions]([assessmentId], [assignmentGeneration], [isCurrent]);

CREATE INDEX [employee_recording_participation_verificationSessionId_idx]
ON [dbo].[employee_recording_participation_decisions]([verificationSessionId]);

CREATE INDEX [employee_recording_participation_decidedAt_idx]
ON [dbo].[employee_recording_participation_decisions]([decidedAt]);

EXEC(N'CREATE INDEX [employee_public_media_consent_verificationSessionId_idx]
ON [dbo].[employee_public_media_consent_decisions]([verificationSessionId])');

EXEC(N'ALTER TABLE [dbo].[employee_public_media_consent_decisions]
ADD CONSTRAINT [employee_public_media_consent_verificationSessionId_fkey]
FOREIGN KEY ([verificationSessionId]) REFERENCES [dbo].[employee_verified_decision_sessions]([id])
ON DELETE NO ACTION ON UPDATE NO ACTION');
