# A5 Deployment Report

## Checkpoint

- **Gate:** RR-1A A5 - Current Customer Onboarding
- **Environment:** Reliance beta
- **Azure application:** `app-reliance-beta-wcus`
- **Azure resource group:** `rg-reliance-beta-eastus`
- **Branch:** `codex/epic3-beta-admin-grant-correction`
- **A5 implementation commit:** `9788a8d8f58d8de2b8d94e5a1b063844244e5174`
- **Deployed correction commit:** `df36f113d37149adab2373964663016e4cd845a6`
- **Migration:** `20260804230000_add_customer_registration_evidence`
- **Final package:** `reliance-beta-df36f11-a5-202608042023.zip`
**Package SHA-256:** `692DC79F2D063BA2FC160B7E9DEE4ABD9288D8C0A3615B29A2CC0E32C492643D`

## Objective

Deploy the approved A5 customer-registration application and additive evidence migration together. Validate required Terms acceptance, required Privacy acknowledgment, optional SMS, durable policy evidence, email verification, duplicate protection, deactivated-account restoration, service-record claiming, and permission-link onboarding without changing vendor registration, employee registration, recording permission, reviews, Trust Score, publication, or Public media behavior.

## Scope Delivered

- Customer registration requires explicit Terms acceptance and Privacy acknowledgment in both the UI and server route.
- SMS remains optional. Registration and email verification succeed when SMS is not selected.
- Registration records immutable references to the active Terms, Privacy, and SMS policy snapshots.
- Evidence records include actor, role, accepted timestamps, policy identifiers and hashes, IP address, user agent, and verification method.
- Email verification completion updates the registration evidence.
- Duplicate active accounts remain protected.
- A deactivated customer account can be restored without replacing its identity or linked service records.
- Registration from a completed work-record link claims the intended service record and preserves the post-registration destination.

## Files In The A5 Application Checkpoint

- `prisma/migrations/20260804230000_add_customer_registration_evidence/migration.sql`
- `prisma/schema.prisma`
- `src/app/api/customer/register/route.ts`
- `src/app/api/customer/register/route.test.ts`
- `src/app/auth/register/page.tsx`
- `src/lib/auth-credentials.ts`
- `src/lib/auth-email-verification.ts`
- `src/lib/auth-email-verification.test.ts`
- `src/lib/legal/customer-registration-policy-evidence.ts`
- `src/lib/legal/customer-registration-policy-evidence.test.ts`
- `Project Management/RR-1A - Current Beta Readiness/A5 - Current Customer Onboarding/CUSTOMER_REGISTRATION_A5_REPORT.md`

## Deployment Correction

The first deployed package exposed a beta-only email-link defect. Azure forwarded an internal container origin to the registration route, and the verification email used that internal hostname even though the public application settings were correct.

The correction changed only:

- `src/app/api/customer/register/route.ts`
- `src/app/api/customer/register/route.test.ts`

The route now uses the configured public `APP_BASE_URL` for verification links and falls back to the request origin only when that setting is absent. A focused regression test simulates an internal Azure hostname and proves the generated link uses the public beta origin. No account, authorization, permission, or policy behavior changed.

## Migration Evidence

### Before

- Target database verified as `reliance-beta-db`.
- Database state was online and restore capability was available.
- The A5 migration was the only pending migration.
- Baseline domain counts were recorded before deployment.

### Application

`npx prisma migrate deploy` applied the existing A5 migration without editing it or creating another migration.

### After

- Prisma reports all **37 migrations** applied.
- `PolicyDocumentVersion` and `CustomerRegistrationEvidence` exist.
- The migration is additive; existing user, booking, review, permission, media, and Public-media counts were unchanged by the migration itself.
- Three immutable policy-version rows were created when live A5 registration first required them: Terms, Privacy, and SMS.

## Package And Azure Validation

- The production build passed on Next.js `15.5.21` with 197 App Router routes and 2 preserved legacy pages.
- The deterministic allow-list package contained 3,252 entries.
- Package inspection found no `.env`, Git metadata, project-management documents, local screenshots, or temporary test artifacts.
- The uploaded blob was downloaded and its SHA-256 matched the local package.
- All existing App Service settings were preserved when the package setting was updated.
- App Service restarted successfully and reports `Running`.
- Final live route checks returned HTTP 200 for:
  - `/api/health`
  - `/auth/register`
  - `/terms`
  - `/privacy`
  - `/sms-policy`
  - `/support`
  - `/notifications`

## Live Customer Validation

All live records used synthetic names, controlled email aliases, controlled contact data, and synthetic work details. No real customer data was used. Passwords and verification tokens are excluded from this report.

