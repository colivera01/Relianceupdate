# Epic 4 Lessons Learned

**Date reviewed:** 2026-08-04

## What Went Well

- One canonical decision removed divergent release, camera, media-session, and upload behavior.
- Reusing Epic 1 verified permission preserved security while expanding to actual recording scope.
- Additive evidence models avoided rewriting historical customer decisions.
- Controlled browser fixtures produced safe desktop/mobile evidence without live data.

## What Surprised Us

- Existing dashboard test doubles did not expose new Prisma models, so compatibility had to be explicit without weakening production.
- Location result codes were already consumed by tests and UI; preserving location-specific codes mattered.
- A port collision can make Playwright silently exercise the wrong local application unless the server is isolated.

## What Slowed Development

- Broad legacy tests include unrelated rejected-correction and review/moderation failures.
- The worktree contains unrelated untracked RR planning evidence that required careful staging boundaries.
- Physical camera/GPS behavior cannot be proven by desktop automation.

## What Should Change Before the Next Epic

- Use an isolated Playwright port from the start.
- Keep canonical gate fixtures as shared builders for Epic 5 capture/retry tests.
- Apply migrations before mounting any Epic 4 application package.
- Preserve gate reason codes as API contracts.

## Actions Carried Forward

| Action | Owner | Due before | Status |
|---|---|---|---|
| Apply both Epic 4 migrations before application deployment | Engineering | Beta replay | Open |
| Run Product Owner three-location replay | Product Owner / Engineering | Epic 4 approval | Open |
| Validate physical camera, GPS, upload, retry, and manager review | Epic 5 | RR-1A recording gate | Open |
| Keep gate metric operational-only | Engineering | Every future epic | Permanent rule |
