# Customer Registration A5 Report

## Status

**Implementation complete locally. Product Owner review required before migration application, commit, or deployment.**

## Objective

Correct the current customer self-registration flow so that:

- Terms of Use acceptance is explicit and required.
- Privacy Policy acknowledgment is explicit and required.
- SMS notifications are genuinely optional for customers.
- Email remains the required customer account channel.
- Registration creates durable evidence of the customer's policy decisions and later email-verification completion.

This work is limited to RR-1A gate A5, Current Customer Onboarding.

## Behavior Before

- Customer registration used the same SMS control pattern as vendor registration.
- A customer providing a phone number could not continue without choosing SMS.
- The customer registration API did not independently require explicit Terms acceptance or Privacy acknowledgment.
- The current customer registration write did not create a durable policy-version acceptance record.
- Email verification existed, but its completion was not associated with customer registration acceptance evidence.

## Behavior After

- Customer registration presents three separate decisions:
  - optional SMS notifications;
  - required Terms of Use acceptance;
  - required Privacy Policy acknowledgment.
- The customer can register without SMS. Email remains required.
- The customer registration API rejects a request when Terms or Privacy evidence is missing, regardless of client behavior.
- Customer identity, credential, policy evidence, and an eligible service-record claim are written atomically.
- Current policy snapshots are archived once with Policy ID, version, effective date, immutable SHA-256 content hash, source revision, and full snapshot content.
- Each customer registration evidence record references the immutable policy versions instead of duplicating policy text.
- Evidence records include actor, role, registration and acceptance timestamps, SMS choice, registration IP when supplied by the trusted request path, user agent, verification method, and email-verification completion time.
- Email verification marks the corresponding customer registration evidence as completed.

## Files Changed

### Application

- `src/app/auth/register/page.tsx`
  - Added customer-only Terms and Privacy controls.
  - Made customer SMS optional in validation, copy, and progression rules.
  - Preserved the existing vendor registration behavior.
- `src/app/api/customer/register/route.ts`
  - Added server-side Terms and Privacy enforcement.
  - Records customer SMS opt-in or opt-out as an explicit decision.
  - Makes customer, credential, evidence, and work-record claim writes atomic.
- `src/lib/auth-credentials.ts`
  - Added optional transaction-client support for the existing credential upsert helper.
- `src/lib/auth-email-verification.ts`
  - Marks customer registration evidence verified when email verification succeeds.
- `src/lib/legal/customer-registration-policy-evidence.ts`
  - Added immutable policy snapshot definitions and durable registration-evidence helpers.

### Database

- `prisma/schema.prisma`
  - Added `PolicyDocumentVersion`.
  - Added `CustomerRegistrationEvidence`.
  - Added the customer registration evidence relation to `User`.
- `prisma/migrations/20260804230000_add_customer_registration_evidence/migration.sql`
  - Additive SQL Server migration for policy versions, registration evidence, indexes, and foreign keys.

### Tests

- `src/app/api/customer/register/route.test.ts`
- `src/lib/auth-email-verification.test.ts`
- `src/lib/legal/customer-registration-policy-evidence.test.ts`

## Database And Migration Impact

The migration is additive and does not remove or rewrite existing customer, credential, service-record, permission, review, or media data.

The migration has been generated, formatted, and validated locally. It has **not** been applied to the beta database in this checkpoint. The application code and migration must be deployed together after Product Owner approval because registration now requires the new evidence tables.

No existing customer accounts are backfilled or assigned fabricated acceptance evidence. Existing accounts remain historical facts and are not altered by this change.

## Security Impact

- Required policy choices are enforced server-side.
- Policy acceptance evidence is written in the same transaction as the customer account and credential.
- Policy content hashes are verified against an existing version before evidence can reference it.
- Policy snapshots are stored once and referenced by ID.
- Password handling, duplicate-account protection, role resolution, and authorization behavior are unchanged.
- No raw password, verification token, OTP, permission token, or session secret is added to registration evidence.

## API Impact

`POST /api/customer/register` now accepts:

- `termsAccepted`
- `privacyAcknowledged`
- `smsConsent`

It returns HTTP 400 with a stable error code when either required customer policy decision is absent:

- `CUSTOMER_TERMS_ACCEPTANCE_REQUIRED`
- `CUSTOMER_PRIVACY_ACKNOWLEDGMENT_REQUIRED`

Existing successful registration response behavior is preserved.

## Notification Impact

- Email remains the required and active customer account channel.
- Existing verification-email delivery remains unchanged.
- Customer registration no longer depends on SMS opt-in.
- No SMS is sent merely because a phone number was entered.
- Telnyx or handset delivery behavior was not changed or tested by this gate.

## AI, Dashboard, And Trust Impact

