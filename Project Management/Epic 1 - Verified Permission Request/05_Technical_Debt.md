# Epic 1 Technical Debt

**Epic:** Verified Permission Request
**Last reviewed:** 2026-08-02

| Issue                                  | Reason                                             | Impact                                        | Recommended resolution                                            | Target Epic                      | Status        |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- | ------------- |
| Customer-residence permission gate divergence | Recording-compliance metadata could disagree with immutable permission scope | Previously allowed release/camera controls after Decline | Resolved by one canonical server resolver across release, dashboards, media session, stage save, and upload paths; no data rewrite required | Epic 1 | **Resolved in `97396da`** |
| Recovery actions unavailable after assignment | Active vendor card did not expose resend/correction despite route support | Wrong-recipient and failed-delivery recovery cannot be completed in normal UI | Expose authorized Resend and Correct recipient actions in valid assigned states | Epic 1 | **Beta blocker** |
| SMS handset delivery not validated     | Reserved fictional test number was used safely     | Provider acceptance is known, handset delivery is not | Repeat with a dedicated controlled beta handset and verify callbacks | Epic 1 / Epic 10 | Approval gate |
| Retry scheduler not configured         | Worker route exists but beta has no identified scheduler or worker secret | Retries/dead-letter progression may never run | Configure worker secret, scheduler, monitoring, and controlled failure test | Epic 1 / Epic 10 | **Beta blocker unless explicitly deferred** |
| Registration email uses internal Azure host | Public-base URL is not applied in the registration email path | First-time beta users receive an unusable verification link | Use the approved public beta origin and add template/link regression coverage | Epic 2 or approved maintenance | Open unrelated |
| Guardian/minor remains blocked         | Protected-participant scope is later               | Guardian declaration cannot unlock recording  | Implement approved protected-participant workflow                 | Later protected-participant epic | By design     |
| Full tests have 13 failures            | Stale copy and unrelated fixtures                  | Full-suite gate unavailable                   | Scoped maintenance triage                                         | Epic 12                          | Open          |
| Type check has one existing test error | Untyped unrelated test JSON                        | Type gate not green                           | Scoped maintenance fix                                            | Epic 12                          | Open          |
| 25 production dependency advisories    | Existing dependency set                            | Includes critical/high risk                   | Prioritize direct framework/ORM upgrades with regression plan     | Epic 12                          | Open          |
| Malformed `.gitignore`                 | Existing configuration                             | Search tooling reports errors                 | Repair and validate ignore behavior                               | Epic 12                          | Open          |

## Debt Accepted by Product Owner

None recorded.
