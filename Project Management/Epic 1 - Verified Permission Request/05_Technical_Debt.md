# Epic 1 Technical Debt

**Epic:** Verified Permission Request
**Last reviewed:** 2026-08-02

| Issue                                  | Reason                                             | Impact                                        | Recommended resolution                                            | Target Epic                      | Status        |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- | ------------- |
| Customer-residence permission gate divergence | Recording-compliance metadata could disagree with immutable permission scope | Previously allowed release/camera controls after Decline | Resolved by one canonical server resolver across release, dashboards, media session, stage save, and upload paths; no data rewrite required | Epic 1 | **Resolved in `97396da`** |
| Recovery actions unavailable after assignment | Active vendor card did not expose resend/correction despite route support | Wrong-recipient and failed-delivery recovery could not be completed in normal UI | Resolved with authorized resend/correction dialog and superseded-link UX | Epic 1 | **Resolved in `08de960`** |
| SMS handset delivery not validated     | Telnyx is not operational yet     | Application wiring is ready, but physical delivery and callbacks are unproved | Validate on a controlled handset after provider activation | Epic 1 / Epic 10 | **Deferred - External Provider Dependency** |
| Retry scheduler not configured         | Worker route existed without an evidenced beta schedule | Retries/dead-letter progression could stall | Resolved with secured five-minute Azure Logic App schedule and worker query correction | Epic 1 / Epic 10 | **Resolved; three consecutive runs succeeded** |
| Registration email uses internal Azure host | Public-base URL is not applied in the registration email path | First-time beta users receive an unusable verification link | Use the approved public beta origin and add template/link regression coverage | Epic 2 or approved maintenance | Open unrelated |
| Guardian/minor remains blocked         | Protected-participant scope is later               | Guardian declaration cannot unlock recording  | Implement approved protected-participant workflow                 | Later protected-participant epic | By design     |
| Full tests have 13 failures            | Stale copy and unrelated fixtures                  | Full-suite gate unavailable                   | Scoped maintenance triage                                         | Epic 12                          | Open          |
| Type check has one existing test error | Untyped unrelated test JSON                        | Type gate not green                           | Scoped maintenance fix                                            | Epic 12                          | Open          |
| 25 production dependency advisories    | Existing dependency set                            | Includes critical/high risk                   | Prioritize direct framework/ORM upgrades with regression plan     | Epic 12                          | Open          |
| Malformed `.gitignore`                 | Existing configuration                             | Search tooling reports errors                 | Repair and validate ignore behavior                               | Epic 12                          | Open          |

## Debt Accepted by Product Owner

None recorded.
