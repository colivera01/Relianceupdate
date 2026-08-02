# Epic 2 Technical Debt

**Epic:** Proof-First Platform Shell
**Last reviewed:** 2026-08-02

| Issue | Reason | Impact | Recommended resolution | Target Epic | Status |
|---|---|---|---|---|---|
| Local DB lacks `ConsentRecord.lifecycleStatus` | Configured database and Prisma migration baseline differ | Global Playwright setup cannot complete | Reconcile migration state in an approved database task | Epic 3 prerequisite | Open |
| Route-smoke manager account missing | `e2e-trust-manager@reliance.test` is not in registered dev users | Authenticated generic route smoke cannot start | Add/seed a controlled fixture through the approved account test strategy | Epic 3 | Open |
| Full Vitest has 13 failures in 9 files | Stale mocks, fixtures, and historical wording predate or are unrelated to shell copy | Full-suite quality gate is not green | Triage each failure at baseline and repair in owned workflow epics | Epic 3 / Beta hardening | Open |
| Default build heap insufficient | Next production optimization exceeds Node’s default 2 GB heap | Default `npm run build` can terminate locally | Standardize CI/build `NODE_OPTIONS=--max-old-space-size=6144` or reduce build memory | Beta hardening | Open |
| Browserslist dataset is stale | Dependency metadata is 15 months old | Browser targeting warning; no current build failure | Update dependencies in a controlled maintenance change | Beta hardening | Open |
| Human comprehension study pending | Engineering cannot fabricate participant results | Final first-time visitor evidence is incomplete | Run the five-person script in `03_Product_Owner_Demo.md` | Epic 2 approval | Open |
| Full accessibility/device matrix incomplete | Epic capture covered desktop and 390px public shell, not every release viewport/role | Release-wide WCAG/device readiness is unproven | Complete TEST-05 and SHOT-05/06 in release QA | Beta hardening | Open |

No item above is hidden acceptance work for the implemented public-shell scope. Product Owner comprehension review remains an explicit approval gate.
