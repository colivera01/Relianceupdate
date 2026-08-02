# Epic 1 Operational Closeout Report

**Epic:** Verified Permission Request
**Date:** 2026-08-02
**Branch:** `cursor-latest-build`
**Starting closeout commit:** `1a45162b22f4b2888e262fb9a69029c11714ebe7`
**Runtime commit:** `08de960c768463f2fea7c407d7bb39e6dcfacb3b`
**Azure package:** `reliance-beta-08de960-epic1-operational-closeout-202608021730.zip`

## Objective

Close the four approved operational items without reopening Epic 1 design: expose resend/contact correction, verify notification scheduling, perform a fresh signed-in replay, and prepare the SMS path for later handset validation.

## Outcome

1. **Resend / contact correction:** Complete. Authorized managers can recover assigned requests from the work-record card. Contacts are masked in status text; resend and correction rotate the secure link and preserve audit history.
2. **Notification scheduler:** Complete. A secured Azure Logic App calls the worker every five minutes. Three consecutive runs succeeded after deployment. The worker rejects unauthenticated calls with HTTP 401.
3. **Fresh signed-in replay:** Complete. Live email-code delivery, sign-in, vendor jobs, and the recovery dialog passed. No live customer request was resent or altered during this read-only replay.
4. **SMS handset validation:** **Deferred - External Provider Dependency.** `SMS_ENABLED=true`; generation, hashing, provider routing, retry/failure behavior, and secret-safety tests remain active. No handset-delivery claim is made before Telnyx is operational.

## Implementation

- Added the vendor recovery dialog and clear link-rotation consequences.
- Added a specific superseded-link customer state.
- Corrected the notification worker's active database lookup while preserving delivery-failure eligibility checks.
- Added focused route and desktop/mobile browser regression coverage.
- No migration, policy change, frozen-document change, or later-epic behavior.

## Verification

| Check | Result |
| --- | --- |
| Focused Vitest | 21 passed |
| Customer permission Playwright | 7 passed |
| Vendor recovery Playwright | 2 passed |
| Type check | Passed |
| Production build | Passed with 6 GB heap; 197/197 pages |
| Beta health / mounted commit | Healthy / `08de960c...` |
| Scheduler | Three consecutive successful five-minute runs |
| Live email and sign-in | Passed |
| Live vendor jobs and recovery dialog | Passed |
| SMS handset | Deferred - Telnyx not operational |

## Deployment Note

An initial ZIP used Windows separators and failed on Azure's Linux package mount. A second archive format was also rejected. The deployment was rolled back immediately, rebuilt with compatible forward-slash ZIP entries, and redeployed successfully. No schema or data change occurred during this incident.

## Security And Side Effects

- No raw permission token or OTP is stored in committed evidence or shown by the recovery UI.
- Worker authentication remains secret-separated; secret values are not recorded here.
- Uncertain permission states remain locked.
- No review, rating, Trust Score input, publication approval, or Public media is created.
- The local workstation could not directly query Azure SQL due network policy; this is an evidence limitation, not an application defect.

## Product Owner Decision Required

Engineering recommends the Product Owner perform the final checklist in `03_Product_Owner_Demo.md`. Epic 1 can be approved with SMS handset validation recorded as an external dependency, or held open until Telnyx activation. Epic 2 remains unauthorized until that decision.
