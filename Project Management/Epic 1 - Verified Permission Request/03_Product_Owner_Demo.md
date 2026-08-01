# Epic 1 Product Owner Demo

**Epic:** Verified Permission Request
**Build / commit:** This Epic 1 Git checkpoint
**Product Owner:** Cesar Olivera
**Overall result:** Not run - ready after beta migration/provider setup

## PRODUCT OWNER DEMO CHECKLIST

Record Pass, Fail, or Blocked for every row.

| Validate                      | Exact action and expected observation                                                                                                                                                         | Result  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Expected workflow             | Create an eligible customer-location work record. Open the customer request, verify identity, select valid authority, and allow. Employee recording unlocks only after the verified decision. | Not run |
| Decline                       | Use a fresh record and decline. Vendor/employee show declined, camera stays locked, and service may continue without Reliance recording.                                                      | Not run |
| Decide later                  | Leave a pending request undecided. It remains pending and locked.                                                                                                                             | Not run |
| Wrong recipient               | Report “not for me.” The link cannot decide, the state is not declined, and vendor sees correction.                                                                                           | Not run |
| Verification failure          | Enter invalid/expired OTPs. No decision is accepted and no secret is revealed.                                                                                                                | Not run |
| Expiry/resend                 | Use an expired request, resend as manager, and confirm old link invalid/new generation current. Accepted decisions are not replaced.                                                          | Not run |
| Expected notifications        | Confirm email/SMS recipient, Private/audio-off copy, link, wrong-recipient guidance, retries, and evidence.                                                                                   | Not run |
| Expected dashboard updates    | Refresh vendor and employee views after each state; both show one canonical status and next action.                                                                                           | Not run |
| Expected database state       | Confirm only hashes/masks, one current request, durable verification/authority/version/decision evidence, and independent attempts.                                                           | Not run |
| Expected admin state          | Confirm read-only Permission Audit and non-admin denial; no decision override.                                                                                                                | Not run |
| Expected customer state       | Verify loading, education, failure, authority, allowed, declined, wrong-recipient, expired, and unavailable states on desktop/mobile.                                                         | Not run |
| Expected vendor state         | Only a manager in the booking's active vendor may create/resend/correct; other users receive non-enumerating denial.                                                                          | Not run |
| Expected employee state       | Assigned employee sees the block and cannot open camera until verified Allow exists.                                                                                                          | Not run |
| Expected Trust Score behavior | Allow, decline, and no response create no Trust Score input.                                                                                                                                  | Not run |
| Expected review behavior      | Permission creates no review, rating, synthetic activity, or invitation.                                                                                                                      | Not run |
| Expected audit history        | Reconstruct version, recipient mask, attempts, OTP outcome, authority, decision, IP/user agent, and lifecycle events.                                                                         | Not run |
| Expected screenshots          | Review `08_Screenshots/README.md`; confirm controlled data and required desktop/mobile states.                                                                                                | Not run |

## Product Owner Decision

- [ ] Approved to close this epic
- [ ] Changes required
- [ ] Blocked
- [ ] Next epic authorized

**Decision notes:** Pending.
