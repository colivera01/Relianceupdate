# Epic 6 Technical Debt

**Last reviewed:** 2026-08-05

| Issue | Reason | Impact | Recommended resolution | Target Epic | Status |
|---|---|---|---|---|---|
| Canonical Public resolver may issue repeated evidence queries | Correctness and fail-closed validation were prioritized | Possible public-page latency with many assets | Measure beta query count; batch only without weakening validation | Release hardening | Open |
| Publication lifecycle notifications not implemented | Final scope preserved Notifications for later alignment | Users must rely on current role views until delivery is added | Add idempotent events, retry evidence, and approved copy | Epic 10 | Open |
| Legacy Public data reconciliation not executed | Migration was not applied in this local checkpoint | Beta counts remain unchanged until deployment gate | Reconcile before/after counts during controlled migration | Epic 6 release gate | Open |
| Physical storage/cache invalidation not live-tested | Local environment lacks beta storage/database configuration | Direct-link behavior requires beta evidence | Run direct URL/cache replay after deployment | Epic 6 release gate | Open |
| Full accessibility review incomplete | Controlled screenshots do not replace assistive testing | Potential nonvisual usability gaps | Complete keyboard, screen-reader, zoom, and contrast pass | Release hardening | Open |
| Five unrelated full-suite failures remain | Existing fixture/expectation issues outside Epic 6 | Full repository suite is not green | Address in owned maintenance checkpoints | Release hardening | Open |

No item above permits Public media without a complete exact-media evidence chain.
