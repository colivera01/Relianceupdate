# Epic 7 Product Owner Demo

**Build:** `27fa324` plus `5b83125`
**Prepared:** 2026-08-05
**Overall result:** Product Owner approved Epic 7 engineering; signed-in beta replay remains a release gate

| Validate | Product Owner action and expected observation | Current result | Evidence |
|---|---|---|---|
| Customer Private outcome | Open completed Private proof. Confirm it remains valid and no Public pressure appears. | Pass (fixture) | `08_Screenshots/Desktop/01-customer-private-empty.png` |
| Public withdrawal | Withdraw publication. Refresh and reopen. Public access stops and status says Public withdrawn/Private, not deleted. | Pass (automated) | `02-customer-public-withdrawn.png` |
| Deletion request | Request deletion. Confirm status is Requested/Restricted and does not claim deletion. | Pass (automated) | desktop/mobile deletion screenshots |
| Dispute restriction | Submit privacy/identity/safety concern. Public and direct media reads fail closed pending admin review. | Pass (tests) | lifecycle API and public route tests |
| Employee state | Assigned employee sees likeness-only authority; recording withdrawal blocks canonical gate. | Pass (fixture/tests) | `Mobile/02-employee-likeness-only.png` |
| Vendor state | Vendor sees least-exposure status and cannot restore Public or bypass restrictions. | Pass (tests) | role API tests |
| Admin state | Open `/admin/media-lifecycle`; verify case, hold, appeal, deletion, retry, and final evidence. | Pass (fixture) | `Desktop/04-admin-lifecycle-queue.png` |
| Hold | Create hold, approve deletion, and confirm job remains Held until an authorized release. | Pass (tests) | core lifecycle tests |
| Verified deletion | Run controlled worker against a test blob. Confirm Completed only after `exists=false`. | Blocked | Requires beta migration/storage fixture |
| Retention | Approve Private proof and confirm one schedule per asset; Public approval pauses expiry. | Pass (tests); live pending | manager-approval and core tests |
| Notifications | Confirm current page state; lifecycle-specific outbound notices are not claimed. | Deferred | Epic 10 alignment |
| Trust Score | Confirm no lifecycle action adds/recalculates a Trust Score input. | Pass (code/tests) | no Trust Score mutation in lifecycle paths |
| Reviews | Confirm no withdrawal, dispute, hold, or deletion creates/changes a review. | Pass (code/tests) | no Review mutation in lifecycle paths |
| Audit | Reconstruct actor, role, prior/resulting state, evidence hash, request context, deletion attempts, and verified result. | Pass (tests) | lifecycle audit models/tests |
| Screenshots | Review all eight desktop/mobile/status screenshots; confirm synthetic data only. | Pass | `08_Screenshots/README.md` |

## Exact Live Replay Order

1. Apply the Epic 7 migration before mounting the application package.
2. Use controlled customer, vendor, assigned employee, and admin accounts.
3. Create synthetic completed Private proof and one approved Public proposal.
4. Replay customer Public withdrawal, refresh, direct URL, and customer access.
5. Replay employee likeness withdrawal and vendor dispute.
6. Review the admin queue; create/release a hold and decide a deletion request.
7. Run the worker on a controlled Blob first with forced failure, then successful deletion and independent absence verification.
8. Confirm no review, rating, Trust Score input, permission, recording approval, or new Public eligibility was created.

## Product Owner Decision

- [x] Approved to close/freeze Epic 7
- [ ] Changes required
- [ ] Blocked
- [x] Epic 8 planning authorized

**Decision notes:** Approved on 2026-08-05. Migration, deployment, lifecycle worker scheduling, live Blob validation, cache validation, and signed-in four-role replay remain release gates rather than engineering defects. Epic 8 implementation is not authorized until its plan receives Product Owner approval.
