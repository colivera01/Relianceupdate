# Epic 1 Product Owner Demo

**Epic:** Verified Permission Request
**Build / commit:** Azure beta package `reliance-beta-08de960-epic1-operational-closeout-202608021730.zip` / `08de960c768463f2fea7c407d7bb39e6dcfacb3b`
**Product Owner:** Cesar Olivera
**Validation date:** 2026-08-02
**Overall result:** Epic 1 engineering and operational closeout passed; Product Owner closure decision pending

## Controlled Test Roles

All tests used dedicated or synthetic beta identities. Passwords, OTPs, raw permission links, and full contact details are intentionally excluded.

| Role | Account class |
| --- | --- |
| Vendor manager | Controlled linked beta vendor/customer account |
| Customer | Synthetic beta customer using a controlled email alias and reserved fictional phone number |
| Employee | The same synthetic beta identity after controlled employee invitation and acceptance |
| Admin | Controlled beta admin account |

## Synthetic Work Records

- Epic Allow Match
- Epic Email OTP
- Epic Decide Later
- Epic Wrong Recipient

## Demo Pages

- Vendor work records: `https://beta.relianceonline.org/vendor/jobs`
- Employee recording view: `https://beta.relianceonline.org/employee/jobs`
- Admin evidence: `https://beta.relianceonline.org/admin/permission-audit`
- Customer permission page: use the newly delivered secure link for each fresh synthetic record. Raw links are never stored in this report.

## PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact action and expected observation | Result |
| --- | --- | --- |
| Expected workflow | Open a fresh customer-residence request, verify identity, select authority, and Allow. The customer sees Private/audio-off education and a success state. | Pass at customer decision layer |
| Decline | Decline a fresh request. Vendor and employee must show Declined and recording must remain locked. | **Corrected - focused server tests and desktop/mobile Playwright pass** |
| Decide later | Choose Decide later. No decision is saved and recording stays locked. | Pass in canonical gate regression and live vendor status replay |
| Wrong recipient | Choose This request is not for me. The request becomes misdirected, not declined, and the vendor can correct contact details. | Pass in controlled browser tests; recovery UI exposed live |
| Matching account | Use the account matching the recipient email and continue without OTP. | Pass |
| Email OTP | Use a controlled inbox, receive OTP, verify, select authority, and decide. | Pass |
| SMS OTP | Send only to a controlled handset and complete the challenge. | Not run - provider accepted a send to a reserved fictional number; no handset existed |
| Expiry/resend | Expire a request, resend as manager, and confirm old-link invalidation and current generation. | Pass in route and browser tests; action exposed live without mutating an existing request |
| Contact correction | Correct the intended recipient and confirm the prior request is superseded. | Pass in route/browser tests; action exposed live and superseded copy verified |
| One-channel failure | Fail one controlled delivery channel and confirm the other channel remains usable. | Automated pass only |
| All-channel failure | Fail all channels and confirm recording stays locked with visible recovery. | Automated pass; live scheduler configured and running, destructive live failure not forced |
| Employee blocked states | Pending, Declined, Expired, Wrong recipient, Superseded, and no-channel states must not expose camera access. | **Corrected for the failed Declined residence case; canonical resolver preserves fail-closed handling for uncertain states** |
| Employee allowed state | Verified Allow may unlock only after unrelated assignment and location gates also pass. | Partial - customer Allow and assignment passed; physical location gate was not completed |
| Expected notifications | Email/SMS explain purpose, Private starting audience, audio off, and separate later publication. | Email and scheduler pass; SMS handset deferred until Telnyx is operational |
| Expected dashboard updates | Vendor and employee show one canonical status and correct next action after every decision. | **Corrected in shared server decision and automated integration coverage** |
| Expected database state | Store only hashes/masks and durable verification, authority, version, decision, and channel attempts. | Partial - automated/code/admin evidence passed; direct live DB inspection blocked by network policy |
| Expected admin state | Permission Audit is read-only, masked, and shows verification method, authority, audio state, decision, events, and delivery attempts. | Pass |
| Expected Trust Score behavior | Permission events create no Trust Score input. | Pass in automated no-side-effect coverage |
| Expected review behavior | Permission events create no review, rating, invitation, or synthetic activity. | Pass in automated coverage; none observed live |
| Expected screenshots | Review the indexed desktop/mobile loading, education, failure, authority, success, blocked, empty, and wrong-recipient states. | Pass for automated package, including new desktop/mobile declined-residence lock evidence |

## Correction Retest Evidence

- Focused affected tests: 62 passed.
- Desktop/mobile canonical-gate Playwright: 2 passed.
- Declined residence stages are disabled and labeled `Recording locked`.
- Camera and upload controls are absent.
- Forced stage interaction creates zero media-session requests.
- Production build passed and beta health returned HTTP 200 on the corrected package.
- Fresh beta login and live email-code delivery passed.
- The vendor jobs page loaded eight records without an error.
- **Manage Recording Permission** opened for an assigned pending request and showed masked contact data, resend, correction, old-link invalidation, and recording-lock guidance.
- Customer Playwright passed refresh, browser close/reopen, and superseded-link scenarios.
- The Azure notification scheduler completed three consecutive five-minute runs after deployment.

## PRODUCT OWNER DEMO CHECKLIST - FINAL MANUAL REPLAY

1. Sign in to beta as the controlled vendor manager and open `/vendor/jobs`.
2. Open **Manage Recording Permission** on a controlled pending request; observe masked recipient, resend, and correction choices.
3. For a fresh synthetic request, resend once and confirm the old link explains that it was replaced.
4. Correct a synthetic recipient and confirm the previous request is superseded while recording stays locked.
5. Open the customer link, refresh, close the browser, reopen the same link, and complete verification.
6. Decline a fresh customer-residence request; confirm vendor and employee show Declined and expose no camera/media-session path.
7. Allow a separate request; confirm assignment and location gates still apply.
8. Open `/admin/permission-audit`; confirm masked immutable evidence and no override.
9. Confirm no permission event creates a review, rating, Trust Score input, publication approval, or Public media.
10. Record SMS handset validation as deferred until Telnyx is operational; do not treat provider absence as a successful handset test.

## Product Owner Decision

- [ ] Approved to close this epic
- [ ] Changes required
- [ ] Blocked by canonical gate defect
- [ ] Next epic authorized

**Decision notes:** Engineering replay, resend/correction UI, scheduler operation, email delivery, automated state coverage, and screenshot evidence are complete. SMS handset validation is deferred as an external provider dependency. Product Owner should perform the ten-step final manual replay and explicitly approve or reject Epic 1 closure. Epic 2 remains unauthorized.
