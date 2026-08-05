# Epic 4 UX Review

**Review date:** 2026-08-04

**Build:** Local Epic 4 implementation on `codex/epic3-beta-admin-grant-correction`

**Evidence:** `08_Screenshots/README.md`
**Result:** Ready for Product Owner demo after migration/deployment approval

## Customer

The customer remains in control through the existing verified permission experience. Epic 4 adds a concise explanation of the planned recording subject and keeps audio off. Private remains the starting point and declining recording does not fabricate a negative outcome.

**Potential confusion:** A customer does not yet receive the complete post-capture Private proof journey; that is Epic 5. The current screens must not imply that allowing recording makes media Public.

## Vendor

The vendor creates a work record by choosing location, planned subject, frame control, sensitive risks, authority holder, and whether service can continue without recording. The work card then shows the canonical block, responsible participant, and resolving action.

**Potential confusion:** The assessment has several branches. Progressive disclosure keeps it practical, but the Product Owner should verify that first-time managers understand property-only versus person-centered scope without training.

## Employee

The employee sees the assigned work, approved scope, audio state, stop rules, and one reason-specific block. Desktop and mobile evidence show readable hierarchy with disabled stage controls when permission is declined. An unlocked property-only record exposes stage controls without showing a false permission request.

**Potential confusion:** The capture panel still says uploads are locked while manager review is pending even when the canonical block is customer decline. This is established capture copy, not an authorization defect, but should be reviewed during Epic 5 copy alignment.

## Admin

The admin receives assessment, authority, certification, location attempt, exception, and permission evidence. Admin may decide a requested location exception but cannot create customer authority, approve recording for the customer, or widen the assessed scope.

**Potential confusion:** Evidence density is necessarily high. Grouping by assessment generation is important so an admin does not mistake historical evidence for the current gate.

## Cross-Role Consistency

- Status names derive from the same server result: **Yes**.
- Block reason, responsible participant, and next action match: **Yes**.
- Private/Public meaning changed: **No**.
- Notifications match permission versus notice path: **Yes, automated coverage; live delivery not tested**.
- A role can broaden missing authority: **No**.

## Visual Review

| State | Desktop | Mobile | Finding |
|---|---|---|---|
| Declined residence block | Reviewed | Reviewed | Clear why/who/next hierarchy; no clipping or hidden stage controls. |
| Loading | Reviewed | Not separately captured | Truthful and actionable; no false empty queue. |
| Empty | Reviewed | Not separately captured | Explains assignment process and next action. |
| Failure | Reviewed | Not separately captured | Distinguishes unavailable data from an empty queue. |
| Unlocked property-only | Reviewed | Not separately captured | Stage controls are obvious and permission is not falsely requested. |

## Journey Summaries

### Customer Journey

Receives the appropriate notice or verified request, confirms identity/authority where required, allows or declines recording, and sees no implication that recording approval equals Public approval.

### Vendor Journey

Creates a work record, assesses what may appear, identifies authority, sends the correct notice/request, assigns an employee, and sees the exact unresolved gate before release.

### Employee Journey

Opens only assigned work, reviews the current scope, certifies it, verifies location, and records only after every current gate passes. If blocked, the page names the reason, owner, and resolution.

### Admin Journey

Reviews durable evidence and decides only authorized location exceptions. The admin cannot substitute for customer permission or employee certification.

## Blocking UX Findings

None found in the local controlled evidence. Product Owner replay and physical-device validation remain required before beta readiness.

## UX Verdict

The new gate is understandable without training in the tested employee states. The interface reduces anxiety by saying when service may continue without recording and avoids generic failure language. The experience is ready for a controlled Product Owner demo, not yet for final release certification.
