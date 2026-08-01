# Epic 1 Lessons Learned

**Epic:** Verified Permission Request
**Date reviewed:** 2026-07-31
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

## What Slowed Development

- Frozen governing files were already deleted in the unrelated worktree and had to remain untouched.
- The master checklist existed outside the repository and needed a repository checkpoint.
- Malformed `.gitignore` patterns complicate normal repository searches.

## What Should Change Before the Next Epic

- Rehearse migrations against a production-like beta backup.
- Run the Product Owner demo with controlled live email/SMS recipients.
- Establish a clean baseline for unrelated test and type failures.
- Repair repository search/lint tooling in an approved maintenance task.

## Actions Carried Forward

| Action                                       | Owner                       | Due before             | Status |
| -------------------------------------------- | --------------------------- | ---------------------- | ------ |
| Migration rehearsal and rollback evidence    | Engineering                 | Epic 1 beta deployment | Open   |
| Controlled email/SMS delivery and retry test | Product Owner / Engineering | Epic 1 approval        | Open   |
| Complete Product Owner Demo Checklist        | Product Owner               | Epic 1 closure         | Open   |
| Triage unrelated test/type/security debt     | Engineering / Product Owner | Private beta release   | Open   |
