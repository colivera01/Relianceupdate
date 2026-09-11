# Reliance legacy Prisma migration evidence

This directory preserves the 57 migration directories that were active at source commit `5b27df55e3e53409aa8b61979128d44d39541fba`.

The SQL files are historical evidence only. Prisma must never execute files below `docs/database/migration-history-legacy/**`. Active migrations live only in `prisma/migrations/**`.

The archive was created with Git index/object operations: each destination index entry was assigned the exact source Git blob object, the active-path entry was removed, and the archive working file was materialized from that destination index entry under the `-text` archive attribute. This avoids Windows `core.autocrlf=true` rewriting archived evidence.

Evidence inventory:

- `archive-manifest.json`: authoritative archive manifest proving the destination bytes and Git blobs for all 57 directories/61 SQL files.
- `archive-manifest.sha256`: archive manifest and aggregate destination-path/content hashes.
- `legacy-migration-manifest.json`: source-checkout/raw/normalized hash analysis, Git history, beta ledger rows, and classifications used to explain the historical drift.
- `legacy-migration-manifest.sha256`: hash of that source/ledger analysis.
- `evidence/beta-prisma-ledger.json`: complete 64-row read-only beta ledger export.
- `evidence/beta-structural-oracle.json`: full read-only beta SQL Server catalog snapshot.
- `evidence/beta-structural-fingerprint.json`: compact structural and custom-object fingerprint.
- `evidence/archive-git-blob-proof.json`: source/destination Git blob and SHA-256 proof.
- `evidence/reconstructed-applied-byte-evidence.json`: honest reconstruction evidence for the 27 line-ending-only cases.
- `reports/fresh-bootstrap-failure.md`: legacy-chain clean-bootstrap failure.
- `reports/zero-step-migrations.md`: applied-zero-step history.
- `reports/unrecovered-historical-bytes.md`: the one historical applied byte stream not recovered.

Do not edit archived SQL. Amend documentation only through a new reviewed change; any active schema correction requires a new forward migration.
