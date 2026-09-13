# SHA-256 release-control classification

The cutover system uses one strict canonical format for authorization and integrity SHA-256 values: exactly 64 lowercase hexadecimal characters, without whitespace or a prefix. The shared validator runs before comparison and before write-capable cutover phases.

## SHA-256 CONTROL — VALIDATE

- Target specification canonical digest, structural fingerprints, ledger fingerprints, and reference fingerprints.
- Release-receipt schema, structural-contract, lockfile, generated-client, build, artifact, migration-artifact, protected-test, Linux-validation, target-specification, active-migration aggregate, and legacy-archive hashes.
- Active migration entry digests, active aggregate digest, legacy archive manifest digest, and archived raw SQL digests.
- Migration-stage manifest, schema, migration-entry, and aggregate digests.
- Reviewed database evidence structural, ledger, application-row, material-data, and protected-data fingerprints when used by preflight or rollback integrity checks.
- Product Owner authorization receipt digest and authorization-file digest.
- Prisma artifact schema, lockfile, engine, and generated-code digests when a reviewed manifest supplies the expected value.

## NOT SHA-256 — DIFFERENT VALIDATION

- Git commit and Git blob object IDs (40 hexadecimal characters in the current repository contract).
- Database/resource IDs, migration names, environment names, version numbers, row counts, timestamps, and authorization nonces.
- Product-domain hashes not supplied to the release-control validator, such as request or consent evidence fields governed by application contracts.

## OPTIONAL / NOT USED FOR AUTHORIZATION

- Machine-generated informational digests that are emitted and consumed only as observations are validated when they enter a comparison or reviewed manifest.
- Missing optional hashes are not synthesized or trusted. If a workflow requires an expected hash, that workflow must require the field explicitly.

## Transcription prevention

`generate_target_spec_from_evidence.cjs` imports structural and ledger values and counts from a previously captured, reviewed evidence file, binds that evidence to the expected server/database, validates every imported SHA-256 value, and deterministically regenerates the target-specification digest. It never queries or auto-trusts the live cutover target.
