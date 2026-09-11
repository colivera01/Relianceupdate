# Corrected checksum accounting

At protected commit `5b27df55e3e53409aa8b61979128d44d39541fba`:

- `RAW EXACT MATCH`: 29
- `LINE-ENDING-ONLY MISMATCH`: 27
- `UNRECOVERED HISTORICAL BYTES`: 1
- Raw mismatches: 28

The earlier count of 30 consisted of the 27 line-ending-only migrations, the unrecovered migration, and two zero-step active-assignment migrations incorrectly carried in the mismatch population. Those two have exact raw source/ledger checksum equality and are now classified as raw matches. Their zero-step/broken behavior remains separately documented.

The authoritative per-migration classification and hashes are in `legacy-migration-manifest.json`.

