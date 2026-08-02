# Epic 1 Lessons Learned

**Epic:** Verified Permission Request
**Date reviewed:** 2026-08-02
**Participants:** Codex; Product Owner review pending

## What Went Well

- One canonical service prevented UI, notifications, and recording routes from inventing different permission meanings.
- Hash-only secrets and explicit evidence models made the security boundary testable.
- Building failure, wrong-recipient, expiry, and delivery recovery with the happy path exposed missing states early.
- Focused integration tests caught retry-count and duplicate-decision race details.

## What Surprised Us

- Legacy raw permission tokens appeared in multiple field families, so normalization included metadata and event remnants.
- Existing repository-wide tests contain stale fixture/copy assumptions unrelated to this epic.
- Prisma formatting produces a large mechanical schema diff despite additive semantic changes.
- The permission decision service could be correct while a separate booking metadata field caused the vendor and employee release path to behave as though consent were unnecessary.
- Automated state-machine tests did not replace a live cross-role replay of Create -> Decide -> Release -> Employee camera access.

## What Slowed Development

- Frozen governing files were already deleted in the unrelated worktree and had to remain untouched.
- The master checklist existed outside the repository and needed a repository checkpoint.
- Malformed `.gitignore` patterns complicate normal repository searches.

## What Should Change Before the Next Epic

- Rehearse migrations against a production-like beta backup.
- Run the Product Owner demo with controlled live email/SMS recipients.
- Establish a clean baseline for unrelated test and type failures.
- Repair repository search/lint tooling in an approved maintenance task.
- Add one canonical server-side function for determining whether permission is required and reuse it in booking cards, release authorization, employee lists, and media-session creation.
- Treat live cross-role blocked-state tests as mandatory security tests, not only UX demonstrations.
- Provision and monitor the notification retry scheduler before calling delivery recovery operational.
- Verify deployment ZIP compatibility on the Azure Linux package mount before switching the active package.
- Keep the provider path enabled when a provider is pending, but distinguish application readiness from live handset proof.

## Actions Carried Forward

| Action                                       | Owner                       | Due before             | Status |
| -------------------------------------------- | --------------------------- | ---------------------- | ------ |
| Migration rehearsal and rollback evidence    | Engineering                 | Epic 1 beta deployment | Open   |
| Controlled email/SMS delivery and retry test | Product Owner / Engineering | Epic 1 approval        | Email/retry complete; SMS handset deferred externally |
| Complete Product Owner Demo Checklist        | Product Owner               | Epic 1 closure         | Engineering replay complete; approval pending |
| Triage unrelated test/type/security debt     | Engineering / Product Owner | Private beta release   | Open   |
| Correct customer-residence metadata/gate divergence | Engineering / Product Owner | Epic 1 closure | Complete |
| Expose resend and recipient correction after assignment | Engineering / Product Owner | Epic 1 closure | Complete |
| Configure retry worker secret and scheduler | Engineering / Operations | Epic 1 closure or explicit accepted deferral | Complete; three consecutive runs succeeded |
