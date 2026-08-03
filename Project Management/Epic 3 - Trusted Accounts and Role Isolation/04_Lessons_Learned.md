# Epic 3 Phase A Lessons Learned

**Date:** 2026-08-02

## What Went Well

- The permanent rule separated candidate identity from current authority cleanly.
- Characterization tests exposed exact-vendor fallback behavior before broad edits.
- Additive admin grants avoided account merges and destructive migration work.
- Focused browser fixtures verified four-role isolation without real customer data.

## What Surprised Us

- The checklist had no authoritative SEC/ADM row tables, requiring a narrow reconciliation.
- The repository production build is blocked by two untouched legacy Pages Router files after compilation succeeds.
- Dependency auditing now reports a critical Next.js advisory and multiple high advisories in the existing lockfile.

## What Slowed Development

- Broad protected-route inventory across mixed App Router, API, compatibility SDK, and legacy paths.
- Azure SQL latency during full dashboard Playwright rendering.
- Twelve unrelated full-suite failures obscure the otherwise green Phase A suites.

## What Should Change Before Phase B

- Obtain Product Owner approval for a narrowly scoped build repair and dependency upgrade plan.
- Stabilize the full-suite baseline so security regressions are easier to see.
- Keep Phase B in a separate commit series with durable sessions and revocation tested independently.

## Actions Carried Forward

| Action | Owner | Due before | Status |
|---|---|---|---|
| Resolve production build blocker | Product Owner / Engineering | Phase A deployment | Awaiting approval |
| Plan critical/high dependency remediation | Product Owner / Engineering | Private beta release gate | Open |
| Implement durable session lifecycle | Epic 3 Phase B | Phase B approval | Not authorized |
| Preserve exact-membership characterization tests | Engineering | Every authorization change | Active |
