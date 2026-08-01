# Epic 1 Technical Debt

**Epic:** Verified Permission Request
**Last reviewed:** 2026-07-31

| Issue                                  | Reason                                             | Impact                                        | Recommended resolution                                            | Target Epic                      | Status        |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- | ------------- |
| Epic migrations not deployed           | Deployment was outside this local run              | Feature cannot operate on beta                | Rehearse, deploy in order, verify counts/hashes and rollback flag | Epic 1 operations                | Approval gate |
| Live email/SMS not validated           | No controlled provider credentials/recipients used | Delivery behavior uncertain                   | Run delivery, invalid target, retry, and dead-letter demo         | Epic 1 / Epic 10                 | Approval gate |
| Retry scheduler not validated          | Scheduler ownership is environment-specific        | Queued attempts may not process automatically | Configure worker secret, scheduler, and monitoring                | Epic 10                          | Open          |
| Guardian/minor remains blocked         | Protected-participant scope is later               | Guardian declaration cannot unlock recording  | Implement approved protected-participant workflow                 | Later protected-participant epic | By design     |
| Full tests have 13 failures            | Stale copy and unrelated fixtures                  | Full-suite gate unavailable                   | Scoped maintenance triage                                         | Epic 12                          | Open          |
| Type check has one existing test error | Untyped unrelated test JSON                        | Type gate not green                           | Scoped maintenance fix                                            | Epic 12                          | Open          |
| 25 production dependency advisories    | Existing dependency set                            | Includes critical/high risk                   | Prioritize direct framework/ORM upgrades with regression plan     | Epic 12                          | Open          |
| Malformed `.gitignore`                 | Existing configuration                             | Search tooling reports errors                 | Repair and validate ignore behavior                               | Epic 12                          | Open          |

## Debt Accepted by Product Owner

None recorded.
