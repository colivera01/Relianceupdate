# Epic 3 Phase A UX Review

**Status:** Completed local review; Product Owner review pending
**Review date:** 2026-08-02

## Customer

Wrong-role vendor and admin pages clearly say that the required access is unavailable and do not render protected content. The primary recovery is sign-in or return to the appropriate account area. The desktop and mobile blocked layouts are readable and do not expose vendor or admin data. Improvement for Phase B: session-expired and account-switching recovery should become more specific once durable sessions exist.

## Vendor

An active manager reaches the existing vendor shell without a new authorization prompt. This preserves the familiar workflow. The vendor boundary fails closed when membership is missing or inactive. The current dashboard may remain in a loading state for several seconds against Azure SQL; latency messaging is truthful but could feel slow and is not caused by Phase A.

## Employee

An employee remains a valid vendor team member but receives `403` when attempting a manager-only profile update. This is the correct boundary, though API denial is stronger than the current visible employee recovery experience. Phase B and later employee UX work should ensure revoked or reassigned employees see a reason-specific message instead of a generic access failure.

## Admin

Only an admin-scoped signed session backed by an active database grant opens the admin dashboard. A general customer/vendor session receives the admin-access-required state. The rule is fair and understandable, but Phase B must add durable revocation and session-management UX.

## Cross-Role Consistency

- Current database state is the authority across all four roles.
- Wrong-role pages do not expose protected content before redirect/recovery.
- Existing product language, private/public meaning, notification copy, and workflow statuses are unchanged.
- No role is granted broader data because a browser, URL, or session claims a role.

## Journey Summaries

### Customer

Sign in, use customer routes, and receive a clear blocked state if a vendor or admin URL is entered directly.

### Vendor

Sign in, current active manager membership is resolved from the database, and the exact vendor workspace opens.

### Employee

Current membership permits employee work but does not permit manager profile administration.

### Admin

Use the admin-scoped session; the server verifies the active user and active database grant before rendering admin content.

## Blocking UX Findings

No Phase A-specific blocking confusion was found in the captured states. Product Owner replay remains required. Build/dependency blockers are engineering issues, not UX findings.

## UX Verdict

**Result:** Good for Phase A boundary states
**Ready for Product Owner demo:** Yes, locally
**Ready for beta deployment review:** No, until the unrelated build blocker is resolved
