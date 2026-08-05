# Epic 6 Lessons Learned

**Date reviewed:** 2026-08-05

## What Went Well

- Epic 5 hashes and package versions made exact-media approval enforceable without weakening Private proof.
- One canonical Public resolver removed reliance on scattered visibility flags.
- A controlled visual fixture provided repeatable role/state evidence without production bypasses.

## What Surprised Us

- Public eligibility affected more read surfaces than the moderation screen: discovery, service detail, categories, favorites, vendor profiles, and direct media access all required canonical filtering.
- Historical `public` metadata could not be trusted as customer exact-media approval.

## What Slowed Development

- Public visibility had accumulated in several independent APIs.
- Full-suite failures outside Epic 6 required explicit classification to separate regressions from existing fixture debt.

## What Should Change Before the Next Epic

- Apply and reconcile the migration before deployment.
- Replay changed-version invalidation and direct media access against real beta storage/cache behavior.
- Keep withdrawal work in Epic 7 layered on the canonical eligibility record rather than adding another visibility flag.

## Actions Carried Forward

| Action | Owner | Due before | Status |
|---|---|---|---|
| Apply/reconcile migration and deploy as one controlled checkpoint | Engineering / Product Owner | Live Epic 6 demo | Open |
| Profile canonical Public resolver query volume | Engineering | Release hardening | Open |
| Add publication lifecycle delivery through the approved notification architecture | Epic 10 | Notification alignment | Open |
