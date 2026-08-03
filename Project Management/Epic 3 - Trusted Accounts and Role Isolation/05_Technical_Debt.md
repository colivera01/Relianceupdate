# Epic 3 Phase A Technical Debt

**Last reviewed:** 2026-08-03

| Issue | Reason | Impact | Recommended resolution | Target | Status |
|---|---|---|---|---|---|
| Durable server sessions absent | Explicit Phase B boundary | Immediate revocation/logout-everywhere unavailable | Add durable sessions, revocation, trusted-device model | Epic 3 Phase B | Not authorized |
| Cross-tab account synchronization absent | Explicit Phase B boundary | Multiple tabs may show stale client state until request/refresh | Add server-backed session events and tab synchronization | Epic 3 Phase B | Not authorized |
| Password reset/passkey/MFA lifecycle not unified | Explicit Phase B boundary | Recovery and strong-auth lifecycle remain fragmented | Implement after Identity Foundation approval | Epic 3 Phase B | Not authorized |
| Invite acceptance lifecycle not redesigned | Explicit Phase B boundary | Legacy invitation edge cases remain | Build current-membership invite acceptance and revocation | Epic 3 Phase B | Not authorized |
| Earlier production-build failure named two legacy pages | Historical build state was not reproducible; both pages have valid exports | Prior report incorrectly identified an active source blocker | Preserve the routes; use fresh 6 GB heap build evidence | Pre-deployment maintenance | Resolved by verification |
| Critical Next.js advisory | Existing `next@15.3.3` | Reachable framework risk blocks deployment | Seek approval for scoped `next@15.5.21` update and full Epic 1/2/3/build regression | Pre-deployment maintenance | Blocking |
| 16 High production-tree advisories | Existing lockfile versions | Mixed runtime, optional, build, and test exposure | Follow the package-by-package decision in the readiness report; no blind or force upgrade | Pre-beta hardening | Assessed; remediation pending |
| 12 unrelated suite failures | Stale tests/fixtures and other workflows | Full suite not green | Triage in owning epic without hiding Phase A results | Owning epics | Open |
| Azure SQL dashboard latency | Remote DB and heavy dashboard query | Slower E2E and visible loading | Profile/query optimization after security work | Future performance | Open |

No Phase A acceptance defect is hidden here. The production build passes. Deployment remains blocked by the Critical Next.js advisory until an approved remediation is implemented and verified.
