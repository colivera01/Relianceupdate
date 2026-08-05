# Epic 5 Product Owner Demo

**Epic:** Safe Capture Through Private Service Videos
**Build:** Pending scoped commit
**Demo date:** Pending
**Product Owner:** Cesar Olivera
**Overall result:** Ready to run after controlled migration/application deployment

Use synthetic people, addresses, services, email, phone, and video only. Record Pass, Fail, or Blocked for every row.

| # | Exact Product Owner action | Expected observation | Result |
|---|---|---|---|
| 1 | Create a synthetic work record and complete the existing assessment, permission, assignment, certification, and location gates. | Employee sees the assigned work and camera remains locked until the canonical gate allows it. | Not run |
| 2 | On a supported phone, open Starting Condition and record under 30 seconds. | Audio is off, preview appears, and saving shows Uploading then Saved. | Not run |
| 3 | Repeat for Work in Progress and Final Result. | All three stages show Saved; no optimistic or ambiguous waiting state appears. | Not run |
| 4 | During a controlled upload, interrupt connectivity. | The stage shows Retry Required, preserves the preview where supported, and offers Retry Save and Retake. | Not run |
| 5 | Retry the same upload. | One current accepted stage exists; no duplicate accepted asset or duplicate package is created. | Not run |
| 6 | Submit the three Saved stages twice. | One manager-review package version exists; repeated identical submission is idempotent. | Not run |
| 7 | Sign in as the vendor manager and request correction for one stage. | The selected stage and reason are explicit; other stages remain Saved. | Not run |
| 8 | As the employee, replace only the requested stage and resubmit. | Replacement has a new stage version and lineage; unrelated stages are unchanged. | Not run |
| 9 | As manager, inspect provenance and approve Private proof. | Booking becomes complete and customer-only access is granted atomically. No admin Public moderation item appears. | Not run |
| 10 | Sign in as the authorized customer and open the service record. | All three exact approved stages play beneath a Private Service Video notice. Nothing is labeled Public. | Not run |
| 11 | Try the same booking as another customer. | Package and download are denied without disclosing another customer's data. | Not run |
| 12 | Try the vendor download as a non-manager employee. | Access is denied. The active vendor manager can use the approved Private path. | Not run |
| 13 | Inspect controlled database evidence. | Chain connects work record, assessment, permission, gate decision, employee, capture/session/hash, package version, manager decision, and customer grant/access. | Not run |
| 14 | Inspect reviews, Trust Score, publication, Public media, and admin moderation. | No review, rating, Trust Score input, publication approval, Public asset, or moderation task was created by Epic 5. | Not run |
| 15 | Refresh/reopen employee, vendor, and customer pages after each transition. | Each role reconstructs current server state; no stale client state grants access or loses a Saved stage. | Not run |

## Expected Notifications

- Existing package-submitted notification reaches the manager once.
- Existing correction notification identifies the work record and reason without implying Public use.
- Existing proof-ready notification reaches the authorized customer once with the secure service-record path.
- Provider delivery should be recorded truthfully; no live SMS success is expected until Telnyx is operational.

## Expected Dashboard States

- Employee: three Saved stages, then submitted/manager-review state.
- Vendor: exact package and stage-specific actions, then Private-approved completion.
- Customer: Private package available only after manager approval and complete evidence.
- Admin: no Public moderation work for this Private package.

## Expected Screenshots

- Employee desktop/mobile: all three Saved.
- Employee desktop/mobile: Retry Required with preserved preview.
- Live demo: vendor manager review/correction/Private approval.
- Live demo: customer Private Service Video.
- Live demo: unauthorized customer and non-manager denial.
- Live demo: admin queue showing no Public item from Private approval.

## Product Owner Decision

- [ ] Approved to close this epic
- [ ] Changes required
- [ ] Blocked
- [ ] Next epic authorized

**Decision notes:** Pending live replay.
