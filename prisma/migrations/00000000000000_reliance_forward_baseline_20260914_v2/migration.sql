BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[vendors] (
    [id] NVARCHAR(1000) NOT NULL,
    [firstName] NVARCHAR(1000),
    [lastName] NVARCHAR(1000),
    [name] NVARCHAR(1000) NOT NULL,
    [businessName] NVARCHAR(1000),
    [businessType] NVARCHAR(1000),
    [category] NVARCHAR(1000),
    [foundedYear] INT,
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [city] NVARCHAR(1000),
    [state] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [zipCode] NVARCHAR(1000),
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [geocodedAt] DATETIME2,
    [bio] NVARCHAR(1000),
    [website] NVARCHAR(1000),
    [licenseNumber] NVARCHAR(1000),
    [insuranceStatus] BIT NOT NULL CONSTRAINT [vendors_insuranceStatus_df] DEFAULT 0,
    [insuranceProvider] NVARCHAR(1000),
    [insuranceExpiry] DATETIME2,
    [bondingStatus] BIT NOT NULL CONSTRAINT [vendors_bondingStatus_df] DEFAULT 0,
    [emergencyContact] NVARCHAR(1000),
    [responseTimeSettings] NVARCHAR(1000),
    [businessHoursJson] NVARCHAR(max),
    [profilePhoto] NVARCHAR(1000),
    [serviceTypes] NVARCHAR(1000),
    [specializations] NVARCHAR(1000),
    [serviceAreas] NVARCHAR(1000),
    [paymentsEnabled] BIT NOT NULL CONSTRAINT [vendors_paymentsEnabled_df] DEFAULT 0,
    [reminders_review] BIT NOT NULL CONSTRAINT [vendors_reminders_review_df] DEFAULT 1,
    [reminders_invoice] BIT NOT NULL CONSTRAINT [vendors_reminders_invoice_df] DEFAULT 0,
    [reminders_maintenance] BIT NOT NULL CONSTRAINT [vendors_reminders_maintenance_df] DEFAULT 1,
    [reminders_followUp] BIT NOT NULL CONSTRAINT [vendors_reminders_followUp_df] DEFAULT 1,
    [notifications_job] BIT NOT NULL CONSTRAINT [vendors_notifications_job_df] DEFAULT 1,
    [notifications_review] BIT NOT NULL CONSTRAINT [vendors_notifications_review_df] DEFAULT 1,
    [notifications_payout] BIT NOT NULL CONSTRAINT [vendors_notifications_payout_df] DEFAULT 0,
    [notifications_support] BIT NOT NULL CONSTRAINT [vendors_notifications_support_df] DEFAULT 1,
    [notifications_marketing] BIT NOT NULL CONSTRAINT [vendors_notifications_marketing_df] DEFAULT 0,
    [notifications_updates] BIT NOT NULL CONSTRAINT [vendors_notifications_updates_df] DEFAULT 1,
    [twoFactorEnabled] BIT NOT NULL CONSTRAINT [vendors_twoFactorEnabled_df] DEFAULT 0,
    [loginNotifications] BIT NOT NULL CONSTRAINT [vendors_loginNotifications_df] DEFAULT 1,
    [sessionTimeout] INT NOT NULL CONSTRAINT [vendors_sessionTimeout_df] DEFAULT 30,
    [passwordExpiry] INT,
    [failedLoginLockout] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendors_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [demo] BIT NOT NULL CONSTRAINT [vendors_demo_df] DEFAULT 0,
    [seedBatchId] NVARCHAR(1000),
    [planKey] NVARCHAR(1000) NOT NULL CONSTRAINT [vendors_planKey_df] DEFAULT 'FREE',
    [storageLimitBytes] BIGINT NOT NULL CONSTRAINT [vendors_storageLimitBytes_df] DEFAULT 1073741824,
    [isOverLimit] BIT NOT NULL CONSTRAINT [vendors_isOverLimit_df] DEFAULT 0,
    [overLimitSince] DATETIME2,
    [isPubliclyListed] BIT NOT NULL CONSTRAINT [vendors_isPubliclyListed_df] DEFAULT 0,
    [publiclyListedAt] DATETIME2,
    [accountStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [vendors_accountStatus_df] DEFAULT 'active',
    [accountStatusUpdatedAt] DATETIME2,
    [accountStatusReason] NVARCHAR(1000),
    [accountStatusAdminNotes] NVARCHAR(max),
    CONSTRAINT [vendors_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendors_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[employees] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [photoUrl] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employees_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [demo] BIT NOT NULL CONSTRAINT [employees_demo_df] DEFAULT 0,
    [seedBatchId] NVARCHAR(1000),
    CONSTRAINT [employees_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[services] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [price] FLOAT(53) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [services_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [demo] BIT NOT NULL CONSTRAINT [services_demo_df] DEFAULT 0,
    [seedBatchId] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [services_isPublished_df] DEFAULT 0,
    [publishedAt] DATETIME2,
    CONSTRAINT [services_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[promotion_campaigns] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [serviceId] NVARCHAR(1000),
    [name] NVARCHAR(1000) NOT NULL,
    [packageKey] NVARCHAR(1000) NOT NULL CONSTRAINT [promotion_campaigns_packageKey_df] DEFAULT 'browse-local-7-day',
    [packageSnapshotJson] NVARCHAR(max),
    [packageSnapshotAt] DATETIME2,
    [placementType] NVARCHAR(1000) NOT NULL CONSTRAINT [promotion_campaigns_placementType_df] DEFAULT 'BROWSE_FEATURED',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [promotion_campaigns_status_df] DEFAULT 'draft',
    [paymentStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [promotion_campaigns_paymentStatus_df] DEFAULT 'not_started',
    [startAt] DATETIME2 NOT NULL,
    [endAt] DATETIME2 NOT NULL,
    [targetCategory] NVARCHAR(1000),
    [targetCity] NVARCHAR(1000),
    [targetState] NVARCHAR(1000),
    [targetZip] NVARCHAR(1000),
    [targetRadiusMiles] INT NOT NULL CONSTRAINT [promotion_campaigns_targetRadiusMiles_df] DEFAULT 10,
    [rankPriority] INT NOT NULL CONSTRAINT [promotion_campaigns_rankPriority_df] DEFAULT 100,
    [adminNotes] NVARCHAR(max),
    [amountDueCents] INT NOT NULL CONSTRAINT [promotion_campaigns_amountDueCents_df] DEFAULT 0,
    [stripePaymentLinkUrl] NVARCHAR(2048),
    [paymentReference] NVARCHAR(1000),
    [paidAt] DATETIME2,
    [paymentNotes] NVARCHAR(max),
    [createdByUserId] NVARCHAR(1000),
    [approvedByUserId] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [pausedAt] DATETIME2,
    [endedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [promotion_campaigns_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [promotion_campaigns_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[promotion_packages] (
    [id] NVARCHAR(1000) NOT NULL,
    [packageKey] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [publicSummary] NVARCHAR(1000) NOT NULL,
    [adminDescription] NVARCHAR(max) NOT NULL,
    [bestFor] NVARCHAR(1000) NOT NULL,
    [placementExplanation] NVARCHAR(1000) NOT NULL,
    [audience] NVARCHAR(1000) NOT NULL,
    [placementType] NVARCHAR(1000) NOT NULL,
    [durationDays] INT NOT NULL,
    [defaultRadiusMiles] INT NOT NULL,
    [maxRadiusMiles] INT NOT NULL,
    [allowCategoryTargeting] BIT NOT NULL CONSTRAINT [promotion_packages_allowCategoryTargeting_df] DEFAULT 0,
    [maxConcurrentInZone] INT NOT NULL,
    [defaultPriceCents] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [promotion_packages_isActive_df] DEFAULT 1,
    [isFoundingRate] BIT NOT NULL CONSTRAINT [promotion_packages_isFoundingRate_df] DEFAULT 0,
    [pricingLabel] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [promotion_packages_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [promotion_packages_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [promotion_packages_packageKey_key] UNIQUE NONCLUSTERED ([packageKey])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [profilePhoto] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [city] NVARCHAR(1000),
    [state] NVARCHAR(1000),
    [zipCode] NVARCHAR(1000),
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [geocodedAt] DATETIME2,
    [locationPreferenceEnabled] BIT NOT NULL CONSTRAINT [users_locationPreferenceEnabled_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [demo] BIT NOT NULL CONSTRAINT [users_demo_df] DEFAULT 0,
    [seedBatchId] NVARCHAR(1000),
    [accountStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [users_accountStatus_df] DEFAULT 'active',
    [accountStatusUpdatedAt] DATETIME2,
    [accountStatusReason] NVARCHAR(1000),
    [accountStatusAdminNotes] NVARCHAR(max),
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[policy_document_versions] (
    [id] NVARCHAR(1000) NOT NULL,
    [policyId] NVARCHAR(1000) NOT NULL,
    [version] NVARCHAR(1000) NOT NULL,
    [effectiveAt] DATETIME2 NOT NULL,
    [contentHash] NVARCHAR(1000) NOT NULL,
    [contentSnapshot] NVARCHAR(max) NOT NULL,
    [sourceRevision] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [policy_document_versions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [policy_document_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [policy_document_versions_contentHash_key] UNIQUE NONCLUSTERED ([contentHash]),
    CONSTRAINT [policy_document_versions_policyId_version_key] UNIQUE NONCLUSTERED ([policyId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[customer_registration_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [actorEmail] NVARCHAR(1000) NOT NULL,
    [actorRole] NVARCHAR(1000) NOT NULL CONSTRAINT [customer_registration_evidence_actorRole_df] DEFAULT 'CUSTOMER',
    [registeredAt] DATETIME2 NOT NULL,
    [termsPolicyVersionId] NVARCHAR(1000) NOT NULL,
    [privacyPolicyVersionId] NVARCHAR(1000) NOT NULL,
    [smsPolicyVersionId] NVARCHAR(1000),
    [termsAcceptedAt] DATETIME2 NOT NULL,
    [privacyAcknowledgedAt] DATETIME2 NOT NULL,
    [smsOptIn] BIT NOT NULL CONSTRAINT [customer_registration_evidence_smsOptIn_df] DEFAULT 0,
    [smsDecisionAt] DATETIME2 NOT NULL,
    [registrationIp] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [verificationCompletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [customer_registration_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [customer_registration_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[platform_role_grants] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [platform_role_grants_status_df] DEFAULT 'ACTIVE',
    [grantedAt] DATETIME2 NOT NULL CONSTRAINT [platform_role_grants_grantedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [grantedByUserId] NVARCHAR(1000),
    [revokedAt] DATETIME2,
    [revokedByUserId] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [platform_role_grants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [platform_role_grants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [platform_role_grants_userId_role_key] UNIQUE NONCLUSTERED ([userId],[role])
);

-- CreateTable
CREATE TABLE [dbo].[auth_credentials] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [emailVerifiedAt] DATETIME2,
    [passwordUpdatedAt] DATETIME2 NOT NULL CONSTRAINT [auth_credentials_passwordUpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_credentials_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [auth_credentials_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [auth_credentials_userId_key] UNIQUE NONCLUSTERED ([userId]),
    CONSTRAINT [auth_credentials_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[auth_passkeys] (
    [id] NVARCHAR(1000) NOT NULL,
    [credentialId] NVARCHAR(1000) NOT NULL,
    [credentialPublicKey] NVARCHAR(1000) NOT NULL,
    [webauthnUserId] NVARCHAR(1000) NOT NULL,
    [counter] INT NOT NULL CONSTRAINT [auth_passkeys_counter_df] DEFAULT 0,
    [transportsJson] NVARCHAR(1000),
    [deviceType] NVARCHAR(1000) NOT NULL,
    [backedUp] BIT NOT NULL CONSTRAINT [auth_passkeys_backedUp_df] DEFAULT 0,
    [label] NVARCHAR(1000),
    [lastUsedAt] DATETIME2,
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_passkeys_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [authCredentialId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [auth_passkeys_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [auth_passkeys_credentialId_key] UNIQUE NONCLUSTERED ([credentialId])
);

-- CreateTable
CREATE TABLE [dbo].[auth_passkey_challenges] (
    [id] NVARCHAR(1000) NOT NULL,
    [authCredentialId] NVARCHAR(1000) NOT NULL,
    [challenge] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [consumedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_passkey_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [auth_passkey_challenges_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[email_verification_tokens] (
    [id] NVARCHAR(1000) NOT NULL,
    [credentialId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [consumedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [email_verification_tokens_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [email_verification_tokens_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [email_verification_tokens_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[auth_mfa_challenges] (
    [id] NVARCHAR(1000) NOT NULL,
    [credentialId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [codeHash] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [consumedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_mfa_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [auth_mfa_challenges_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[auth_trusted_devices] (
    [id] NVARCHAR(1000) NOT NULL,
    [credentialId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000),
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [lastUsedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [auth_trusted_devices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [auth_trusted_devices_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [auth_trusted_devices_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[bookings] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [serviceId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000),
    [clientName] NVARCHAR(1000),
    [amount] DECIMAL(32,16),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [bookings_status_df] DEFAULT 'PENDING',
    [scheduledFor] DATETIME2,
    [date] DATETIME2,
    [rejectionReason] NVARCHAR(1000),
    [rejectedAt] DATETIME2,
    [rejectedBy] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [bookings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [demo] BIT NOT NULL CONSTRAINT [bookings_demo_df] DEFAULT 0,
    [seedBatchId] NVARCHAR(1000),
    [customerMetadata] NVARCHAR(max),
    [creationRequestKey] NVARCHAR(255),
    CONSTRAINT [bookings_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[customer_service_record_organization_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [customerUserId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [sequence] INT NOT NULL,
    [requestId] NVARCHAR(255) NOT NULL,
    [requestHash] NVARCHAR(1000) NOT NULL,
    [previousEventId] NVARCHAR(1000),
    [previousEvidenceHash] NVARCHAR(1000),
    [evidenceVersion] INT NOT NULL CONSTRAINT [customer_service_record_organization_events_evidenceVersion_df] DEFAULT 1,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [actedAt] DATETIME2 NOT NULL CONSTRAINT [customer_service_record_organization_events_actedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [customer_service_record_organization_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [customer_service_record_organization_events_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [customer_service_record_organization_events_bookingId_customerUserId_sequence_key] UNIQUE NONCLUSTERED ([bookingId],[customerUserId],[sequence]),
    CONSTRAINT [customer_service_record_organization_events_bookingId_customerUserId_requestId_key] UNIQUE NONCLUSTERED ([bookingId],[customerUserId],[requestId])
);

-- CreateTable
CREATE TABLE [dbo].[recording_scope_assessments] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [generation] INT NOT NULL CONSTRAINT [recording_scope_assessments_generation_df] DEFAULT 1,
    [isCurrent] BIT NOT NULL CONSTRAINT [recording_scope_assessments_isCurrent_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_scope_assessments_status_df] DEFAULT 'COMPLETE',
    [contractVersion] NVARCHAR(1000),
    [locationType] NVARCHAR(1000) NOT NULL,
    [riskLevel] NVARCHAR(1000) NOT NULL,
    [propertyScope] NVARCHAR(1000) NOT NULL,
    [peopleScope] NVARCHAR(1000) NOT NULL,
    [frameControl] NVARCHAR(1000) NOT NULL,
    [subjectJson] NVARCHAR(max) NOT NULL,
    [scopeJson] NVARCHAR(max) NOT NULL,
    [scopeHash] NVARCHAR(1000) NOT NULL,
    [audioRequested] BIT NOT NULL CONSTRAINT [recording_scope_assessments_audioRequested_df] DEFAULT 0,
    [audioAllowed] BIT NOT NULL CONSTRAINT [recording_scope_assessments_audioAllowed_df] DEFAULT 0,
    [permissionRequired] BIT NOT NULL,
    [noticeRequired] BIT NOT NULL CONSTRAINT [recording_scope_assessments_noticeRequired_df] DEFAULT 1,
    [serviceCanContinueWithoutRecording] BIT NOT NULL,
    [essentialPrivateRecording] BIT NOT NULL CONSTRAINT [recording_scope_assessments_essentialPrivateRecording_df] DEFAULT 0,
    [authorityHolderType] NVARCHAR(1000) NOT NULL,
    [completedByUserId] NVARCHAR(1000) NOT NULL,
    [completedAt] DATETIME2 NOT NULL CONSTRAINT [recording_scope_assessments_completedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_scope_assessments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [recording_scope_assessments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [recording_scope_assessments_bookingId_generation_key] UNIQUE NONCLUSTERED ([bookingId],[generation])
);

-- CreateTable
CREATE TABLE [dbo].[recording_authority_requirements] (
    [id] NVARCHAR(1000) NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [authorityType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_authority_requirements_status_df] DEFAULT 'PENDING',
    [required] BIT NOT NULL CONSTRAINT [recording_authority_requirements_required_df] DEFAULT 1,
    [actorUserId] NVARCHAR(1000),
    [evidenceReference] NVARCHAR(1000),
    [verifiedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_authority_requirements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [recording_authority_requirements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [recording_authority_requirements_assessmentId_authorityType_key] UNIQUE NONCLUSTERED ([assessmentId],[authorityType])
);

-- CreateTable
CREATE TABLE [dbo].[employee_recording_certifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [assignmentGeneration] INT NOT NULL,
    [scopeHash] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [employee_recording_certifications_status_df] DEFAULT 'ACTIVE',
    [certifiedByUserId] NVARCHAR(1000) NOT NULL,
    [certifiedAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_certifications_certifiedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [invalidatedAt] DATETIME2,
    [invalidationReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_certifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [employee_recording_certifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[employee_recording_safety_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [assessmentGeneration] INT NOT NULL,
    [assessmentContractVersion] NVARCHAR(1000) NOT NULL,
    [assessmentScopeHash] NVARCHAR(64) NOT NULL,
    [locationSnapshotEvidenceHash] NVARCHAR(64) NOT NULL,
    [locationAttemptId] NVARCHAR(1000),
    [locationAttemptEvidenceHash] NVARCHAR(64),
    [membershipId] NVARCHAR(1000) NOT NULL,
    [assignmentGeneration] INT NOT NULL,
    [safetyContractVersion] NVARCHAR(100) NOT NULL,
    [checkType] NVARCHAR(64) NOT NULL,
    [stage] NVARCHAR(64) NOT NULL,
    [result] NVARCHAR(64) NOT NULL,
    [issueCodesJson] NVARCHAR(max) NOT NULL,
    [sequence] INT NOT NULL,
    [chainKey] NVARCHAR(64) NOT NULL,
    [predecessorEvidenceId] NVARCHAR(1000),
    [predecessorEvidenceHash] NVARCHAR(64),
    [submissionRequestHash] NVARCHAR(64),
    [submissionBodyHash] NVARCHAR(64),
    [canonicalJson] NVARCHAR(max) NOT NULL,
    [evidenceHash] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_recording_safety_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_recording_safety_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_recording_safety_evidence_evidenceHash_key] UNIQUE NONCLUSTERED ([evidenceHash]),
    CONSTRAINT [employee_recording_safety_evidence_chainKey_sequence_key] UNIQUE NONCLUSTERED ([chainKey],[sequence])
);

-- CreateTable
CREATE TABLE [dbo].[recording_location_attempts] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000),
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [assessmentGeneration] INT,
    [assignmentGeneration] INT,
    [stage] NVARCHAR(64),
    [snapshotEvidenceHash] NVARCHAR(64),
    [status] NVARCHAR(1000) NOT NULL,
    [resultCode] NVARCHAR(1000) NOT NULL,
    [method] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_location_attempts_method_df] DEFAULT 'DEVICE_GEOLOCATION',
    [distanceMeters] INT,
    [accuracyMeters] INT,
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [capturedAt] DATETIME2,
    [evidenceVersion] NVARCHAR(100),
    [canonicalJson] NVARCHAR(max),
    [evidenceHash] NVARCHAR(64),
    [actorUserId] NVARCHAR(1000),
    [attemptedAt] DATETIME2 NOT NULL CONSTRAINT [recording_location_attempts_attemptedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_location_attempts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [recording_location_attempts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[recording_location_exceptions] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [requestedByUserId] NVARCHAR(1000) NOT NULL,
    [requestedByMembershipId] NVARCHAR(1000),
    [reason] NVARCHAR(max) NOT NULL,
    [evidenceJson] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_location_exceptions_status_df] DEFAULT 'PENDING',
    [decidedByAdminUserId] NVARCHAR(1000),
    [decisionNote] NVARCHAR(max),
    [decidedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_location_exceptions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [recording_location_exceptions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[recording_gate_metrics] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [surface] NVARCHAR(1000) NOT NULL,
    [blockReason] NVARCHAR(1000) NOT NULL,
    [responsibleParticipant] NVARCHAR(1000) NOT NULL,
    [actorKind] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_gate_metrics_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [recording_gate_metrics_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[recording_gate_decision_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [assessmentGeneration] INT NOT NULL,
    [scopeHash] NVARCHAR(1000) NOT NULL,
    [permissionBasis] NVARCHAR(1000) NOT NULL,
    [permissionEvidenceId] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000),
    [certificationId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [assignmentGeneration] INT NOT NULL,
    [locationAttemptId] NVARCHAR(1000),
    [locationAttemptEvidenceHash] NVARCHAR(64),
    [locationExceptionId] NVARCHAR(1000),
    [safetyEvidenceId] NVARCHAR(1000),
    [safetyEvidenceHash] NVARCHAR(64),
    [stage] NVARCHAR(64),
    [evidenceVersion] NVARCHAR(100),
    [surface] NVARCHAR(1000) NOT NULL,
    [actorKind] NVARCHAR(1000),
    [decision] NVARCHAR(1000) NOT NULL CONSTRAINT [recording_gate_decision_evidence_decision_df] DEFAULT 'ALLOWED',
    [audioExpected] BIT NOT NULL CONSTRAINT [recording_gate_decision_evidence_audioExpected_df] DEFAULT 0,
    [audioContractVersion] INT NOT NULL CONSTRAINT [recording_gate_decision_evidence_audioContractVersion_df] DEFAULT 1,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [snapshotJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [recording_gate_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [recording_gate_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_upload_attempts] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [mediaSessionId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [stage] NVARCHAR(1000) NOT NULL,
    [captureProvenance] NVARCHAR(1000) NOT NULL,
    [state] NVARCHAR(1000) NOT NULL CONSTRAINT [media_upload_attempts_state_df] DEFAULT 'UPLOADING',
    [blobKey] NVARCHAR(1000) NOT NULL,
    [expectedBytes] BIGINT NOT NULL,
    [actualBytes] BIGINT,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [durationSeconds] FLOAT(53),
    [audioExpected] BIT NOT NULL CONSTRAINT [media_upload_attempts_audioExpected_df] DEFAULT 0,
    [audioPresence] NVARCHAR(1000) NOT NULL CONSTRAINT [media_upload_attempts_audioPresence_df] DEFAULT 'LEGACY_UNKNOWN',
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [media_upload_attempts_audioEvidenceVersion_df] DEFAULT 1,
    [failureCode] NVARCHAR(1000),
    [failureMessage] NVARCHAR(1000),
    [attemptCount] INT NOT NULL CONSTRAINT [media_upload_attempts_attemptCount_df] DEFAULT 1,
    [savedAt] DATETIME2,
    [rejectedAt] DATETIME2,
    [retryRequiredAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_upload_attempts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_upload_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [media_upload_attempts_assetId_key] UNIQUE NONCLUSTERED ([assetId])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_stage_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [stage] NVARCHAR(1000) NOT NULL,
    [stageVersion] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [service_video_stage_evidence_isCurrent_df] DEFAULT 1,
    [mediaSessionId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [assessmentId] NVARCHAR(1000) NOT NULL,
    [assessmentGeneration] INT NOT NULL,
    [permissionBasis] NVARCHAR(1000) NOT NULL,
    [permissionEvidenceId] NVARCHAR(1000) NOT NULL,
    [recordingGateDecisionId] NVARCHAR(1000) NOT NULL,
    [employeeMembershipId] NVARCHAR(1000) NOT NULL,
    [captureProvenance] NVARCHAR(1000) NOT NULL,
    [contentHash] NVARCHAR(1000) NOT NULL,
    [hashAlgorithm] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_stage_evidence_hashAlgorithm_df] DEFAULT 'SHA-256',
    [verifiedDurationSeconds] FLOAT(53) NOT NULL,
    [audioExpected] BIT NOT NULL CONSTRAINT [service_video_stage_evidence_audioExpected_df] DEFAULT 0,
    [audioPresence] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_stage_evidence_audioPresence_df] DEFAULT 'LEGACY_UNKNOWN',
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [service_video_stage_evidence_audioEvidenceVersion_df] DEFAULT 1,
    [uploadState] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_stage_evidence_uploadState_df] DEFAULT 'SAVED',
    [replacesStageEvidenceId] NVARCHAR(1000),
    [publicEligible] BIT NOT NULL CONSTRAINT [service_video_stage_evidence_publicEligible_df] DEFAULT 0,
    [savedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_stage_evidence_savedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_stage_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_stage_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_stage_evidence_mediaAssetId_key] UNIQUE NONCLUSTERED ([mediaAssetId]),
    CONSTRAINT [service_video_stage_evidence_bookingId_stage_stageVersion_key] UNIQUE NONCLUSTERED ([bookingId],[stage],[stageVersion])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_package_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [service_video_package_evidence_isCurrent_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_package_evidence_status_df] DEFAULT 'AWAITING_MANAGER_REVIEW',
    [stageEvidenceJson] NVARCHAR(max) NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [audioExpected] BIT NOT NULL CONSTRAINT [service_video_package_evidence_audioExpected_df] DEFAULT 0,
    [audioConformance] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_package_evidence_audioConformance_df] DEFAULT 'LEGACY_VIDEO_ONLY',
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [service_video_package_evidence_audioEvidenceVersion_df] DEFAULT 1,
    [submittedByUserId] NVARCHAR(1000),
    [submittedByMembershipId] NVARCHAR(1000) NOT NULL,
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_evidence_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [managerDecisionId] NVARCHAR(1000),
    [adminAuditDecisionId] NVARCHAR(1000),
    [customerAccessGrantId] NVARCHAR(1000),
    [auditEvidenceVersion] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [service_video_package_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_package_evidence_bookingId_version_key] UNIQUE NONCLUSTERED ([bookingId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_manager_decision_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [targetedStagesJson] NVARCHAR(max) NOT NULL,
    [reason] NVARCHAR(1000),
    [managerUserId] NVARCHAR(1000) NOT NULL,
    [managerMembershipId] NVARCHAR(1000) NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [packageVersion] INT,
    [attestationJson] NVARCHAR(max),
    [attestationHash] NVARCHAR(1000),
    [evidenceVersion] INT NOT NULL CONSTRAINT [service_video_manager_decision_evidence_evidenceVersion_df] DEFAULT 1,
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_manager_decision_evidence_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_manager_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_manager_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_admin_audit_decision_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [packageVersion] INT NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [stageEvidenceJson] NVARCHAR(max) NOT NULL,
    [managerDecisionId] NVARCHAR(1000) NOT NULL,
    [adminUserId] NVARCHAR(1000) NOT NULL,
    [adminRole] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_adminRole_df] DEFAULT 'ADMIN',
    [decision] NVARCHAR(1000) NOT NULL,
    [rejectionCategory] NVARCHAR(1000),
    [reason] NVARCHAR(max),
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [evidenceVersion] INT NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_evidenceVersion_df] DEFAULT 1,
    [customerProofReleased] BIT NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_customerProofReleased_df] DEFAULT 0,
    [customerAccessGrantId] NVARCHAR(1000),
    [customerNotificationId] NVARCHAR(1000),
    [publicDisplayEligibility] NVARCHAR(1000),
    [publicDisplayReason] NVARCHAR(max),
    [publicEligibilityHash] NVARCHAR(1000),
    [publicEligibilityEvidenceVersion] INT,
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_admin_audit_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_admin_audit_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_admin_audit_decision_evidence_packageId_key] UNIQUE NONCLUSTERED ([packageId])
);

-- CreateTable
CREATE TABLE [dbo].[private_proof_access_grants] (
    [id] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [customerUserId] NVARCHAR(1000) NOT NULL,
    [managerDecisionId] NVARCHAR(1000) NOT NULL,
    [adminAuditDecisionId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [private_proof_access_grants_status_df] DEFAULT 'ACTIVE',
    [grantedByUserId] NVARCHAR(1000) NOT NULL,
    [grantedAt] DATETIME2 NOT NULL CONSTRAINT [private_proof_access_grants_grantedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [private_proof_access_grants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [private_proof_access_grants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [private_proof_access_grants_packageId_key] UNIQUE NONCLUSTERED ([packageId])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_proposals] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [packageVersion] INT NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [service_video_publication_proposals_isCurrent_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_proposals_status_df] DEFAULT 'AWAITING_CUSTOMER_DECISION',
    [audience] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_proposals_audience_df] DEFAULT 'PUBLIC',
    [proposalHash] NVARCHAR(1000) NOT NULL,
    [contractVersion] INT NOT NULL CONSTRAINT [service_video_publication_proposals_contractVersion_df] DEFAULT 1,
    [authorizationModel] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_proposals_authorizationModel_df] DEFAULT 'LEGACY_STAGE_SELECTION',
    [packageVisibilityDecisionId] NVARCHAR(1000),
    [proposedByUserId] NVARCHAR(1000) NOT NULL,
    [proposedByMembershipId] NVARCHAR(1000),
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_proposals_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_proposals_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [service_video_publication_proposals_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_publication_proposals_bookingId_version_key] UNIQUE NONCLUSTERED ([bookingId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_package_visibility_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [customerUserId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [packageVersion] INT NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [stageEvidenceJson] NVARCHAR(max) NOT NULL,
    [stageSetHash] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [service_video_package_visibility_decisions_isCurrent_df] DEFAULT 1,
    [evidenceVersion] INT NOT NULL CONSTRAINT [service_video_package_visibility_decisions_evidenceVersion_df] DEFAULT 2,
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [publicationProposalId] NVARCHAR(1000),
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_visibility_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_package_visibility_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [service_video_package_visibility_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_package_visibility_decisions_bookingId_version_key] UNIQUE NONCLUSTERED ([bookingId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_stages] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [stage] NVARCHAR(1000) NOT NULL,
    [stageEvidenceId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [stageVersion] INT NOT NULL,
    [contentHash] NVARCHAR(1000) NOT NULL,
    [presentationJson] NVARCHAR(max) NOT NULL,
    [presentationHash] NVARCHAR(1000) NOT NULL,
    [containsCustomerLikeness] BIT NOT NULL CONSTRAINT [service_video_publication_stages_containsCustomerLikeness_df] DEFAULT 0,
    [containsEmployeeLikeness] BIT NOT NULL CONSTRAINT [service_video_publication_stages_containsEmployeeLikeness_df] DEFAULT 0,
    [containsMinor] BIT NOT NULL CONSTRAINT [service_video_publication_stages_containsMinor_df] DEFAULT 0,
    [containsBystander] BIT NOT NULL CONSTRAINT [service_video_publication_stages_containsBystander_df] DEFAULT 0,
    [includesAudio] BIT NOT NULL CONSTRAINT [service_video_publication_stages_includesAudio_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_stages_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_publication_stages_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_publication_stages_proposalId_stage_key] UNIQUE NONCLUSTERED ([proposalId],[stage])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_customer_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [customerUserId] NVARCHAR(1000) NOT NULL,
    [authorityRole] NVARCHAR(1000) NOT NULL CONSTRAINT [service_video_publication_customer_decisions_authorityRole_df] DEFAULT 'CUSTOMER',
    [decision] NVARCHAR(1000) NOT NULL,
    [decisionJson] NVARCHAR(max) NOT NULL,
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [proposalHash] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(max),
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_customer_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_customer_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_publication_customer_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_publication_customer_decisions_proposalId_key] UNIQUE NONCLUSTERED ([proposalId])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_participant_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [stageId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(1000) NOT NULL,
    [authorityType] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [proposalHash] NVARCHAR(1000) NOT NULL,
    [presentationHash] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_participant_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_participant_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_publication_participant_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_publication_participant_decisions_proposalId_stageId_actorUserId_authorityType_key] UNIQUE NONCLUSTERED ([proposalId],[stageId],[actorUserId],[authorityType])
);

-- CreateTable
CREATE TABLE [dbo].[employee_public_media_consent_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [coversLikeness] BIT NOT NULL,
    [coversAudio] BIT NOT NULL,
    [effectScope] NVARCHAR(1000) NOT NULL,
    [policyVersion] NVARCHAR(1000) NOT NULL,
    [contractVersion] INT NOT NULL CONSTRAINT [employee_public_media_consent_decisions_contractVersion_df] DEFAULT 1,
    [consentTextSnapshot] NVARCHAR(max) NOT NULL,
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL,
    [isCurrent] BIT NOT NULL CONSTRAINT [employee_public_media_consent_decisions_isCurrent_df] DEFAULT 1,
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [employee_public_media_consent_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_public_media_consent_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [employee_public_media_consent_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_public_media_consent_decisions_membershipId_version_key] UNIQUE NONCLUSTERED ([membershipId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[employee_public_media_notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [employeeUserId] NVARCHAR(1000) NOT NULL,
    [employeeMembershipId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [notificationType] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(max) NOT NULL,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employee_public_media_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employee_public_media_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [employee_public_media_notifications_proposalId_employeeMembershipId_notificationType_key] UNIQUE NONCLUSTERED ([proposalId],[employeeMembershipId],[notificationType])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_vendor_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [managerUserId] NVARCHAR(1000) NOT NULL,
    [managerMembershipId] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [proposalHash] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(max),
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_vendor_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_vendor_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_publication_vendor_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_publication_vendor_decisions_proposalId_key] UNIQUE NONCLUSTERED ([proposalId])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_admin_decisions] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [adminUserId] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [approvedAudience] NVARCHAR(1000),
    [decisionHash] NVARCHAR(1000) NOT NULL,
    [proposalHash] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(max),
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_admin_decisions_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_admin_decisions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_publication_admin_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [service_video_publication_admin_decisions_proposalId_key] UNIQUE NONCLUSTERED ([proposalId])
);

-- CreateTable
CREATE TABLE [dbo].[public_service_video_eligibility] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [stageId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [packageHash] NVARCHAR(1000) NOT NULL,
    [proposalHash] NVARCHAR(1000) NOT NULL,
    [presentationHash] NVARCHAR(1000) NOT NULL,
    [contentHash] NVARCHAR(1000) NOT NULL,
    [eligibilityHash] NVARCHAR(1000) NOT NULL,
    [audience] NVARCHAR(1000) NOT NULL CONSTRAINT [public_service_video_eligibility_audience_df] DEFAULT 'PUBLIC',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [public_service_video_eligibility_status_df] DEFAULT 'ACTIVE',
    [adminDecisionId] NVARCHAR(1000) NOT NULL,
    [customerDecisionId] NVARCHAR(1000) NOT NULL,
    [vendorDecisionId] NVARCHAR(1000),
    [packageVisibilityDecisionId] NVARCHAR(1000),
    [participantDecisionIdsJson] NVARCHAR(max) NOT NULL,
    [standingConsentDecisionIdsJson] NVARCHAR(max),
    [eligibleAt] DATETIME2 NOT NULL CONSTRAINT [public_service_video_eligibility_eligibleAt_df] DEFAULT CURRENT_TIMESTAMP,
    [invalidatedAt] DATETIME2,
    [invalidationReason] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [public_service_video_eligibility_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [public_service_video_eligibility_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [public_service_video_eligibility_stageId_key] UNIQUE NONCLUSTERED ([stageId])
);

-- CreateTable
CREATE TABLE [dbo].[service_video_publication_audit_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [proposalId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(1000),
    [actorRole] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [metadataJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [service_video_publication_audit_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [service_video_publication_audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[legacy_public_restriction_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000),
    [previousVisibility] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [restrictedAt] DATETIME2 NOT NULL CONSTRAINT [legacy_public_restriction_evidence_restrictedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [legacy_public_restriction_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [legacy_public_restriction_evidence_mediaAssetId_key] UNIQUE NONCLUSTERED ([mediaAssetId])
);

-- CreateTable
CREATE TABLE [dbo].[private_proof_access_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [accessGrantId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000),
    [actorUserId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [private_proof_access_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [private_proof_access_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_lifecycle_cases] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000),
    [proposalId] NVARCHAR(1000),
    [mediaAssetId] NVARCHAR(1000),
    [contentReportId] NVARCHAR(1000),
    [category] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_cases_status_df] DEFAULT 'SUBMITTED',
    [exposureOutcome] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_cases_exposureOutcome_df] DEFAULT 'RESTRICTED',
    [reasonDetail] NVARCHAR(max),
    [openedByUserId] NVARCHAR(1000) NOT NULL,
    [openedByRole] NVARCHAR(1000) NOT NULL,
    [assignedAdminUserId] NVARCHAR(1000),
    [decision] NVARCHAR(1000),
    [decisionReason] NVARCHAR(max),
    [lifecycleVersion] INT NOT NULL CONSTRAINT [media_lifecycle_cases_lifecycleVersion_df] DEFAULT 1,
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_cases_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [restrictedAt] DATETIME2,
    [decidedAt] DATETIME2,
    [finalizedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_cases_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_lifecycle_cases_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_lifecycle_restrictions] (
    [id] NVARCHAR(1000) NOT NULL,
    [caseId] NVARCHAR(1000),
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000),
    [scope] NVARCHAR(1000) NOT NULL,
    [outcome] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_restrictions_outcome_df] DEFAULT 'RESTRICTED',
    [reasonCode] NVARCHAR(1000) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [media_lifecycle_restrictions_active_df] DEFAULT 1,
    [appliedByUserId] NVARCHAR(1000) NOT NULL,
    [appliedByRole] NVARCHAR(1000) NOT NULL,
    [appliedAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_restrictions_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [releasedByUserId] NVARCHAR(1000),
    [releasedAt] DATETIME2,
    [releaseReason] NVARCHAR(max),
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_restrictions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [media_lifecycle_restrictions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_withdrawal_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000),
    [proposalId] NVARCHAR(1000),
    [stageId] NVARCHAR(1000),
    [mediaAssetId] NVARCHAR(1000),
    [actorUserId] NVARCHAR(1000) NOT NULL,
    [actorRole] NVARCHAR(1000) NOT NULL,
    [authorityType] NVARCHAR(1000) NOT NULL,
    [scope] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_withdrawal_evidence_status_df] DEFAULT 'APPLIED',
    [reason] NVARCHAR(max),
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [appliedAt] DATETIME2 NOT NULL CONSTRAINT [media_withdrawal_evidence_appliedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supersededAt] DATETIME2,
    [supersededById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_withdrawal_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [media_withdrawal_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_retention_schedules] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [materialClass] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_retention_schedules_status_df] DEFAULT 'ACTIVE',
    [retainUntil] DATETIME2,
    [evidenceRetainUntil] DATETIME2,
    [approvalActive] BIT NOT NULL CONSTRAINT [media_retention_schedules_approvalActive_df] DEFAULT 0,
    [scheduledAt] DATETIME2 NOT NULL CONSTRAINT [media_retention_schedules_scheduledAt_df] DEFAULT CURRENT_TIMESTAMP,
    [lastEvaluatedAt] DATETIME2,
    [dispositionReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_retention_schedules_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_retention_schedules_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [media_retention_schedules_mediaAssetId_key] UNIQUE NONCLUSTERED ([mediaAssetId])
);

-- CreateTable
CREATE TABLE [dbo].[media_evidence_holds] (
    [id] NVARCHAR(1000) NOT NULL,
    [caseId] NVARCHAR(1000),
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000),
    [scopeJson] NVARCHAR(max) NOT NULL,
    [purpose] NVARCHAR(max) NOT NULL,
    [authority] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_evidence_holds_status_df] DEFAULT 'ACTIVE',
    [startedByUserId] NVARCHAR(1000) NOT NULL,
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [media_evidence_holds_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [reviewDueAt] DATETIME2 NOT NULL,
    [releasedByUserId] NVARCHAR(1000),
    [releasedAt] DATETIME2,
    [releaseReason] NVARCHAR(max),
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_evidence_holds_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_evidence_holds_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_deletion_requests] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [requestedByUserId] NVARCHAR(1000) NOT NULL,
    [requestedByRole] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_deletion_requests_status_df] DEFAULT 'REQUESTED',
    [reason] NVARCHAR(max),
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_requests_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [restrictedAt] DATETIME2,
    [reviewedByUserId] NVARCHAR(1000),
    [reviewedAt] DATETIME2,
    [deniedReason] NVARCHAR(max),
    [completedAt] DATETIME2,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_deletion_requests_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_deletion_jobs] (
    [id] NVARCHAR(1000) NOT NULL,
    [deletionRequestId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaAssetId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_deletion_jobs_status_df] DEFAULT 'QUEUED',
    [attemptCount] INT NOT NULL CONSTRAINT [media_deletion_jobs_attemptCount_df] DEFAULT 0,
    [maxAttempts] INT NOT NULL CONSTRAINT [media_deletion_jobs_maxAttempts_df] DEFAULT 5,
    [nextAttemptAt] DATETIME2,
    [leaseExpiresAt] DATETIME2,
    [verifiedAbsentAt] DATETIME2,
    [lastErrorCode] NVARCHAR(1000),
    [lastErrorDetail] NVARCHAR(max),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_jobs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_deletion_jobs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [media_deletion_jobs_deletionRequestId_key] UNIQUE NONCLUSTERED ([deletionRequestId])
);

-- CreateTable
CREATE TABLE [dbo].[media_deletion_attempts] (
    [id] NVARCHAR(1000) NOT NULL,
    [deletionJobId] NVARCHAR(1000) NOT NULL,
    [attemptNumber] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [deleteAccepted] BIT NOT NULL CONSTRAINT [media_deletion_attempts_deleteAccepted_df] DEFAULT 0,
    [verifiedAbsent] BIT NOT NULL CONSTRAINT [media_deletion_attempts_verifiedAbsent_df] DEFAULT 0,
    [errorCode] NVARCHAR(1000),
    [errorDetail] NVARCHAR(max),
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_attempts_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [finishedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_deletion_attempts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [media_deletion_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [media_deletion_attempts_deletionJobId_attemptNumber_key] UNIQUE NONCLUSTERED ([deletionJobId],[attemptNumber])
);

-- CreateTable
CREATE TABLE [dbo].[media_lifecycle_appeals] (
    [id] NVARCHAR(1000) NOT NULL,
    [caseId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [appellantUserId] NVARCHAR(1000) NOT NULL,
    [appellantRole] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_lifecycle_appeals_status_df] DEFAULT 'SUBMITTED',
    [reason] NVARCHAR(max) NOT NULL,
    [reviewerUserId] NVARCHAR(1000),
    [decision] NVARCHAR(1000),
    [decisionReason] NVARCHAR(max),
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_appeals_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [decidedAt] DATETIME2,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_appeals_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_lifecycle_appeals_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [media_lifecycle_appeals_caseId_appellantUserId_key] UNIQUE NONCLUSTERED ([caseId],[appellantUserId])
);

-- CreateTable
CREATE TABLE [dbo].[media_lifecycle_audit_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [caseId] NVARCHAR(1000),
    [mediaAssetId] NVARCHAR(1000),
    [actorUserId] NVARCHAR(1000),
    [actorRole] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [priorState] NVARCHAR(1000),
    [resultingState] NVARCHAR(1000) NOT NULL,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [metadataJson] NVARCHAR(max) NOT NULL,
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_lifecycle_audit_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [media_lifecycle_audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[booking_notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000),
    [kind] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [booking_notifications_status_df] DEFAULT 'QUEUED',
    [attemptCount] INT NOT NULL CONSTRAINT [booking_notifications_attemptCount_df] DEFAULT 0,
    [channelsJson] NVARCHAR(max),
    [lastError] NVARCHAR(max),
    [lastAttemptAt] DATETIME2,
    [sentAt] DATETIME2,
    [nextAttemptAt] DATETIME2,
    [leaseExpiresAt] DATETIME2,
    [deadLetteredAt] DATETIME2,
    [maxAttempts] INT NOT NULL CONSTRAINT [booking_notifications_maxAttempts_df] DEFAULT 4,
    [idempotencyKey] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [booking_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [booking_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [booking_notifications_bookingId_kind_key] UNIQUE NONCLUSTERED ([bookingId],[kind])
);

-- CreateTable
CREATE TABLE [dbo].[booking_notification_attempts] (
    [id] NVARCHAR(1000) NOT NULL,
    [notificationId] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000),
    [channel] NVARCHAR(1000) NOT NULL,
    [destinationMasked] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL,
    [attemptNumber] INT NOT NULL,
    [providerMessageId] NVARCHAR(1000),
    [errorCode] NVARCHAR(1000),
    [errorMessage] NVARCHAR(max),
    [attemptedAt] DATETIME2 NOT NULL CONSTRAINT [booking_notification_attempts_attemptedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [booking_notification_attempts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [booking_notification_attempts_notificationId_channel_attemptNumber_key] UNIQUE NONCLUSTERED ([notificationId],[channel],[attemptNumber])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_manager_notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [packageId] NVARCHAR(1000) NOT NULL,
    [sourceAdminDecisionId] NVARCHAR(1000) NOT NULL,
    [sourceBookingNotificationId] NVARCHAR(1000),
    [recipientMembershipId] NVARCHAR(1000) NOT NULL,
    [notificationType] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(max) NOT NULL,
    [targetUrl] NVARCHAR(2048) NOT NULL,
    [presentationState] NVARCHAR(1000) NOT NULL CONSTRAINT [vendor_manager_notifications_presentationState_df] DEFAULT 'UNREAD',
    [viewedAt] DATETIME2,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_manager_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vendor_manager_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_manager_notifications_sourceAdminDecisionId_recipientMembershipId_notificationType_key] UNIQUE NONCLUSTERED ([sourceAdminDecisionId],[recipientMembershipId],[notificationType])
);

-- CreateTable
CREATE TABLE [dbo].[reviews] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000),
    [mediaSessionId] NVARCHAR(1000),
    [assignedMembershipId] NVARCHAR(1000),
    [assignedEmployeeName] NVARCHAR(1000),
    [assignedUserId] NVARCHAR(1000),
    [attributionVersion] INT NOT NULL CONSTRAINT [reviews_attributionVersion_df] DEFAULT 1,
    [clientName] NVARCHAR(1000),
    [jobType] NVARCHAR(1000),
    [rating] INT NOT NULL,
    [comment] NVARCHAR(1000),
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [reviews_source_df] DEFAULT 'customer',
    [submittedVia] NVARCHAR(1000) NOT NULL CONSTRAINT [reviews_submittedVia_df] DEFAULT 'manual',
    [moderationStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [reviews_moderationStatus_df] DEFAULT 'approved',
    [visibilityStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [reviews_visibilityStatus_df] DEFAULT 'private',
    [moderationReason] NVARCHAR(1000),
    [moderatedAt] DATETIME2,
    [moderatedByUserId] NVARCHAR(1000),
    [contractVersion] INT,
    [ratingValidityStatus] NVARCHAR(1000),
    [ratingInvalidationReason] NVARCHAR(max),
    [ratingInvalidatedAt] DATETIME2,
    [ratingInvalidatedByUserId] NVARCHAR(1000),
    [submissionRequestId] NVARCHAR(1000),
    [submissionRequestHash] NVARCHAR(1000),
    [date] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [reviews_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [demo] BIT NOT NULL CONSTRAINT [reviews_demo_df] DEFAULT 0,
    [seedBatchId] NVARCHAR(1000),
    CONSTRAINT [reviews_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
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
    CONSTRAINT [employee_customer_rating_evidence_reviewId_key] UNIQUE NONCLUSTERED ([reviewId]),
    CONSTRAINT [employee_customer_rating_evidence_bookingId_key] UNIQUE NONCLUSTERED ([bookingId])
);

-- CreateTable
CREATE TABLE [dbo].[devices] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [deviceUid] NVARCHAR(1000),
    [employeeId] NVARCHAR(1000),
    [deviceName] NVARCHAR(1000) NOT NULL,
    [deviceType] NVARCHAR(1000) NOT NULL,
    [pairedAt] DATETIME2 NOT NULL CONSTRAINT [devices_pairedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [lastSeenAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [devices_isActive_df] DEFAULT 1,
    [firmwareVersion] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [os] NVARCHAR(1000),
    [appVersion] NVARCHAR(1000),
    CONSTRAINT [devices_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [devices_deviceUid_key] UNIQUE NONCLUSTERED ([deviceUid])
);

-- CreateTable
CREATE TABLE [dbo].[device_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [eventId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL,
    [receivedAt] DATETIME2 NOT NULL CONSTRAINT [device_events_receivedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [deviceId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000),
    [bookingId] NVARCHAR(1000),
    [mediaSessionId] NVARCHAR(1000),
    [assetId] NVARCHAR(1000),
    [stage] NVARCHAR(1000),
    [payloadJson] NVARCHAR(1000),
    [contextJson] NVARCHAR(1000),
    [firmwareVersion] NVARCHAR(1000),
    [phoneAppVersion] NVARCHAR(1000),
    CONSTRAINT [device_events_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [device_events_eventId_key] UNIQUE NONCLUSTERED ([eventId])
);

-- CreateTable
CREATE TABLE [dbo].[device_pairing_codes] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [used] BIT NOT NULL CONSTRAINT [device_pairing_codes_used_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [device_pairing_codes_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [device_pairing_codes_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [device_pairing_codes_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_memberships] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [vendor_memberships_role_df] DEFAULT 'EMPLOYEE',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [vendor_memberships_status_df] DEFAULT 'PENDING',
    [badgeId] NVARCHAR(1000),
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [vendor_memberships_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [approvedAt] DATETIME2,
    [approvedByUserId] NVARCHAR(1000),
    [deniedAt] DATETIME2,
    [deniedByUserId] NVARCHAR(1000),
    [revokedAt] DATETIME2,
    [revokedByUserId] NVARCHAR(1000),
    [pendingPhoneDeviceUid] NVARCHAR(1000),
    [pendingDeviceModel] NVARCHAR(1000),
    [pendingDeviceOs] NVARCHAR(1000),
    [pendingAppVersion] NVARCHAR(1000),
    CONSTRAINT [vendor_memberships_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_memberships_vendorId_userId_key] UNIQUE NONCLUSTERED ([vendorId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_invites] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [createdByUserId] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [maxUses] INT,
    [usesCount] INT NOT NULL CONSTRAINT [vendor_invites_usesCount_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [vendor_invites_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_invites_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [inviteeName] NVARCHAR(1000),
    [inviteeEmail] NVARCHAR(1000),
    [inviteePhone] NVARCHAR(1000),
    [inviteeRole] NVARCHAR(1000),
    CONSTRAINT [vendor_invites_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_invites_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [vendor_invites_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[device_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [deviceId] NVARCHAR(1000) NOT NULL,
    [membershipId] NVARCHAR(1000) NOT NULL,
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [device_assignments_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [unassignedAt] DATETIME2,
    [assignedByUserId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [device_assignments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaSessionId] NVARCHAR(1000),
    [membershipId] NVARCHAR(1000),
    [uploadedByMembershipId] NVARCHAR(1000),
    [deviceId] NVARCHAR(1000),
    [bytes] BIGINT NOT NULL,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [blobKey] NVARCHAR(1000) NOT NULL,
    [blobUrl] NVARCHAR(1000),
    [moderationStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_moderationStatus_df] DEFAULT 'pending_review',
    [visibilityStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_visibilityStatus_df] DEFAULT 'private',
    [archiveStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_archiveStatus_df] DEFAULT 'active',
    [uploadState] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_uploadState_df] DEFAULT 'SAVED',
    [contentHash] NVARCHAR(1000),
    [hashAlgorithm] NVARCHAR(1000) CONSTRAINT [media_assets_hashAlgorithm_df] DEFAULT 'SHA-256',
    [captureProvenance] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_captureProvenance_df] DEFAULT 'LEGACY_UNKNOWN',
    [stageVersion] INT,
    [audioExpected] BIT NOT NULL CONSTRAINT [media_assets_audioExpected_df] DEFAULT 0,
    [audioPresence] NVARCHAR(1000) NOT NULL CONSTRAINT [media_assets_audioPresence_df] DEFAULT 'LEGACY_UNKNOWN',
    [audioTrackCount] INT,
    [audioCodec] NVARCHAR(1000),
    [audioDetectionMethod] NVARCHAR(1000),
    [audioEvidenceVersion] INT NOT NULL CONSTRAINT [media_assets_audioEvidenceVersion_df] DEFAULT 1,
    [audioDetectedAt] DATETIME2,
    [replacesMediaAssetId] NVARCHAR(1000),
    [publicEligible] BIT,
    [moderationReason] NVARCHAR(1000),
    [moderatedAt] DATETIME2,
    [moderatedByUserId] NVARCHAR(1000),
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_assets_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_assets_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000),
    [employeeId] NVARCHAR(1000),
    [bookingId] NVARCHAR(1000),
    [serviceId] NVARCHAR(1000),
    [deviceId] NVARCHAR(1000),
    [deviceType] NVARCHAR(1000),
    [sessionType] NVARCHAR(1000) NOT NULL CONSTRAINT [media_sessions_sessionType_df] DEFAULT 'SERVICE_RECORD',
    [vendorJobVideoStage] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [media_sessions_status_df] DEFAULT 'CREATED',
    [title] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [recordingGateDecisionId] NVARCHAR(1000),
    [audioExpected] BIT NOT NULL CONSTRAINT [media_sessions_audioExpected_df] DEFAULT 0,
    [audioContractVersion] INT NOT NULL CONSTRAINT [media_sessions_audioContractVersion_df] DEFAULT 1,
    [capturedByMembershipId] NVARCHAR(1000),
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [media_sessions_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [endedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [media_sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [media_sessions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_storage_alerts] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [threshold] INT NOT NULL,
    [sentAt] DATETIME2 NOT NULL CONSTRAINT [vendor_storage_alerts_sentAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [vendor_storage_alerts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_storage_alerts_vendorId_threshold_key] UNIQUE NONCLUSTERED ([vendorId],[threshold])
);

-- CreateTable
CREATE TABLE [dbo].[admin_notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [metadata] NVARCHAR(1000),
    [read] BIT NOT NULL CONSTRAINT [admin_notifications_read_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [admin_notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [admin_notifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[content_reports] (
    [id] NVARCHAR(1000) NOT NULL,
    [targetType] NVARCHAR(1000) NOT NULL,
    [targetId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000),
    [vendorId] NVARCHAR(1000),
    [reportedUserId] NVARCHAR(1000),
    [reportedVendorId] NVARCHAR(1000),
    [reporterUserId] NVARCHAR(1000),
    [reporterVendorId] NVARCHAR(1000),
    [reporterRole] NVARCHAR(1000) NOT NULL,
    [reasonCategory] NVARCHAR(1000) NOT NULL,
    [reasonDetail] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [content_reports_status_df] DEFAULT 'open',
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [content_reports_severity_df] DEFAULT 'medium',
    [autoHidden] BIT NOT NULL CONSTRAINT [content_reports_autoHidden_df] DEFAULT 0,
    [adminOwnerUserId] NVARCHAR(1000),
    [notificationSentAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [content_reports_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [resolvedAt] DATETIME2,
    [resolutionNotes] NVARCHAR(max),
    [caseReference] NVARCHAR(1000),
    [contractVersion] INT NOT NULL CONSTRAINT [content_reports_contractVersion_df] DEFAULT 1,
    [accessBasis] NVARCHAR(1000),
    [packageId] NVARCHAR(1000),
    [packageVersion] INT,
    [packageHash] NVARCHAR(1000),
    [stageEvidenceId] NVARCHAR(1000),
    [stage] NVARCHAR(1000),
    [stageVersion] INT,
    [stageHash] NVARCHAR(1000),
    [mediaContentHash] NVARCHAR(1000),
    [adminAuditDecisionId] NVARCHAR(1000),
    [visibilityAtReport] NVARCHAR(1000),
    [policyCategory] NVARCHAR(1000),
    [groupingKey] NVARCHAR(1000),
    [lifecycleCaseId] NVARCHAR(1000),
    [publicHoldAppliedAt] DATETIME2,
    [notificationAttemptedAt] DATETIME2,
    [notificationFailedAt] DATETIME2,
    [notificationProviderResult] NVARCHAR(max),
    [reporterNotificationAttemptedAt] DATETIME2,
    [reporterNotificationSentAt] DATETIME2,
    [reporterNotificationFailedAt] DATETIME2,
    [reporterNotificationProviderResult] NVARCHAR(max),
    [closedAt] DATETIME2,
    CONSTRAINT [content_reports_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
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
    CONSTRAINT [content_report_requests_idempotencyKey_key] UNIQUE NONCLUSTERED ([idempotencyKey]),
    CONSTRAINT [content_report_requests_semanticKey_key] UNIQUE NONCLUSTERED ([semanticKey]),
    CONSTRAINT [content_report_requests_reportId_key] UNIQUE NONCLUSTERED ([reportId])
);

-- CreateTable
CREATE TABLE [dbo].[content_report_case_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [reportId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(1000),
    [actorRole] NVARCHAR(1000) NOT NULL,
    [priorStatus] NVARCHAR(1000),
    [resultingStatus] NVARCHAR(1000),
    [reason] NVARCHAR(max),
    [metadataJson] NVARCHAR(max) NOT NULL,
    [evidenceHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [content_report_case_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [content_report_case_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[booking_service_issues] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [issueType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [booking_service_issues_status_df] DEFAULT 'PENDING',
    [sourceEntityType] NVARCHAR(1000),
    [sourceEntityId] NVARCHAR(1000),
    [reportedByUserId] NVARCHAR(1000),
    [validatedAt] DATETIME2,
    [rejectedAt] DATETIME2,
    [refundApprovedAt] DATETIME2,
    [finalizedAt] DATETIME2,
    [finalizedByUserId] NVARCHAR(1000),
    [resolutionNotes] NVARCHAR(max),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [booking_service_issues_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [booking_service_issues_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_operational_outcomes] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000),
    [outcomeType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [vendor_operational_outcomes_status_df] DEFAULT 'FINALIZED',
    [sourceEntityType] NVARCHAR(1000),
    [sourceEntityId] NVARCHAR(1000),
    [finalizedAt] DATETIME2 NOT NULL,
    [finalizedByUserId] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_operational_outcomes_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vendor_operational_outcomes_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_trust_score_snapshots] (
    [id] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [scoreVersion] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_scoreVersion_df] DEFAULT 1,
    [totalScorePct] FLOAT(53),
    [workflowCompletionPct] FLOAT(53),
    [videoVerificationPct] FLOAT(53),
    [disputeFreePct] FLOAT(53),
    [operationalReliabilityPct] FLOAT(53),
    [workflowCompletionNumerator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_workflowCompletionNumerator_df] DEFAULT 0,
    [workflowCompletionDenominator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_workflowCompletionDenominator_df] DEFAULT 0,
    [videoVerificationNumerator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_videoVerificationNumerator_df] DEFAULT 0,
    [videoVerificationDenominator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_videoVerificationDenominator_df] DEFAULT 0,
    [disputeFreeNumerator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_disputeFreeNumerator_df] DEFAULT 0,
    [disputeFreeDenominator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_disputeFreeDenominator_df] DEFAULT 0,
    [operationalReliabilityNumerator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_operationalReliabilityNumerator_df] DEFAULT 0,
    [operationalReliabilityDenominator] INT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_operationalReliabilityDenominator_df] DEFAULT 0,
    [computedAt] DATETIME2 NOT NULL CONSTRAINT [vendor_trust_score_snapshots_computedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [periodStart] DATETIME2,
    [periodEnd] DATETIME2,
    [inputHash] NVARCHAR(1000),
    [isCurrent] BIT NOT NULL CONSTRAINT [vendor_trust_score_snapshots_isCurrent_df] DEFAULT 1,
    [visibilityStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [vendor_trust_score_snapshots_visibilityStatus_df] DEFAULT 'internal',
    [recalcReason] NVARCHAR(1000),
    [recalcSource] NVARCHAR(1000),
    [detailJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_trust_score_snapshots_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vendor_trust_score_snapshots_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[admin_audit_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [actionType] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(1000) NOT NULL,
    [previousValue] NVARCHAR(1000),
    [newValue] NVARCHAR(1000),
    [metadata] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [admin_audit_logs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [admin_audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[favorites] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [serviceId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [favorites_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [favorites_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [favorites_userId_serviceId_key] UNIQUE NONCLUSTERED ([userId],[serviceId])
);

-- CreateTable
CREATE TABLE [dbo].[vendor_favorites] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vendor_favorites_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [vendor_favorites_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [vendor_favorites_userId_vendorId_key] UNIQUE NONCLUSTERED ([userId],[vendorId])
);

-- CreateTable
CREATE TABLE [dbo].[review_windows] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaSessionId] NVARCHAR(1000) NOT NULL,
    [reviewId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [review_windows_status_df] DEFAULT 'active',
    [openedAt] DATETIME2 NOT NULL CONSTRAINT [review_windows_openedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [expiresAt] DATETIME2 NOT NULL,
    [closedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [review_windows_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [review_windows_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [review_windows_booking_vendor_media_key] UNIQUE NONCLUSTERED ([bookingId],[vendorId],[mediaSessionId])
);

-- CreateTable
CREATE TABLE [dbo].[review_prompt_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [reviewWindowId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [metadata] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [review_prompt_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [review_prompt_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[review_sentiments] (
    [id] NVARCHAR(1000) NOT NULL,
    [reviewWindowId] NVARCHAR(1000) NOT NULL,
    [sentiment] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [review_sentiments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [review_sentiments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[consent_records] (
    [id] NVARCHAR(1000) NOT NULL,
    [token] NVARCHAR(1000),
    [bookingId] NVARCHAR(1000) NOT NULL,
    [vendorId] NVARCHAR(1000) NOT NULL,
    [mediaSessionId] NVARCHAR(1000),
    [consentType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [consent_records_status_df] DEFAULT 'requested',
    [lifecycleStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [consent_records_lifecycleStatus_df] DEFAULT 'PENDING',
    [generation] INT NOT NULL CONSTRAINT [consent_records_generation_df] DEFAULT 1,
    [isCurrent] BIT NOT NULL CONSTRAINT [consent_records_isCurrent_df] DEFAULT 0,
    [verifiedDecision] BIT NOT NULL CONSTRAINT [consent_records_verifiedDecision_df] DEFAULT 0,
    [legacyEvidence] BIT NOT NULL CONSTRAINT [consent_records_legacyEvidence_df] DEFAULT 0,
    [recipientName] NVARCHAR(1000),
    [recipientEmailHash] NVARCHAR(1000),
    [recipientPhoneHash] NVARCHAR(1000),
    [recipientEmailMasked] NVARCHAR(1000),
    [recipientPhoneMasked] NVARCHAR(1000),
    [recipientMismatch] BIT NOT NULL CONSTRAINT [consent_records_recipientMismatch_df] DEFAULT 0,
    [scopeJson] NVARCHAR(max),
    [scopeHash] NVARCHAR(1000),
    [audioEnabled] BIT NOT NULL CONSTRAINT [consent_records_audioEnabled_df] DEFAULT 0,
    [contentVersionId] NVARCHAR(1000),
    [supersededAt] DATETIME2,
    [wrongRecipientAt] DATETIME2,
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [consent_records_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [acceptedAt] DATETIME2,
    [declinedAt] DATETIME2,
    [expiresAt] DATETIME2,
    [termsVersion] NVARCHAR(1000),
    [privacyVersion] NVARCHAR(1000),
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [documentHash] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_records_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [consent_records_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[consent_content_versions] (
    [id] NVARCHAR(1000) NOT NULL,
    [version] NVARCHAR(1000) NOT NULL,
    [contentJson] NVARCHAR(max) NOT NULL,
    [contentHash] NVARCHAR(1000) NOT NULL,
    [scopeSchemaVersion] NVARCHAR(1000) NOT NULL,
    [effectiveAt] DATETIME2 NOT NULL,
    [retiredAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_content_versions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [consent_content_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [consent_content_versions_version_key] UNIQUE NONCLUSTERED ([version]),
    CONSTRAINT [consent_content_versions_contentHash_key] UNIQUE NONCLUSTERED ([contentHash])
);

-- CreateTable
CREATE TABLE [dbo].[consent_request_links] (
    [id] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000) NOT NULL,
    [secretHash] NVARCHAR(1000) NOT NULL,
    [generation] INT NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [revocationReason] NVARCHAR(1000),
    [lastViewedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_request_links_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [consent_request_links_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [consent_request_links_secretHash_key] UNIQUE NONCLUSTERED ([secretHash]),
    CONSTRAINT [consent_request_links_consentRecordId_generation_key] UNIQUE NONCLUSTERED ([consentRecordId],[generation])
);

-- CreateTable
CREATE TABLE [dbo].[consent_verification_challenges] (
    [id] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000) NOT NULL,
    [requestLinkId] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL,
    [destinationHash] NVARCHAR(1000) NOT NULL,
    [codeHash] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [failedAttempts] INT NOT NULL CONSTRAINT [consent_verification_challenges_failedAttempts_df] DEFAULT 0,
    [maxAttempts] INT NOT NULL CONSTRAINT [consent_verification_challenges_maxAttempts_df] DEFAULT 5,
    [consumedAt] DATETIME2,
    [requestIpHash] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_verification_challenges_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [consent_verification_challenges_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[consent_decision_sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000) NOT NULL,
    [secretHash] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [verifiedContactHash] NVARCHAR(1000),
    [verifiedUserId] NVARCHAR(1000),
    [expiresAt] DATETIME2 NOT NULL,
    [consumedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_decision_sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [consent_decision_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [consent_decision_sessions_secretHash_key] UNIQUE NONCLUSTERED ([secretHash])
);

-- CreateTable
CREATE TABLE [dbo].[consent_decision_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000) NOT NULL,
    [decision] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(1000),
    [claimedRole] NVARCHAR(1000) NOT NULL,
    [authorityScope] NVARCHAR(1000) NOT NULL,
    [verificationMethod] NVARCHAR(1000) NOT NULL,
    [verifiedContactHash] NVARCHAR(1000),
    [requestHash] NVARCHAR(1000) NOT NULL,
    [scopeHash] NVARCHAR(1000) NOT NULL,
    [contentHash] NVARCHAR(1000) NOT NULL,
    [contentVersion] NVARCHAR(1000) NOT NULL,
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [consent_decision_evidence_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_decision_evidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [consent_decision_evidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [consent_decision_evidence_consentRecordId_key] UNIQUE NONCLUSTERED ([consentRecordId])
);

-- CreateTable
CREATE TABLE [dbo].[consent_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [consentRecordId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [metadata] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [consent_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [consent_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_status_placementType_startAt_endAt_idx] ON [dbo].[promotion_campaigns]([status], [placementType], [startAt], [endAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_vendorId_status_idx] ON [dbo].[promotion_campaigns]([vendorId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_serviceId_idx] ON [dbo].[promotion_campaigns]([serviceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_targetCategory_idx] ON [dbo].[promotion_campaigns]([targetCategory]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_paymentStatus_idx] ON [dbo].[promotion_campaigns]([paymentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_packageKey_idx] ON [dbo].[promotion_campaigns]([packageKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_campaigns_paidAt_idx] ON [dbo].[promotion_campaigns]([paidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [promotion_packages_isActive_placementType_idx] ON [dbo].[promotion_packages]([isActive], [placementType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [policy_document_versions_policyId_effectiveAt_idx] ON [dbo].[policy_document_versions]([policyId], [effectiveAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_registration_evidence_userId_registeredAt_idx] ON [dbo].[customer_registration_evidence]([userId], [registeredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_registration_evidence_actorEmail_registeredAt_idx] ON [dbo].[customer_registration_evidence]([actorEmail], [registeredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_registration_evidence_verificationCompletedAt_idx] ON [dbo].[customer_registration_evidence]([verificationCompletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [platform_role_grants_role_status_idx] ON [dbo].[platform_role_grants]([role], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [platform_role_grants_userId_status_idx] ON [dbo].[platform_role_grants]([userId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_credentials_email_idx] ON [dbo].[auth_credentials]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_passkeys_authCredentialId_revokedAt_createdAt_idx] ON [dbo].[auth_passkeys]([authCredentialId], [revokedAt], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_passkey_challenges_authCredentialId_purpose_consumedAt_expiresAt_idx] ON [dbo].[auth_passkey_challenges]([authCredentialId], [purpose], [consumedAt], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [email_verification_tokens_credentialId_email_consumedAt_idx] ON [dbo].[email_verification_tokens]([credentialId], [email], [consumedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [email_verification_tokens_email_expiresAt_idx] ON [dbo].[email_verification_tokens]([email], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_mfa_challenges_userId_purpose_consumedAt_idx] ON [dbo].[auth_mfa_challenges]([userId], [purpose], [consumedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_mfa_challenges_credentialId_purpose_expiresAt_idx] ON [dbo].[auth_mfa_challenges]([credentialId], [purpose], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_trusted_devices_userId_revokedAt_expiresAt_idx] ON [dbo].[auth_trusted_devices]([userId], [revokedAt], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auth_trusted_devices_credentialId_expiresAt_idx] ON [dbo].[auth_trusted_devices]([credentialId], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_service_record_organization_events_customerUserId_actedAt_idx] ON [dbo].[customer_service_record_organization_events]([customerUserId], [actedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_service_record_organization_events_bookingId_actedAt_idx] ON [dbo].[customer_service_record_organization_events]([bookingId], [actedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_service_record_organization_events_evidenceHash_idx] ON [dbo].[customer_service_record_organization_events]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_scope_assessments_bookingId_isCurrent_idx] ON [dbo].[recording_scope_assessments]([bookingId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_scope_assessments_vendorId_createdAt_idx] ON [dbo].[recording_scope_assessments]([vendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_scope_assessments_contractVersion_idx] ON [dbo].[recording_scope_assessments]([contractVersion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_scope_assessments_scopeHash_idx] ON [dbo].[recording_scope_assessments]([scopeHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_authority_requirements_assessmentId_status_idx] ON [dbo].[recording_authority_requirements]([assessmentId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_certifications_bookingId_membershipId_status_idx] ON [dbo].[employee_recording_certifications]([bookingId], [membershipId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_certifications_assessmentId_status_idx] ON [dbo].[employee_recording_certifications]([assessmentId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_certifications_scopeHash_idx] ON [dbo].[employee_recording_certifications]([scopeHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_safety_evidence_bookingId_membershipId_stage_sequence_idx] ON [dbo].[employee_recording_safety_evidence]([bookingId], [membershipId], [stage], [sequence]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_safety_evidence_assessmentId_stage_sequence_idx] ON [dbo].[employee_recording_safety_evidence]([assessmentId], [stage], [sequence]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_safety_evidence_predecessorEvidenceId_idx] ON [dbo].[employee_recording_safety_evidence]([predecessorEvidenceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_recording_safety_evidence_result_createdAt_idx] ON [dbo].[employee_recording_safety_evidence]([result], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_attempts_bookingId_membershipId_attemptedAt_idx] ON [dbo].[recording_location_attempts]([bookingId], [membershipId], [attemptedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_attempts_assessmentId_status_attemptedAt_idx] ON [dbo].[recording_location_attempts]([assessmentId], [status], [attemptedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_attempts_bookingId_membershipId_stage_attemptedAt_idx] ON [dbo].[recording_location_attempts]([bookingId], [membershipId], [stage], [attemptedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_attempts_evidenceHash_idx] ON [dbo].[recording_location_attempts]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_exceptions_bookingId_status_createdAt_idx] ON [dbo].[recording_location_exceptions]([bookingId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_exceptions_assessmentId_status_idx] ON [dbo].[recording_location_exceptions]([assessmentId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_location_exceptions_decidedByAdminUserId_decidedAt_idx] ON [dbo].[recording_location_exceptions]([decidedByAdminUserId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_metrics_blockReason_createdAt_idx] ON [dbo].[recording_gate_metrics]([blockReason], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_metrics_bookingId_createdAt_idx] ON [dbo].[recording_gate_metrics]([bookingId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_decision_evidence_bookingId_createdAt_idx] ON [dbo].[recording_gate_decision_evidence]([bookingId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_decision_evidence_vendorId_createdAt_idx] ON [dbo].[recording_gate_decision_evidence]([vendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_decision_evidence_assessmentId_membershipId_idx] ON [dbo].[recording_gate_decision_evidence]([assessmentId], [membershipId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_decision_evidence_safetyEvidenceId_idx] ON [dbo].[recording_gate_decision_evidence]([safetyEvidenceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_decision_evidence_locationAttemptId_idx] ON [dbo].[recording_gate_decision_evidence]([locationAttemptId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [recording_gate_decision_evidence_evidenceHash_idx] ON [dbo].[recording_gate_decision_evidence]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_upload_attempts_bookingId_stage_createdAt_idx] ON [dbo].[media_upload_attempts]([bookingId], [stage], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_upload_attempts_mediaSessionId_state_idx] ON [dbo].[media_upload_attempts]([mediaSessionId], [state]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_upload_attempts_vendorId_state_updatedAt_idx] ON [dbo].[media_upload_attempts]([vendorId], [state], [updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_stage_evidence_bookingId_isCurrent_idx] ON [dbo].[service_video_stage_evidence]([bookingId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_stage_evidence_recordingGateDecisionId_idx] ON [dbo].[service_video_stage_evidence]([recordingGateDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_stage_evidence_contentHash_idx] ON [dbo].[service_video_stage_evidence]([contentHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_stage_evidence_bookingId_audioPresence_idx] ON [dbo].[service_video_stage_evidence]([bookingId], [audioPresence]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_evidence_bookingId_isCurrent_idx] ON [dbo].[service_video_package_evidence]([bookingId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_evidence_vendorId_status_updatedAt_idx] ON [dbo].[service_video_package_evidence]([vendorId], [status], [updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_evidence_packageHash_idx] ON [dbo].[service_video_package_evidence]([packageHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_evidence_adminAuditDecisionId_idx] ON [dbo].[service_video_package_evidence]([adminAuditDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_manager_decision_evidence_packageId_decidedAt_idx] ON [dbo].[service_video_manager_decision_evidence]([packageId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_manager_decision_evidence_bookingId_decidedAt_idx] ON [dbo].[service_video_manager_decision_evidence]([bookingId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_manager_decision_evidence_attestationHash_idx] ON [dbo].[service_video_manager_decision_evidence]([attestationHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_bookingId_decidedAt_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([bookingId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_vendorId_decision_decidedAt_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([vendorId], [decision], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_managerDecisionId_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([managerDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_packageHash_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([packageHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_decisionHash_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([decisionHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_publicDisplayEligibility_decidedAt_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([publicDisplayEligibility], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_admin_audit_decision_evidence_publicEligibilityHash_idx] ON [dbo].[service_video_admin_audit_decision_evidence]([publicEligibilityHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [private_proof_access_grants_bookingId_customerUserId_status_idx] ON [dbo].[private_proof_access_grants]([bookingId], [customerUserId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [private_proof_access_grants_vendorId_status_grantedAt_idx] ON [dbo].[private_proof_access_grants]([vendorId], [status], [grantedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [private_proof_access_grants_adminAuditDecisionId_idx] ON [dbo].[private_proof_access_grants]([adminAuditDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_proposals_bookingId_isCurrent_idx] ON [dbo].[service_video_publication_proposals]([bookingId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_proposals_vendorId_status_updatedAt_idx] ON [dbo].[service_video_publication_proposals]([vendorId], [status], [updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_proposals_packageId_packageHash_idx] ON [dbo].[service_video_publication_proposals]([packageId], [packageHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_proposals_proposalHash_idx] ON [dbo].[service_video_publication_proposals]([proposalHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_proposals_packageVisibilityDecisionId_idx] ON [dbo].[service_video_publication_proposals]([packageVisibilityDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_bookingId_isCurrent_idx] ON [dbo].[service_video_package_visibility_decisions]([bookingId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_vendorId_decision_decidedAt_idx] ON [dbo].[service_video_package_visibility_decisions]([vendorId], [decision], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_customerUserId_decision_decidedAt_idx] ON [dbo].[service_video_package_visibility_decisions]([customerUserId], [decision], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_packageId_packageHash_idx] ON [dbo].[service_video_package_visibility_decisions]([packageId], [packageHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_stageSetHash_idx] ON [dbo].[service_video_package_visibility_decisions]([stageSetHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_decisionHash_idx] ON [dbo].[service_video_package_visibility_decisions]([decisionHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_package_visibility_decisions_publicationProposalId_idx] ON [dbo].[service_video_package_visibility_decisions]([publicationProposalId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_stages_bookingId_stage_idx] ON [dbo].[service_video_publication_stages]([bookingId], [stage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_stages_stageEvidenceId_contentHash_idx] ON [dbo].[service_video_publication_stages]([stageEvidenceId], [contentHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_stages_mediaAssetId_stageVersion_idx] ON [dbo].[service_video_publication_stages]([mediaAssetId], [stageVersion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_stages_presentationHash_idx] ON [dbo].[service_video_publication_stages]([presentationHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_customer_decisions_bookingId_customerUserId_decidedAt_idx] ON [dbo].[service_video_publication_customer_decisions]([bookingId], [customerUserId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_customer_decisions_proposalHash_decision_idx] ON [dbo].[service_video_publication_customer_decisions]([proposalHash], [decision]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_participant_decisions_bookingId_actorUserId_decidedAt_idx] ON [dbo].[service_video_publication_participant_decisions]([bookingId], [actorUserId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_participant_decisions_proposalHash_decision_idx] ON [dbo].[service_video_publication_participant_decisions]([proposalHash], [decision]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_consent_decisions_membershipId_isCurrent_idx] ON [dbo].[employee_public_media_consent_decisions]([membershipId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_consent_decisions_userId_isCurrent_idx] ON [dbo].[employee_public_media_consent_decisions]([userId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_consent_decisions_vendorId_decision_isCurrent_idx] ON [dbo].[employee_public_media_consent_decisions]([vendorId], [decision], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_consent_decisions_decisionHash_idx] ON [dbo].[employee_public_media_consent_decisions]([decisionHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_notifications_employeeUserId_createdAt_idx] ON [dbo].[employee_public_media_notifications]([employeeUserId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_notifications_employeeMembershipId_createdAt_idx] ON [dbo].[employee_public_media_notifications]([employeeMembershipId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_public_media_notifications_bookingId_createdAt_idx] ON [dbo].[employee_public_media_notifications]([bookingId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_vendor_decisions_vendorId_decision_decidedAt_idx] ON [dbo].[service_video_publication_vendor_decisions]([vendorId], [decision], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_vendor_decisions_proposalHash_idx] ON [dbo].[service_video_publication_vendor_decisions]([proposalHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_admin_decisions_decision_decidedAt_idx] ON [dbo].[service_video_publication_admin_decisions]([decision], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_admin_decisions_proposalHash_idx] ON [dbo].[service_video_publication_admin_decisions]([proposalHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [public_service_video_eligibility_vendorId_status_eligibleAt_idx] ON [dbo].[public_service_video_eligibility]([vendorId], [status], [eligibleAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [public_service_video_eligibility_bookingId_status_idx] ON [dbo].[public_service_video_eligibility]([bookingId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [public_service_video_eligibility_mediaAssetId_contentHash_idx] ON [dbo].[public_service_video_eligibility]([mediaAssetId], [contentHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [public_service_video_eligibility_eligibilityHash_idx] ON [dbo].[public_service_video_eligibility]([eligibilityHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [public_service_video_eligibility_packageVisibilityDecisionId_idx] ON [dbo].[public_service_video_eligibility]([packageVisibilityDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_audit_events_proposalId_createdAt_idx] ON [dbo].[service_video_publication_audit_events]([proposalId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_audit_events_bookingId_createdAt_idx] ON [dbo].[service_video_publication_audit_events]([bookingId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_audit_events_eventType_createdAt_idx] ON [dbo].[service_video_publication_audit_events]([eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [service_video_publication_audit_events_evidenceHash_idx] ON [dbo].[service_video_publication_audit_events]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [legacy_public_restriction_evidence_vendorId_restrictedAt_idx] ON [dbo].[legacy_public_restriction_evidence]([vendorId], [restrictedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [legacy_public_restriction_evidence_bookingId_restrictedAt_idx] ON [dbo].[legacy_public_restriction_evidence]([bookingId], [restrictedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [private_proof_access_events_accessGrantId_createdAt_idx] ON [dbo].[private_proof_access_events]([accessGrantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [private_proof_access_events_bookingId_actorUserId_createdAt_idx] ON [dbo].[private_proof_access_events]([bookingId], [actorUserId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_cases_bookingId_status_createdAt_idx] ON [dbo].[media_lifecycle_cases]([bookingId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_cases_vendorId_status_createdAt_idx] ON [dbo].[media_lifecycle_cases]([vendorId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_cases_mediaAssetId_status_idx] ON [dbo].[media_lifecycle_cases]([mediaAssetId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_cases_assignedAdminUserId_status_idx] ON [dbo].[media_lifecycle_cases]([assignedAdminUserId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_restrictions_bookingId_active_scope_idx] ON [dbo].[media_lifecycle_restrictions]([bookingId], [active], [scope]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_restrictions_mediaAssetId_active_scope_idx] ON [dbo].[media_lifecycle_restrictions]([mediaAssetId], [active], [scope]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_restrictions_caseId_active_idx] ON [dbo].[media_lifecycle_restrictions]([caseId], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_restrictions_evidenceHash_idx] ON [dbo].[media_lifecycle_restrictions]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_withdrawal_evidence_bookingId_scope_status_appliedAt_idx] ON [dbo].[media_withdrawal_evidence]([bookingId], [scope], [status], [appliedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_withdrawal_evidence_mediaAssetId_scope_status_idx] ON [dbo].[media_withdrawal_evidence]([mediaAssetId], [scope], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_withdrawal_evidence_actorUserId_appliedAt_idx] ON [dbo].[media_withdrawal_evidence]([actorUserId], [appliedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_withdrawal_evidence_evidenceHash_idx] ON [dbo].[media_withdrawal_evidence]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_retention_schedules_status_retainUntil_idx] ON [dbo].[media_retention_schedules]([status], [retainUntil]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_retention_schedules_bookingId_status_idx] ON [dbo].[media_retention_schedules]([bookingId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_evidence_holds_bookingId_status_reviewDueAt_idx] ON [dbo].[media_evidence_holds]([bookingId], [status], [reviewDueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_evidence_holds_mediaAssetId_status_idx] ON [dbo].[media_evidence_holds]([mediaAssetId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_evidence_holds_caseId_status_idx] ON [dbo].[media_evidence_holds]([caseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_deletion_requests_bookingId_status_requestedAt_idx] ON [dbo].[media_deletion_requests]([bookingId], [status], [requestedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_deletion_requests_mediaAssetId_status_idx] ON [dbo].[media_deletion_requests]([mediaAssetId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_deletion_requests_vendorId_status_idx] ON [dbo].[media_deletion_requests]([vendorId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_deletion_jobs_status_nextAttemptAt_idx] ON [dbo].[media_deletion_jobs]([status], [nextAttemptAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_deletion_jobs_mediaAssetId_status_idx] ON [dbo].[media_deletion_jobs]([mediaAssetId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_deletion_attempts_deletionJobId_createdAt_idx] ON [dbo].[media_deletion_attempts]([deletionJobId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_appeals_status_submittedAt_idx] ON [dbo].[media_lifecycle_appeals]([status], [submittedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_appeals_bookingId_status_idx] ON [dbo].[media_lifecycle_appeals]([bookingId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_audit_events_bookingId_createdAt_idx] ON [dbo].[media_lifecycle_audit_events]([bookingId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_audit_events_caseId_createdAt_idx] ON [dbo].[media_lifecycle_audit_events]([caseId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_audit_events_mediaAssetId_createdAt_idx] ON [dbo].[media_lifecycle_audit_events]([mediaAssetId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_audit_events_eventType_createdAt_idx] ON [dbo].[media_lifecycle_audit_events]([eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_lifecycle_audit_events_evidenceHash_idx] ON [dbo].[media_lifecycle_audit_events]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_notifications_status_lastAttemptAt_idx] ON [dbo].[booking_notifications]([status], [lastAttemptAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_notifications_consentRecordId_idx] ON [dbo].[booking_notifications]([consentRecordId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_notifications_status_nextAttemptAt_idx] ON [dbo].[booking_notifications]([status], [nextAttemptAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_notifications_idempotencyKey_idx] ON [dbo].[booking_notifications]([idempotencyKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_notification_attempts_consentRecordId_attemptedAt_idx] ON [dbo].[booking_notification_attempts]([consentRecordId], [attemptedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_notification_attempts_status_attemptedAt_idx] ON [dbo].[booking_notification_attempts]([status], [attemptedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_manager_notifications_vendorId_recipientMembershipId_presentationState_createdAt_idx] ON [dbo].[vendor_manager_notifications]([vendorId], [recipientMembershipId], [presentationState], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_manager_notifications_bookingId_createdAt_idx] ON [dbo].[vendor_manager_notifications]([bookingId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_manager_notifications_packageId_idx] ON [dbo].[vendor_manager_notifications]([packageId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_bookingId_idx] ON [dbo].[reviews]([bookingId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_vendorId_assignedMembershipId_idx] ON [dbo].[reviews]([vendorId], [assignedMembershipId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_vendorId_moderationStatus_idx] ON [dbo].[reviews]([vendorId], [moderationStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_assignedMembershipId_moderationStatus_idx] ON [dbo].[reviews]([assignedMembershipId], [moderationStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_userId_submissionRequestId_idx] ON [dbo].[reviews]([userId], [submissionRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_vendorId_ratingValidityStatus_idx] ON [dbo].[reviews]([vendorId], [ratingValidityStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_customer_rating_evidence_vendorId_employeeMembershipId_submittedAt_idx] ON [dbo].[employee_customer_rating_evidence]([vendorId], [employeeMembershipId], [submittedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_customer_rating_evidence_employeeUserId_submittedAt_idx] ON [dbo].[employee_customer_rating_evidence]([employeeUserId], [submittedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [employee_customer_rating_evidence_customerUserId_submittedAt_idx] ON [dbo].[employee_customer_rating_evidence]([customerUserId], [submittedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [devices_vendorId_deviceType_idx] ON [dbo].[devices]([vendorId], [deviceType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [device_events_deviceId_occurredAt_idx] ON [dbo].[device_events]([deviceId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [device_events_vendorId_occurredAt_idx] ON [dbo].[device_events]([vendorId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [device_events_eventType_occurredAt_idx] ON [dbo].[device_events]([eventType], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [device_events_membershipId_occurredAt_idx] ON [dbo].[device_events]([membershipId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_memberships_vendorId_status_idx] ON [dbo].[vendor_memberships]([vendorId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_invites_vendorId_isActive_idx] ON [dbo].[vendor_invites]([vendorId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [device_assignments_vendorId_idx] ON [dbo].[device_assignments]([vendorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [device_assignments_deviceId_unassignedAt_idx] ON [dbo].[device_assignments]([deviceId], [unassignedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_vendorId_deletedAt_idx] ON [dbo].[media_assets]([vendorId], [deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_mediaSessionId_idx] ON [dbo].[media_assets]([mediaSessionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_membershipId_idx] ON [dbo].[media_assets]([membershipId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_deviceId_idx] ON [dbo].[media_assets]([deviceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_contentHash_idx] ON [dbo].[media_assets]([contentHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_replacesMediaAssetId_idx] ON [dbo].[media_assets]([replacesMediaAssetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_audioPresence_idx] ON [dbo].[media_assets]([audioPresence]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_sessions_vendorId_createdAt_idx] ON [dbo].[media_sessions]([vendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_sessions_vendorId_status_idx] ON [dbo].[media_sessions]([vendorId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_sessions_vendorId_sessionType_idx] ON [dbo].[media_sessions]([vendorId], [sessionType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_sessions_deviceId_idx] ON [dbo].[media_sessions]([deviceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_sessions_bookingId_idx] ON [dbo].[media_sessions]([bookingId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_sessions_recordingGateDecisionId_idx] ON [dbo].[media_sessions]([recordingGateDecisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_storage_alerts_vendorId_idx] ON [dbo].[vendor_storage_alerts]([vendorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [admin_notifications_read_createdAt_idx] ON [dbo].[admin_notifications]([read], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [admin_notifications_vendorId_idx] ON [dbo].[admin_notifications]([vendorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_targetType_targetId_idx] ON [dbo].[content_reports]([targetType], [targetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_status_createdAt_idx] ON [dbo].[content_reports]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_vendorId_createdAt_idx] ON [dbo].[content_reports]([vendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_reportedUserId_createdAt_idx] ON [dbo].[content_reports]([reportedUserId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_reportedVendorId_createdAt_idx] ON [dbo].[content_reports]([reportedVendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_packageId_createdAt_idx] ON [dbo].[content_reports]([packageId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_groupingKey_createdAt_idx] ON [dbo].[content_reports]([groupingKey], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_lifecycleCaseId_idx] ON [dbo].[content_reports]([lifecycleCaseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_report_requests_reporterUserId_targetType_targetId_createdAt_idx] ON [dbo].[content_report_requests]([reporterUserId], [targetType], [targetId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_report_case_events_reportId_createdAt_idx] ON [dbo].[content_report_case_events]([reportId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_report_case_events_eventType_createdAt_idx] ON [dbo].[content_report_case_events]([eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_report_case_events_evidenceHash_idx] ON [dbo].[content_report_case_events]([evidenceHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_service_issues_bookingId_status_idx] ON [dbo].[booking_service_issues]([bookingId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_service_issues_vendorId_status_finalizedAt_idx] ON [dbo].[booking_service_issues]([vendorId], [status], [finalizedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_service_issues_issueType_status_idx] ON [dbo].[booking_service_issues]([issueType], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [booking_service_issues_sourceEntityType_sourceEntityId_idx] ON [dbo].[booking_service_issues]([sourceEntityType], [sourceEntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_operational_outcomes_vendorId_outcomeType_finalizedAt_idx] ON [dbo].[vendor_operational_outcomes]([vendorId], [outcomeType], [finalizedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_operational_outcomes_bookingId_outcomeType_idx] ON [dbo].[vendor_operational_outcomes]([bookingId], [outcomeType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_operational_outcomes_sourceEntityType_sourceEntityId_idx] ON [dbo].[vendor_operational_outcomes]([sourceEntityType], [sourceEntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_trust_score_snapshots_vendorId_isCurrent_idx] ON [dbo].[vendor_trust_score_snapshots]([vendorId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_trust_score_snapshots_vendorId_computedAt_idx] ON [dbo].[vendor_trust_score_snapshots]([vendorId], [computedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_trust_score_snapshots_inputHash_idx] ON [dbo].[vendor_trust_score_snapshots]([inputHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [admin_audit_logs_entityType_entityId_createdAt_idx] ON [dbo].[admin_audit_logs]([entityType], [entityId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [admin_audit_logs_actorUserId_createdAt_idx] ON [dbo].[admin_audit_logs]([actorUserId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [admin_audit_logs_actionType_createdAt_idx] ON [dbo].[admin_audit_logs]([actionType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [favorites_userId_createdAt_idx] ON [dbo].[favorites]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [favorites_serviceId_idx] ON [dbo].[favorites]([serviceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_favorites_userId_createdAt_idx] ON [dbo].[vendor_favorites]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vendor_favorites_vendorId_idx] ON [dbo].[vendor_favorites]([vendorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_windows_bookingId_status_idx] ON [dbo].[review_windows]([bookingId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_windows_vendorId_createdAt_idx] ON [dbo].[review_windows]([vendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_windows_mediaSessionId_idx] ON [dbo].[review_windows]([mediaSessionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_prompt_events_reviewWindowId_createdAt_idx] ON [dbo].[review_prompt_events]([reviewWindowId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_prompt_events_eventType_createdAt_idx] ON [dbo].[review_prompt_events]([eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_sentiments_reviewWindowId_createdAt_idx] ON [dbo].[review_sentiments]([reviewWindowId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_sentiments_sentiment_createdAt_idx] ON [dbo].[review_sentiments]([sentiment], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_bookingId_status_idx] ON [dbo].[consent_records]([bookingId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_bookingId_isCurrent_idx] ON [dbo].[consent_records]([bookingId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_vendorId_createdAt_idx] ON [dbo].[consent_records]([vendorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_mediaSessionId_idx] ON [dbo].[consent_records]([mediaSessionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_lifecycleStatus_expiresAt_idx] ON [dbo].[consent_records]([lifecycleStatus], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_recipientEmailHash_idx] ON [dbo].[consent_records]([recipientEmailHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_recipientPhoneHash_idx] ON [dbo].[consent_records]([recipientPhoneHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_records_contentVersionId_idx] ON [dbo].[consent_records]([contentVersionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_content_versions_effectiveAt_retiredAt_idx] ON [dbo].[consent_content_versions]([effectiveAt], [retiredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_request_links_consentRecordId_revokedAt_expiresAt_idx] ON [dbo].[consent_request_links]([consentRecordId], [revokedAt], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_verification_challenges_consentRecordId_channel_createdAt_idx] ON [dbo].[consent_verification_challenges]([consentRecordId], [channel], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_verification_challenges_destinationHash_createdAt_idx] ON [dbo].[consent_verification_challenges]([destinationHash], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_verification_challenges_expiresAt_consumedAt_idx] ON [dbo].[consent_verification_challenges]([expiresAt], [consumedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_decision_sessions_consentRecordId_expiresAt_consumedAt_idx] ON [dbo].[consent_decision_sessions]([consentRecordId], [expiresAt], [consumedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_decision_evidence_decision_decidedAt_idx] ON [dbo].[consent_decision_evidence]([decision], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_decision_evidence_actorUserId_decidedAt_idx] ON [dbo].[consent_decision_evidence]([actorUserId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_events_consentRecordId_createdAt_idx] ON [dbo].[consent_events]([consentRecordId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [consent_events_eventType_createdAt_idx] ON [dbo].[consent_events]([eventType], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[employees] ADD CONSTRAINT [employees_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[services] ADD CONSTRAINT [services_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[promotion_campaigns] ADD CONSTRAINT [promotion_campaigns_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[promotion_campaigns] ADD CONSTRAINT [promotion_campaigns_serviceId_fkey] FOREIGN KEY ([serviceId]) REFERENCES [dbo].[services]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_registration_evidence] ADD CONSTRAINT [customer_registration_evidence_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_registration_evidence] ADD CONSTRAINT [customer_registration_evidence_termsPolicyVersionId_fkey] FOREIGN KEY ([termsPolicyVersionId]) REFERENCES [dbo].[policy_document_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_registration_evidence] ADD CONSTRAINT [customer_registration_evidence_privacyPolicyVersionId_fkey] FOREIGN KEY ([privacyPolicyVersionId]) REFERENCES [dbo].[policy_document_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_registration_evidence] ADD CONSTRAINT [customer_registration_evidence_smsPolicyVersionId_fkey] FOREIGN KEY ([smsPolicyVersionId]) REFERENCES [dbo].[policy_document_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[platform_role_grants] ADD CONSTRAINT [platform_role_grants_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[platform_role_grants] ADD CONSTRAINT [platform_role_grants_grantedByUserId_fkey] FOREIGN KEY ([grantedByUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[auth_credentials] ADD CONSTRAINT [auth_credentials_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[auth_passkeys] ADD CONSTRAINT [auth_passkeys_authCredentialId_fkey] FOREIGN KEY ([authCredentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[auth_passkey_challenges] ADD CONSTRAINT [auth_passkey_challenges_authCredentialId_fkey] FOREIGN KEY ([authCredentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[email_verification_tokens] ADD CONSTRAINT [email_verification_tokens_credentialId_fkey] FOREIGN KEY ([credentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[auth_mfa_challenges] ADD CONSTRAINT [auth_mfa_challenges_credentialId_fkey] FOREIGN KEY ([credentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[auth_trusted_devices] ADD CONSTRAINT [auth_trusted_devices_credentialId_fkey] FOREIGN KEY ([credentialId]) REFERENCES [dbo].[auth_credentials]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[bookings] ADD CONSTRAINT [bookings_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[bookings] ADD CONSTRAINT [bookings_serviceId_fkey] FOREIGN KEY ([serviceId]) REFERENCES [dbo].[services]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[bookings] ADD CONSTRAINT [bookings_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_service_record_organization_events] ADD CONSTRAINT [customer_service_record_organization_events_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_service_record_organization_events] ADD CONSTRAINT [customer_service_record_organization_events_customerUserId_fkey] FOREIGN KEY ([customerUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_scope_assessments] ADD CONSTRAINT [recording_scope_assessments_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_scope_assessments] ADD CONSTRAINT [recording_scope_assessments_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_authority_requirements] ADD CONSTRAINT [recording_authority_requirements_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_certifications] ADD CONSTRAINT [employee_recording_certifications_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_certifications] ADD CONSTRAINT [employee_recording_certifications_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_certifications] ADD CONSTRAINT [employee_recording_certifications_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_safety_evidence] ADD CONSTRAINT [employee_recording_safety_evidence_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_safety_evidence] ADD CONSTRAINT [employee_recording_safety_evidence_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_safety_evidence] ADD CONSTRAINT [employee_recording_safety_evidence_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_safety_evidence] ADD CONSTRAINT [employee_recording_safety_evidence_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_recording_safety_evidence] ADD CONSTRAINT [employee_recording_safety_evidence_predecessorEvidenceId_fkey] FOREIGN KEY ([predecessorEvidenceId]) REFERENCES [dbo].[employee_recording_safety_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_location_attempts] ADD CONSTRAINT [recording_location_attempts_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_location_attempts] ADD CONSTRAINT [recording_location_attempts_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_location_attempts] ADD CONSTRAINT [recording_location_attempts_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_location_exceptions] ADD CONSTRAINT [recording_location_exceptions_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_location_exceptions] ADD CONSTRAINT [recording_location_exceptions_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_location_exceptions] ADD CONSTRAINT [recording_location_exceptions_assessmentId_fkey] FOREIGN KEY ([assessmentId]) REFERENCES [dbo].[recording_scope_assessments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_gate_metrics] ADD CONSTRAINT [recording_gate_metrics_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recording_gate_metrics] ADD CONSTRAINT [recording_gate_metrics_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[booking_notifications] ADD CONSTRAINT [booking_notifications_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[booking_notification_attempts] ADD CONSTRAINT [booking_notification_attempts_notificationId_fkey] FOREIGN KEY ([notificationId]) REFERENCES [dbo].[booking_notifications]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_manager_notifications] ADD CONSTRAINT [vendor_manager_notifications_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_manager_notifications] ADD CONSTRAINT [vendor_manager_notifications_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_manager_notifications] ADD CONSTRAINT [vendor_manager_notifications_recipientMembershipId_fkey] FOREIGN KEY ([recipientMembershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_mediaSessionId_fkey] FOREIGN KEY ([mediaSessionId]) REFERENCES [dbo].[media_sessions]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee_customer_rating_evidence] ADD CONSTRAINT [employee_customer_rating_evidence_reviewId_fkey] FOREIGN KEY ([reviewId]) REFERENCES [dbo].[reviews]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[devices] ADD CONSTRAINT [devices_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[device_events] ADD CONSTRAINT [device_events_deviceId_fkey] FOREIGN KEY ([deviceId]) REFERENCES [dbo].[devices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[device_pairing_codes] ADD CONSTRAINT [device_pairing_codes_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_memberships] ADD CONSTRAINT [vendor_memberships_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_memberships] ADD CONSTRAINT [vendor_memberships_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_invites] ADD CONSTRAINT [vendor_invites_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_invites] ADD CONSTRAINT [vendor_invites_createdByUserId_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[device_assignments] ADD CONSTRAINT [device_assignments_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[device_assignments] ADD CONSTRAINT [device_assignments_deviceId_fkey] FOREIGN KEY ([deviceId]) REFERENCES [dbo].[devices]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[device_assignments] ADD CONSTRAINT [device_assignments_membershipId_fkey] FOREIGN KEY ([membershipId]) REFERENCES [dbo].[vendor_memberships]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_assets] ADD CONSTRAINT [media_assets_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_assets] ADD CONSTRAINT [media_assets_mediaSessionId_fkey] FOREIGN KEY ([mediaSessionId]) REFERENCES [dbo].[media_sessions]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_sessions] ADD CONSTRAINT [media_sessions_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_sessions] ADD CONSTRAINT [media_sessions_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_sessions] ADD CONSTRAINT [media_sessions_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[employees]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_sessions] ADD CONSTRAINT [media_sessions_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_sessions] ADD CONSTRAINT [media_sessions_serviceId_fkey] FOREIGN KEY ([serviceId]) REFERENCES [dbo].[services]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_sessions] ADD CONSTRAINT [media_sessions_deviceId_fkey] FOREIGN KEY ([deviceId]) REFERENCES [dbo].[devices]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_storage_alerts] ADD CONSTRAINT [vendor_storage_alerts_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[admin_notifications] ADD CONSTRAINT [admin_notifications_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[content_report_requests] ADD CONSTRAINT [content_report_requests_reportId_fkey] FOREIGN KEY ([reportId]) REFERENCES [dbo].[content_reports]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[content_report_case_events] ADD CONSTRAINT [content_report_case_events_reportId_fkey] FOREIGN KEY ([reportId]) REFERENCES [dbo].[content_reports]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[booking_service_issues] ADD CONSTRAINT [booking_service_issues_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[booking_service_issues] ADD CONSTRAINT [booking_service_issues_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_operational_outcomes] ADD CONSTRAINT [vendor_operational_outcomes_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_operational_outcomes] ADD CONSTRAINT [vendor_operational_outcomes_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_trust_score_snapshots] ADD CONSTRAINT [vendor_trust_score_snapshots_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[favorites] ADD CONSTRAINT [favorites_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[favorites] ADD CONSTRAINT [favorites_serviceId_fkey] FOREIGN KEY ([serviceId]) REFERENCES [dbo].[services]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_favorites] ADD CONSTRAINT [vendor_favorites_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vendor_favorites] ADD CONSTRAINT [vendor_favorites_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_windows] ADD CONSTRAINT [review_windows_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_windows] ADD CONSTRAINT [review_windows_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_windows] ADD CONSTRAINT [review_windows_mediaSessionId_fkey] FOREIGN KEY ([mediaSessionId]) REFERENCES [dbo].[media_sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_windows] ADD CONSTRAINT [review_windows_reviewId_fkey] FOREIGN KEY ([reviewId]) REFERENCES [dbo].[reviews]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_prompt_events] ADD CONSTRAINT [review_prompt_events_reviewWindowId_fkey] FOREIGN KEY ([reviewWindowId]) REFERENCES [dbo].[review_windows]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[review_sentiments] ADD CONSTRAINT [review_sentiments_reviewWindowId_fkey] FOREIGN KEY ([reviewWindowId]) REFERENCES [dbo].[review_windows]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[consent_records] ADD CONSTRAINT [consent_records_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[consent_records] ADD CONSTRAINT [consent_records_vendorId_fkey] FOREIGN KEY ([vendorId]) REFERENCES [dbo].[vendors]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_records] ADD CONSTRAINT [FK_consent_records_media_session] FOREIGN KEY ([mediaSessionId]) REFERENCES [dbo].[media_sessions]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_records] ADD CONSTRAINT [consent_records_contentVersionId_fkey] FOREIGN KEY ([contentVersionId]) REFERENCES [dbo].[consent_content_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_request_links] ADD CONSTRAINT [consent_request_links_consentRecordId_fkey] FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_verification_challenges] ADD CONSTRAINT [consent_verification_challenges_consentRecordId_fkey] FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_verification_challenges] ADD CONSTRAINT [consent_verification_challenges_requestLinkId_fkey] FOREIGN KEY ([requestLinkId]) REFERENCES [dbo].[consent_request_links]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_decision_sessions] ADD CONSTRAINT [consent_decision_sessions_consentRecordId_fkey] FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_decision_evidence] ADD CONSTRAINT [consent_decision_evidence_consentRecordId_fkey] FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[consent_events] ADD CONSTRAINT [consent_events_consentRecordId_fkey] FOREIGN KEY ([consentRecordId]) REFERENCES [dbo].[consent_records]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

-- Reliance beta structural-oracle additions unsupported or misrepresented by
-- Prisma's SQL Server schema renderer. These statements preserve current beta
-- semantics; they are not forward product changes.

CREATE UNIQUE NONCLUSTERED INDEX [bookings_creationRequestKey_key]
ON [dbo].[bookings]([creationRequestKey])
WHERE [creationRequestKey] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [consent_records_one_current_per_booking_key]
ON [dbo].[consent_records]([bookingId])
WHERE [isCurrent] = 1;

CREATE UNIQUE NONCLUSTERED INDEX [consent_records_token_key]
ON [dbo].[consent_records]([token])
WHERE [token] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [content_reports_caseReference_key]
ON [dbo].[content_reports]([caseReference])
WHERE [caseReference] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [employee_recording_safety_evidence_chainKey_submissionRequestHash_key]
ON [dbo].[employee_recording_safety_evidence]([chainKey], [submissionRequestHash])
WHERE [submissionRequestHash] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [employee_recording_safety_evidence_locationAttemptId_key]
ON [dbo].[employee_recording_safety_evidence]([locationAttemptId])
WHERE [locationAttemptId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [recording_scope_assessments_one_current_per_booking_key]
ON [dbo].[recording_scope_assessments]([bookingId])
WHERE [isCurrent] = 1;

CREATE UNIQUE NONCLUSTERED INDEX [review_windows_reviewId_key]
ON [dbo].[review_windows]([reviewId])
WHERE [reviewId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [reviews_bookingId_unique_not_null]
ON [dbo].[reviews]([bookingId])
WHERE [bookingId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [reviews_userId_submissionRequestId_unique_not_null]
ON [dbo].[reviews]([userId], [submissionRequestId])
WHERE [submissionRequestId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [users_phone_key]
ON [dbo].[users]([phone])
WHERE [phone] IS NOT NULL;

ALTER TABLE [dbo].[employee_customer_rating_evidence]
ADD CONSTRAINT [employee_customer_rating_evidence_rating_check]
CHECK ([rating] >= 1 AND [rating] <= 5);

ALTER TABLE [dbo].[reviews]
ADD CONSTRAINT [reviews_ratingValidityStatus_check]
CHECK ([ratingValidityStatus] IS NULL OR [ratingValidityStatus] IN ('verified', 'invalid'));
