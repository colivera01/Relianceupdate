# Reliance Cutover V2 Runbook

This candidate is rooted at `9332627314ea6f8786625cc0891f58b9582736e5` and treats `reliance-beta-recovery-v2-c1fe9e5` as the canonical beta database. The incident database `reliance-beta-db` remains preserved and isolated.

V2 uses one runtime path in disposable and live environments: verify an immutable remote ZIP, update only `WEBSITE_RUN_FROM_PACKAGE`, `DEPLOYED_COMMIT`, and `DEPLOYED_PACKAGE` through structured settings input, restart, and verify the pointer, remote hash, health, and baked build identity. ZipDeploy, OneDeploy, and `az webapp deploy` are prohibited.

Before any database mutation, the candidate and recovery packages must be remotely readable, byte-sized, SHA-256 verified, and valid through the full cutover, acceptance, recovery, and buffer window. The durable external state must already be `FROZEN` under an exclusive lease. Application traffic is stopped/restricted while mutations occur and may run during acceptance only with read-only enforcement.

The original database lock protects original-database mutation only. During PITR, durable storage remains authoritative even if SQL sessions are lost. After the recovery database exists, verify its identity and acquire a lock there before connection switching. Only a receipt-bound explicit transition from `FROZEN` to `OPEN` may reopen normal traffic.

Product Owner acceptance is a distinct 30-minute phase. ACCEPT produces the candidate-bound receipt. REJECT or TIMEOUT restores the verified database and package pointer through forward-only Git recovery and idempotent runtime rollback. Cleanup completes while still frozen; cleanup failure remains fail-closed.

No instruction in this document authorizes a live cutover. A separate Product Owner authorization is required.
