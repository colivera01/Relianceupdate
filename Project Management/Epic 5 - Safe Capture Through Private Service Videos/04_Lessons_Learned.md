# Epic 5 Lessons Learned

**Epic:** Safe Capture Through Private Service Videos
**Date reviewed:** 2026-08-05
**Participants:** Codex; Product Owner replay pending

## What Went Well

- One evidence service now owns package submission, manager approval, and Private access validation.
- The implementation builds directly on the Epic 4 gate instead of creating a second permission decision.
- Truthful upload states made both recovery behavior and automated testing clearer.
- Fail-closed customer access tests caught incomplete-chain cases before deployment.

## What Surprised Us

- Existing customer media access combined moderation and visibility concepts that were not sufficient for manager-approved Private proof.
- Existing package submission could create unnecessary versions when the same complete package was submitted repeatedly.
- A useful retry experience required preserving the local preview and distinguishing Retry Save from Retake.

## What Slowed Development

- Several older integration fixtures encoded pre-Epic 5 manager-review behavior and needed focused reconciliation.
- Real customer/vendor role screenshots cannot be responsibly produced by browser mocks without bypassing the server authority under test.
- The full repository suite contains unrelated known failures that had to be separated from Epic 5 regressions.

## What Should Change Before the Next Epic

- Apply the additive migration before mounting any Epic 5 application package.
- Run the Product Owner demo on supported Android and iPhone devices, including a controlled network interruption.
- Preserve exact package/version/hash identifiers because Epic 6 will depend on them without rewriting Private proof.
- Keep inherited full-suite failures and dependency advisories in release hardening rather than folding them into Public-publication work.

## Actions Carried Forward

| Action | Owner | Due before | Status |
|---|---|---|---|
| Physical Android/iOS capture and weak-network replay | Product Owner / Engineering | Epic 5 approval / RR-1A | Open |
| Controlled migration-first beta deployment | Product Owner / Engineering | Live demo | Open |
| Customer/vendor/admin live screenshots | Product Owner / Engineering | Epic 5 approval | Open |
| Preserve Private evidence contracts during Epic 6 | Engineering | Epic 6 implementation | Open |
