# Epic 2 Lessons Learned

**Epic:** Proof-First Platform Shell
**Date reviewed:** 2026-08-02

## What Went Well

- The copy-preservation rule kept the change focused and prevented a broad rewrite.
- Stable routes allowed the product identity to improve without breaking inbound links.
- Before/after beta captures made the hierarchy improvement concrete.
- Focused tests separated proof-shell behavior from unrelated repository failures.
- Epic 1 recording-gate replay proved the shell did not weaken permission behavior.

## What Surprised Us

- The current application already had strong provider-credibility content; a major vendor-profile redesign was unnecessary.
- Product naming drift also appeared in admin and recommendation-only AI guidance, not just public pages.
- The default build heap was insufficient even though the application compiled successfully with the repository’s established larger heap.

## What Slowed Development

- `.gitignore` behavior required controlled `rg --no-ignore` exclusions.
- Playwright global setup expects a local database column not present in the configured database.
- General route smoke expects a local account missing from the registered test-user fixture.
- The full suite contains stale mocks and copy expectations unrelated to this epic.

## What Should Change Before the Next Epic

- Reconcile the local test database and migration baseline before depending on global Playwright setup.
- Repair or replace missing/stale role fixtures so authenticated route smoke can run reliably.
- Keep a focused golden suite per epic and classify full-suite failures against the starting commit.
- Continue preserving effective copy and require evidence before rewriting.

## Actions Carried Forward

| Action | Owner | Due before | Status |
|---|---|---|---|
| Gather independent comprehension feedback | Product Owner / Beta participants | Private beta feedback cycle | Deferred - not an engineering blocker |
| Reconcile local DB migration baseline | Engineering | Epic 3 implementation | Open |
| Restore authenticated route-smoke fixture | Engineering | Epic 3 validation | Open |
| Triage 13 full-suite failures | Engineering | Private beta hardening | Open |
