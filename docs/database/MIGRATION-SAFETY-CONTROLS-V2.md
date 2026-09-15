# Migration Safety Controls V2

The executable migration chain contains exactly two reviewed entries: the current-structure forward baseline and the active-device-assignment reconciliation. The 57-directory legacy chain is evidence-only under `docs/database/migration-history-legacy/2026-09-14-v2` and cannot enter a Prisma migration stage or migration artifact.

Raw file hashes, byte counts, aggregate hashes, Git blob identities, archive counts, target resource identity, and release-receipt bindings are independently verified. Malformed or mismatched SHA-256 values fail closed. Protected targets require explicit write authorization plus target verification and the exclusive migration lock. Disposable writes require both the disposable environment marker and a disposable database name.

Dangerous development commands (`migrate dev`, `migrate reset`, and `db push`) are blocked for protected targets. SQL helpers execute only allowlisted V2 scripts. The ledger rotation preserves the original 64-row/57-name history under a dated legacy table; it does not falsify or rewrite recorded history.

The current canonical beta database is `reliance-beta-recovery-a8ae548`. The original `reliance-beta-db` is incident evidence and is not a V2 target.
