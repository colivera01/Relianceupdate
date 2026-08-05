# Epic 4 Product Owner Demo

**Build / commit:** Local scoped checkpoint; beta deployment pending

**Demo date:** Pending

**Product Owner:** Cesar Olivera
**Overall result:** Automated package passed; manual replay pending

Use synthetic work records and controlled accounts only. Record Pass, Fail, or Blocked with screenshot/reference evidence.

## Expected Workflow

- [ ] Create a vendor-business, property-only record with no people/audio/sensitive data. Confirm a notice path is used and customer permission is not falsely required.
- [ ] Create a vendor-business person-centered record. Confirm verified permission is required despite the vendor location.
- [ ] Create a customer-residence record. Confirm verified customer/representative permission is always required.
- [ ] Create a customer-business record. Confirm business representative authority does not authorize every person present.
- [ ] Change a material scope answer after approval. Confirm stale permission, certification, location evidence, and release no longer unlock recording.

## Expected Notifications

- [ ] Confirm notice-only work sends a recording notice, not a permission request.
- [ ] Confirm customer-controlled scope sends the Epic 1 verified permission request.
- [ ] Force one controlled delivery failure and confirm retry/dead-letter evidence without a false success.

## Expected Dashboard Updates

- [ ] Keep vendor and employee views open during decisions. Confirm both show the same block code, reason, responsible participant, and next action after refresh.
- [ ] Confirm an assigned blocked job stays visible; it must not disappear from the employee queue.
- [ ] Confirm no recording card exposes an enabled stage while blocked.

## Expected Database State

- [ ] Verify one current `RecordingScopeAssessment` with a stable scope hash.
- [ ] Verify required `RecordingAuthorityRequirement` rows belong to that assessment.
- [ ] Verify certification references current membership, assignment generation, assessment, and scope hash.
- [ ] Verify location attempts preserve coordinates, accuracy, threshold, result, and timestamp.
- [ ] Verify blocked metrics contain only operational block context and no raw token/OTP.

## Expected Admin State

- [ ] Open Permission Audit and confirm current assessment, authority, certification, and location evidence is grouped clearly.
- [ ] Submit a location exception as vendor manager; confirm the same manager cannot approve it.
- [ ] Decide the exception as authorized admin and confirm the new canonical result appears.

## Expected Customer State

- [ ] Confirm the customer understands what may be recorded, audio is off, initial audience is Private, and declining recording is allowed.
- [ ] Confirm recording permission never creates Public media or a publication decision.

## Expected Vendor State

- [ ] Confirm every block says why, who acts next, and what resolves it.
- [ ] Confirm release is unavailable for pending, declined, expired, wrong-recipient, superseded, missing-authority, and unresolved-location states.

## Expected Employee State

- [ ] Confirm only the active assignee can certify and proceed.
- [ ] Confirm reassignment invalidates the former employee certification/access.
- [ ] Confirm location verification is required against the saved work-record snapshot.
- [ ] Confirm camera/session/upload endpoints remain unavailable until the canonical gate allows recording.

## Expected Trust Score Behavior

- [ ] Compare Trust Score inputs before/after all permission and gate actions. Confirm no new input or score change.

## Expected Review Behavior

- [ ] Confirm no review, rating, review window, or synthetic customer activity is created.

## Expected Audit History

- [ ] Reconstruct work creation, assessment generation, authority, notice/request, assignment, certification, location attempt/exception, release, and block metrics.
- [ ] Confirm old evidence remains historical after a material scope change.

## Expected Screenshots

- [ ] Review `08_Screenshots/README.md`.
- [ ] Confirm desktop loading, empty, failure, blocked, and success states.
- [ ] Confirm mobile blocked state has no overlap, clipped copy, or enabled camera action.
- [ ] Confirm all data is controlled and no credential, token, OTP, or customer data appears.

## Automated Evidence Already Passed

| Validation | Result |
|---|---|
| Focused work-record/gate suite | 76/76 passed |
| Epic 4 Playwright state package | 4/4 passed |
| Type check | Passed |
| Production build | Passed |
| Screenshot visual inspection | Passed for captured states |

## Product Owner Decision

- [ ] Approved to deploy migrations/application for beta replay
- [ ] Changes required
- [ ] Blocked
- [ ] Epic 5 authorized

**Decision notes:** Pending Product Owner replay. Epic 5 is not authorized by this engineering checkpoint.
