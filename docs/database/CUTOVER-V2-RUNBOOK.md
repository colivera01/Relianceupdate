# Reliance Cutover V2 Runbook

This candidate is rooted at `9332627314ea6f8786625cc0891f58b9582736e5` and treats `reliance-beta-recovery-v2-c1fe9e5` as the canonical beta database. The incident database `reliance-beta-db` remains preserved and isolated.

V2 uses one runtime path in disposable and live environments: verify an immutable remote ZIP, update only `WEBSITE_RUN_FROM_PACKAGE`, `DEPLOYED_COMMIT`, and `DEPLOYED_PACKAGE` through structured settings input, restart, and verify the pointer, remote hash, health, and baked build identity. ZipDeploy, OneDeploy, and `az webapp deploy` are prohibited.

Before any database mutation, the candidate and recovery packages must be remotely readable, byte-sized, SHA-256 verified, and valid through the full cutover, acceptance, recovery, and buffer window. The durable external state must already be `FROZEN` under an exclusive lease. Application traffic is stopped/restricted while mutations occur and may run during acceptance only with read-only enforcement.

The original database lock protects original-database mutation only. During PITR, durable storage remains authoritative even if SQL sessions are lost. After the recovery database exists, verify its identity and acquire a lock there before connection switching. Only a receipt-bound explicit transition from `FROZEN` to `OPEN` may reopen normal traffic.

After database reconciliation, the controller records `GIT_PROMOTION_STARTED`, independently reads the authoritative remote, and conditionally fast-forwards the reviewed branch from the authorized starting SHA to the candidate. A pre-push expected-ref guard, Git's server-side old-object check, and an independent post-push remote read provide the compare-and-swap contract. A changed remote fails closed; no merge, rebase, reset, branch recreation, or force update is permitted.

Product Owner acceptance is a distinct 30-minute phase and cannot begin until the authoritative remote independently resolves to the candidate. ACCEPT produces the candidate-bound receipt, records `FINAL_TAGS_STARTED`, and creates only the reviewed lightweight tag `release/accepted/<candidate-sha>` at the exact candidate. An existing exact tag is idempotent; a mismatched tag fails closed and is never moved. REJECT or TIMEOUT creates no success tag and restores the verified database and package pointer. Git recovery distinguishes a candidate that was never promoted from a promoted candidate; only the latter is fast-forwarded to the reviewed direct-child rollback commit, followed by independent SHA and tree verification. Cleanup completes while still frozen; cleanup failure remains fail-closed for durable resume.

No instruction in this document authorizes a live cutover. A separate Product Owner authorization is required.