- No AI behavior changed.
- No dashboard metric changed.
- No review, rating, Trust Score input, permission decision, publication approval, or Public media is created by policy acceptance.

## Legal Scope

The current Terms, Privacy Policy, and SMS Policy wording was not rewritten. Their current executable-route content is archived as the initial immutable customer-registration policy version.

This checkpoint does not implement vendor agreements, employee agreements, recording consent changes, cookie consent, AI consent, or broader Epic 11 legal governance.

## Backward Compatibility

Intentionally preserved:

- email verification;
- duplicate-account protection;
- deactivated customer restoration;
- customer service-record claiming;
- completed Service Video registration intent;
- permission links;
- customer onboarding;
- vendor registration;
- employee registration and invitations;
- Epic 1 permission behavior;
- Epic 2 platform-shell behavior;
- Epic 3 authorization and role isolation.

## Rollback Considerations

- Application rollback is safe only if the A5 application and its migration are treated as one deployment checkpoint.
- The additive tables may remain unused after an application rollback without affecting existing records.
- Do not drop the evidence tables after real acceptance records exist without a separately approved retention plan.

## Validation Results

| Command or check | Result |
| --- | --- |
| `npx prisma format` | Passed |
| `npx prisma generate` | Passed |
| `npx prisma validate` with a non-secret placeholder SQL Server URL | Passed |
| A5 focused Vitest suite | 14/14 passed across 3 files |
| TypeScript, non-incremental | Passed |
| Epic 1 scoped regression | 102/102 passed across 15 files |
| Epic 2 scoped regression | 5/5 passed |
| Epic 3 Phase A scoped regression | 112/112 passed across 18 files |
| Production build with 6144 MB Node heap | Passed on Next.js 15.5.21; 197 app pages generated plus 2 legacy pages |
| `git diff --check` | Passed; only line-ending warnings |
| Desktop visual check at 1425 px content width | Passed; no horizontal overflow |
| Mobile visual check at 375 px content width | Passed; no horizontal overflow |
| Vendor registration comparison | Passed; existing vendor SMS-required path remains unchanged |

### Full-suite status

The complete `npm test` run finished with 12 failures in unrelated, pre-existing legacy fixtures and mocks involving employee correction resubmission, admin media moderation, promoted listings, device-label wording, admin review moderation, and reject-route mocks. These same categories are documented in earlier project reports. All A5 tests and all scoped Epic 1, Epic 2, and Epic 3 regressions passed. No unrelated failing file was changed.

## Screenshot Index

- `Screenshots/customer-registration-desktop.png`
- `Screenshots/customer-registration-desktop-choices.png`
- `Screenshots/customer-registration-mobile.png`
- `Screenshots/customer-registration-mobile-choices.png`

The screenshots contain no entered customer information.

## UX Review

### Customer

- The required and optional choices are visually separate.
- SMS explicitly says optional and explains that email remains required.
- Terms acceptance and Privacy acknowledgment use short, direct language.
- Policy links preserve the registration return path and open separately.
- Mobile layout fits without horizontal scrolling.

### Vendor

- The existing vendor registration path and its current SMS rule are preserved.

### Employee

- No employee-facing behavior changed.

### Admin

- No admin workflow changed. Durable registration evidence is available for future authorized audit tooling, but no new admin UI was added in A5.

## Regression Statement

### Existing functionality intentionally preserved

Customer account creation, email verification, duplicate handling, deactivated-account restoration, service-record claiming, registration redirects, and vendor registration.

### Existing functionality intentionally unchanged

Permission requests, recording consent, recording locks, media capture, publication, reviews, Trust Score, vendor and employee agreements, and role isolation.

### Areas verified unaffected

Epic 1, Epic 2, Epic 3 Phase A, vendor registration, and the production build.

### Potential regression risks reviewed

- Atomic transaction compatibility with customer account restoration and service-record claiming.
- Email verification evidence update when no A5 evidence exists for an older customer.
- Customer registration without SMS.
- Policy-version hash mismatch behavior.
- Responsive layout on desktop and mobile.

### Known unrelated issues

The full test suite retains 12 known stale legacy test failures outside A5 scope. Local development also reports missing notification-provider and Azure Storage environment configuration, which is expected in this non-beta local validation environment.

## Known Limitations And Next Gate

- The migration is not applied to beta.
- No beta deployment was performed.
- A live customer registration replay with beta email delivery must occur only after migration and application deployment approval.
- This report does not close RR-1A gate A5. Product Owner review is the next checkpoint.

## Scope Confirmation

No vendor agreement, employee agreement, recording-consent redesign, permission-workflow change, Epic 1 change, Epic 3 authorization change, or Epic 11 implementation was performed.
