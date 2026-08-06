# Epic 7 UX Review

**Build reviewed:** `27fa324` plus `5b83125`
**Review date:** 2026-08-05
**Status:** Controlled desktop/mobile review complete; live role replay pending

## Customer

The lifecycle card explains whether proof is Private, Public withdrawn, restricted, held, or pending deletion. Public withdrawal is immediate and does not falsely imply physical deletion. A deletion request explains that evidence may remain restricted while reviewed. The primary action is clear and destructive actions use confirmation.

**Finding:** The customer does not yet receive a lifecycle-specific outbound confirmation. This does not make the in-app state false, but Epic 10 should align delivery and copy. Severity: medium, non-blocking for local engineering.

## Vendor

The vendor sees the current outcome and next responsible participant without receiving authority to reverse a customer withdrawal or admin restriction. The vendor can report a dispute and request deletion, but cannot silently make restricted media Public.

**Finding:** The lifecycle card shares space with existing job controls on dense pages. Mobile hierarchy is acceptable in the fixture, but a real populated vendor job needs beta screenshot review. Severity: low.

## Employee

The assigned employee receives only the likeness-withdrawal action, not customer publication or deletion authority. The mobile fixture clearly identifies the restricted scope. Recording withdrawal also feeds the existing canonical recording gate.

**Finding:** A real assigned-work replay is required to confirm the lifecycle card does not push stage controls below an awkward fold. Severity: low, release gate.

## Admin

The queue separates case, hold, deletion, and appeal evidence. Statuses distinguish request, hold, retry, failure, and verified completion. Admin cannot make a failed deletion appear complete, and an appeal requires a second reviewer.

**Finding:** The queue is operationally dense. Filters and paging are minimal; acceptable for controlled beta volume, but should be revisited when case volume is known. Severity: low.

## Cross-Role Consistency

- Status names are derived from the same canonical resolver.
- Exposure never increases automatically.
- Private remains a complete outcome.
- `Requested`, `Queued`, `Retry Required`, and `Held` never say `Deleted`.
- No role gains broader data or authority from the UI.
- Loading and failure states preserve the last safe assumption and provide retry.

## Journey Summaries

### Customer Journey

Open completed work, review current audience, withdraw Public visibility or recording authority, report a concern, or request deletion. The page immediately shows the least-exposure truthful outcome and identifies what happens next.

### Vendor Journey

Open the work record, see that access has narrowed, understand who must act, and submit a scoped dispute/deletion request without overriding customer or admin authority.

### Employee Journey

Open assigned work, understand whether recording remains allowed, and withdraw personal likeness authorization without controlling the customer's property or publication decision.

### Admin Journey

Open Permission and Media Lifecycle evidence, review immutable history, manage holds/cases/deletion decisions, and verify final disposition without fabricating completion.

## UX Verdict

**Result:** Good for controlled beta engineering evidence
**Blocking confusion:** None found in controlled fixtures
**Ready for Product Owner demo:** Yes, after migration/deployment creates a live role-safe environment
