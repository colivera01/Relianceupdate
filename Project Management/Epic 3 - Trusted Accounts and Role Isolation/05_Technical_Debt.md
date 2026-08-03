# Epic 3 Phase A Technical Debt

**Last reviewed:** 2026-08-02

| Issue | Reason | Impact | Recommended resolution | Target | Status |
|---|---|---|---|---|---|
| Durable server sessions absent | Explicit Phase B boundary | Immediate revocation/logout-everywhere unavailable | Add durable sessions, revocation, trusted-device model | Epic 3 Phase B | Not authorized |
| Cross-tab account synchronization absent | Explicit Phase B boundary | Multiple tabs may show stale client state until request/refresh | Add server-backed session events and tab synchronization | Epic 3 Phase B | Not authorized |
| Password reset/passkey/MFA lifecycle not unified | Explicit Phase B boundary | Recovery and strong-auth lifecycle remain fragmented | Implement after Identity Foundation approval | Epic 3 Phase B | Not authorized |
| Invite acceptance lifecycle not redesigned | Explicit Phase B boundary | Legacy invitation edge cases remain | Build current-membership invite acceptance and revocation | Epic 3 Phase B | Not authorized |
| Production build blocked by two legacy pages | Predates Phase A | Cannot produce deployable package | Approve narrow repair of `pages/support` and `pages/notifications` | Pre-deployment maintenance | Awaiting approval |
| 25 dependency advisories | Existing lockfile versions | Critical/high release risk until assessed and upgraded | Separate dependency upgrade with full regression and rollback | Pre-beta hardening | Open |
| 12 unrelated suite failures | Stale tests/fixtures and other workflows | Full suite not green | Triage in owning epic without hiding Phase A results | Owning epics | Open |
| Azure SQL dashboard latency | Remote DB and heavy dashboard query | Slower E2E and visible loading | Profile/query optimization after security work | Future performance | Open |

No Phase A acceptance defect is hidden here. Deployment is explicitly blocked until the build issue is approved and resolved.
