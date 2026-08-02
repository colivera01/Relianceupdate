# Epic 1 Product Owner Demo

**Epic:** Verified Permission Request
**Build / commit:** Azure beta package `reliance-beta-97396da-canonical-gate-complete-20260802145600.zip` / `97396da7f6c99f6cea34e7ed40b05973b548ed38`
**Product Owner:** Cesar Olivera
**Validation date:** 2026-08-02
**Overall result:** Release-blocking gate corrected and deployed; manual Product Owner acceptance and unrelated Epic 1 operations remain open

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
| Decide later | Choose Decide later. No decision is saved and recording stays locked. | Partial - customer/admin correct; vendor showed unsafe next-step copy |
| Wrong recipient | Choose This request is not for me. The request becomes misdirected, not declined, and the vendor can correct contact details. | Partial - customer/admin correct; tested vendor UI did not expose correction |
| Matching account | Use the account matching the recipient email and continue without OTP. | Pass |
| Email OTP | Use a controlled inbox, receive OTP, verify, select authority, and decide. | Pass |
| SMS OTP | Send only to a controlled handset and complete the challenge. | Not run - provider accepted a send to a reserved fictional number; no handset existed |
| Expiry/resend | Expire a request, resend as manager, and confirm old-link invalidation and current generation. | Automated pass; blocked in live UI after assignment |
| Contact correction | Correct the intended recipient and confirm the prior request is superseded. | Automated pass; blocked in live UI after assignment |
| One-channel failure | Fail one controlled delivery channel and confirm the other channel remains usable. | Automated pass only |
| All-channel failure | Fail all channels and confirm recording stays locked with visible recovery. | Automated pass only; live retry scheduler is not configured |
| Employee blocked states | Pending, Declined, Expired, Wrong recipient, Superseded, and no-channel states must not expose camera access. | **Corrected for the failed Declined residence case; canonical resolver preserves fail-closed handling for uncertain states** |
| Employee allowed state | Verified Allow may unlock only after unrelated assignment and location gates also pass. | Partial - customer Allow and assignment passed; physical location gate was not completed |
| Expected notifications | Email/SMS explain purpose, Private starting audience, audio off, and separate later publication. | Partial - email delivered; SMS provider accepted; retry scheduler absent |
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
- A fresh signed-in browser replay was attempted but not completed because the retained vendor session had expired and Chrome control timed out. This is recorded as unrun manual acceptance, not as a Reliance failure.

## Required Product Owner Retest After Correction

1. Create a new customer-residence record.
2. Confirm the vendor card identifies permission as required before assignment and after assignment.
3. Decline through the customer link.
4. Confirm **Send Service Order** is absent or disabled with a truthful Declined reason.
5. Confirm the employee cannot see stage camera controls or create a media session.
6. Repeat with Decide later, Wrong recipient, Expired, Superseded, and no-channel states.
7. Allow a separate record and confirm permission alone does not bypass assignment or location verification.
8. Confirm Resend and Correct recipient are available when recovery is valid.
9. Confirm Admin Permission Audit remains masked and immutable.
10. Confirm no review, rating, Trust Score input, publication approval, or Public media is created.

## Product Owner Decision

- [ ] Approved to close this epic
- [x] Changes required
- [ ] Blocked by canonical gate defect
- [ ] Next epic authorized

**Decision notes:** The approved canonical gate correction is deployed. Product Owner should rerun the ten steps above with a fresh signed-in session. Epic 1 remains open for the already-recorded resend/recovery, retry-scheduler, and live SMS evidence; Epic 2 remains unauthorized.
