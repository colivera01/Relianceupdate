# Epic 3 Phase A Technical Debt

**Last reviewed:** 2026-08-03

| Issue | Reason | Impact | Recommended resolution | Target | Status |
|---|---|---|---|---|---|
| Durable server sessions absent | Explicit Phase B boundary | Immediate revocation/logout-everywhere unavailable | Add durable sessions, revocation, trusted-device model | Epic 3 Phase B | Not authorized |
| Cross-tab account synchronization absent | Explicit Phase B boundary | Multiple tabs may show stale client state until request/refresh | Add server-backed session events and tab synchronization | Epic 3 Phase B | Not authorized |
| Password reset/passkey/MFA lifecycle not unified | Explicit Phase B boundary | Recovery and strong-auth lifecycle remain fragmented | Implement after Identity Foundation approval | Epic 3 Phase B | Not authorized |
| Invite acceptance lifecycle not redesigned | Explicit Phase B boundary | Legacy invitation edge cases remain | Build current-membership invite acceptance and revocation | Epic 3 Phase B | Not authorized |
| Earlier production-build failure named two legacy pages | Historical build state was not reproducible; both pages have valid exports | Prior report incorrectly identified an active source blocker | Preserve the routes; use fresh 6 GB heap build evidence | Pre-deployment maintenance | Resolved by verification |
| Critical Next.js advisory | Existing `next@15.3.3` | Reachable framework risk blocked deployment | Upgraded to `next@15.5.21`; build and focused regressions pass | Pre-deployment maintenance | Resolved |
| 17 High production-tree advisories | Current lockfile after Next remediation | Mixed runtime, optional, build, and test exposure | Follow the package-by-package decision; no blind or force upgrade | Pre-beta hardening | Assessed; remediation pending |
| Raw standalone trace contains `.env` | Next output tracing copies a repository environment file | A raw package could include deployment secrets if assembled without exclusion rules | Prove Azure ZIP assembly excludes `.env` and `.env.*`, or switch to an explicit package allowlist | Pre-deployment maintenance | Blocking |
| 12 unrelated suite failures | Stale tests/fixtures and other workflows | Full suite not green | Triage in owning epic without hiding Phase A results | Owning epics | Open |
| Azure SQL dashboard latency | Remote DB and heavy dashboard query | Slower E2E and visible loading | Profile/query optimization after security work | Future performance | Open |

No Phase A acceptance defect is hidden here. The production build passes and the Critical Next.js advisory is resolved. Deployment remains blocked until Azure package assembly proves environment-file exclusion and the remaining runtime High advisories receive their separate decision.