| Validation | Result |
| --- | --- |
| Missing Terms acceptance | Passed: server returned HTTP 400 with `CUSTOMER_TERMS_ACCEPTANCE_REQUIRED` |
| Missing Privacy acknowledgment | Passed: server returned HTTP 400 with `CUSTOMER_PRIVACY_ACKNOWLEDGMENT_REQUIRED` |
| Customer registration with SMS off | Passed: account and evidence created; email queued |
| Verification email public origin | Passed after correction: beta public hostname present and internal hostname absent |
| Email verification | Passed: verification endpoint returned success and evidence recorded completion |
| Optional SMS | Passed: SMS opt-out decision persisted; registration and verification were not blocked |
| Duplicate active account | Passed: server returned HTTP 409 with `CUSTOMER_ACCOUNT_ALREADY_EXISTS` |
| Deactivated account restore | Passed: the same customer identity was reactivated and linked records were preserved |
| Service-record claim | Passed: synthetic completed work record moved to the new matching customer account |
| Permission-link onboarding compatibility | Passed: the destination path and work-record query state were preserved in the public verification link; Epic 1 permission regression also passed |

## Durable Evidence Validation

For the fresh verified customer, database inspection confirmed:

- role is `CUSTOMER`;
- Terms and Privacy decision timestamps are present;
- the optional SMS decision is present and records opt-out when not selected;
- verification completion and `EMAIL_VERIFICATION_LINK` method are present;
- registration IP and user agent are present;
- Terms, Privacy, and SMS references point to immutable policy records;
- each policy snapshot has a 64-character SHA-256 value;
- no raw verification token, customer password, or policy document body is duplicated into the customer evidence record.

## Non-Creation Verification

Database counts before and after the controlled A5 registrations confirmed A5 created no new:

- reviews or ratings;
- Trust Score snapshots or inputs;
- recording-permission records;
- publication approvals;
- Public media.

The existing permission count remained unchanged. A5 does not infer recording permission, publication permission, review activity, or Trust Score activity from registration or policy acceptance.

## Test Results

| Suite or command | Result |
| --- | --- |
| A5 focused regression | **16/16 passed** across 3 files |
| Epic 1 permission and recording-gate regression | **62/62 passed** across 15 files |
| Epic 2 proof-first shell regression | **5/5 passed** |
| Epic 3 Phase A role-isolation regression | **112/112 passed** across 18 files |
| TypeScript, non-incremental | Passed before packaging |
| Production build, 6144 MB Node heap | Passed before each package |
| Exact-ZIP route smoke | Passed for registration, policy, support, notifications, and health routes |
| `git diff --check` | Passed |

One broader legacy `employee-stage-capture` test still expects `Paired phone` while the current product copy returns `This phone`. This is a previously documented unrelated test/copy mismatch. It is outside A5 and was not changed.

## Security And Privacy

- Terms and Privacy are enforced server-side, not only by the browser.
- Policy evidence uses immutable identifiers and SHA-256 hashes rather than duplicating policy text per customer.
- Passwords, email verification tokens, database credentials, package SAS values, and Azure secrets are not included in this report.
- The package is generated from an allow-list and excludes local environment files.
- Registration does not broaden customer, vendor, employee, or admin authorization.

## Backward Compatibility

Preserved without redesign:

- email verification;
- active-account duplicate protection;
- deactivated-account restoration;
- completed service-record claiming;
- permission-link destinations;
- vendor and employee registration;
- Epic 1 recording-permission decisions;
- Epic 2 public shell behavior;
- Epic 3 database-backed role isolation.

## Rollback Readiness

- The previous package remains available for application rollback.
- The additive A5 tables may safely remain after an application rollback and must not be dropped after evidence exists without a separately approved retention decision.
- Rollback would remove the new registration UI/server requirements from the running package, so application and migration state must remain documented as one checkpoint.

## Known Limitations

- Live SMS handset delivery is deferred because the external SMS provider is not yet operationally configured. This is an external-provider dependency, not an A5 application defect. Optional SMS persistence and the email-only customer path passed.
- The broader historical test suite has documented unrelated legacy fixture and copy failures. A5 and the scoped Epic 1, Epic 2, and Epic 3 suites pass.
- Full archived HTML, Markdown, and PDF policy reproduction remains an Epic 11 governance enhancement. A5 stores immutable policy IDs, versions, effective dates, snapshots, and SHA-256 evidence required for the current gate.
- Synthetic beta accounts and one synthetic work record were retained as controlled deployment evidence.

## Final Status

**A5 deployment checkpoint: Passed.**

The A5 application and migration are deployed together, customer registration and email verification work on beta, SMS is optional, durable policy evidence is present, existing account and service-record behavior is preserved, and no review, Trust Score, permission, publication, or Public-media side effect was created.

No Epic 3 Phase B or Epic 4 work was started.
