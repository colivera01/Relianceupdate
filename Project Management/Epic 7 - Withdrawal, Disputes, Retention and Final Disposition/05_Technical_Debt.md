# Epic 7 Technical Debt

**Last reviewed:** 2026-08-05

| Issue | Reason | Impact | Recommended resolution | Target | Status |
|---|---|---|---|---|---|
| Beta migration/deployment pending | This checkpoint did not change beta | No live lifecycle evidence yet | Migration-first controlled deployment | Epic 7 release gate | Open |
| Live Blob and cache replay pending | Local fixtures cannot prove Azure absence/cache behavior | Physical purge and prompt unpublishing need provider evidence | Controlled blob failure/success and direct URL/cache test | Epic 7 release gate | Open |
| Worker cadence/alerting pending | Worker route exists; Azure schedule is not configured here | Retention/deletion can remain queued | Configure Logic App and failure alerting | Epic 12 | Open |
| Lifecycle outbound notifications | Epic 7 did not redesign Notifications | Participants rely on in-app state until aligned | Add approved lifecycle templates/retries | Epic 10 | Open |
| Existing completed-record reconciliation | Schedules are created at approval or lifecycle read | Untouched historical records may lack schedules | Run controlled reconciliation after migration | Epic 7 release gate | Open |
| Admin queue scale | Controlled beta expects low volume | Paging/filtering may be limited at higher volume | Observe beta volume before expanding | Epic 12 | Accepted |
| Legacy archive compatibility fields | Existing consumers still read `deletedAt/archiveStatus` | Two representations remain | Remove only after consumers use lifecycle evidence | Future hardening | Open |
| Five baseline test failures | Predate and do not exercise Epic 7 | Full suite is not green | Resolve in owning modules without reopening Epic 7 | Existing owners | Open |
