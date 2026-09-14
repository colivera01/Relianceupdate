# Forward-baseline physical acceptance hold

Cutover authorization and physical acceptance are separate Product Owner acts. Authorization permits the exact reviewed technical cutover before any mutation. Physical acceptance occurs only after that cutover, deployment, health check, authenticated smoke checks, and protected-state verification have passed.

The orchestrator then writes an acceptance-state file and reports `WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE`, a cutover ID, a one-time challenge, and a 30-minute deadline. No acceptance decision or acceptance receipt exists before this point.

During the bounded hold:

- the environment-wide lock remains held and heartbeated;
- the database-specific DDL lock is released after all automated database verification;
- App Service remains restricted to the operator address;
- `RELIANCE_ACCEPTANCE_READ_ONLY=YES` blocks every request method except `GET`, `HEAD`, and `OPTIONS`;
- the authoritative Git SHA, local runtime artifact, database structure, active ledger, protected evidence, App Service controls, and health are revalidated while waiting.

The Product Owner may inspect only normal read-only Customer, Vendor, and Admin pages. No Bradley dashboard or new Work Order is required. No consent, publication, review, profile, assignment, moderation, or other business action is permitted.

To accept, use the cutover ID and challenge printed by the active orchestrator:

```text
node scripts/release/cutover_acceptance.cjs accept --state <state-file> --cutover-id <cutover-id> --challenge <challenge>
```

To reject:

```text
node scripts/release/cutover_acceptance.cjs reject --state <state-file> --cutover-id <cutover-id> --challenge <challenge>
```

The command contains no application password, database credential, bearer token, or consent evidence. It writes one exclusive decision file bound to the current cutover. The active orchestrator rechecks all invariants before accepting it.

An explicit `ACCEPT` creates the acceptance receipt and permits tagging and unfreeze. `REJECT`, timeout, or a failed invariant never creates an acceptance receipt or release tags. Reject and timeout reacquire the database lock and enter the predetermined rollback path while the environment remains controlled. Loss of the environment lock fails closed and does not reopen the application.

The acceptance timeout is 30 minutes: long enough for the narrow Customer, Vendor, Admin, and protected-package read checks, while avoiding an unattended half-cut-over environment. Silence is never acceptance.
