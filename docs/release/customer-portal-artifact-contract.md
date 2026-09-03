# Customer Portal Release Artifact Contract

Generated Prisma clients are schema-specific. A matching dependency lockfile,
commit marker, ZIP hash, or anonymous health endpoint is not functional proof.
Never reuse an extracted previous release, shared developer node_modules, or a
standalone dependency junction. Never overlay selected generated files on a donor.

## Candidate Production

From a clean approved source commit run:

```powershell
python scripts/release/build_isolated_azure_package.py --repo-root <repository> --commit <exact-sha> --build-root <new-empty-path> --output <candidate.zip>
```

The script uses a fresh detached checkout and the committed npm lockfile. It runs
`npm ci`, explicit `prisma generate --schema=prisma/schema.prisma`, current-client
validation, Next production build, standalone validation, allowlisted ZIP assembly,
clean extraction, and executable validation of the extracted runtime. It has no
Azure deployment or migration operation. Support contact is built with
`NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL=Relianceorg.support@gmail.com`. Database credentials
are not inherited; build-time DATABASE_URL is a non-operational localhost value.

On Windows, a second fresh `npm ci --ignore-scripts --os=linux --cpu=x64
--libc=glibc` installs the same committed lockfile into an isolated scratch tree.
Only Linux-native optional package directories are copied into the current build
tree, so Azure receives its locked Sharp/native dependencies as well as the native
build host dependencies. No Prisma package or generated file is sourced from that
scratch tree. This follows npm's explicit target-platform selection, not previous
release reuse. See [npm platform configuration](https://docs.npmjs.com/cli/using-npm/config/#os).

`prisma-artifact-manifest.json` records the source commit, schema and lock hashes,
CLI/client/engine versions, engine hashes, and the complete generated model/field
contract. It contains no database URL or secret. Current Prisma generation copies
schema text; comparison tolerates CRLF versus LF and exterior whitespace only.
Other differences fail closed rather than guessing semantic equivalence. The
build-generated and extracted generated schema hashes must be byte-identical.
The executable client's embedded schema must agree with that generated schema.

All model delegates are instantiated. Current Package 2/3 delegates and Review
fields are explicitly required. Native engine revision is loaded and checked
without a database connection; the Azure Linux engine must be present and its
hash preserved. Exact dependency paths must resolve inside the candidate root.

## Pre-Deployment Read-Only Check

Extract the candidate ZIP into a new directory. In the isolated source validation
checkout set `RELIANCE_ARTIFACT_READONLY_ROOT` to that extracted directory,
`RELIANCE_READONLY_CUSTOMER_ID` to the approved controlled customer's ID, and supply
the beta DATABASE_URL through the approved secret channel. Never commit credentials.

```powershell
npx vitest run --config=vitest.artifact.config.ts
```

This opt-in check loads the actual extracted Prisma client (not repository client),
including any transitive source imports through the artifact-only Vitest alias. It
checks database identity/migration state, queries organization events, Vendor
Favorites and corrected Review fields, and executes the current customer loader
including counts/search/detail. It fingerprints protected booking-bound evidence
before/after. No SQL substitutions, seed, API mutation, or data repair is allowed.
An intentional future schema/count baseline change requires separately reviewed
updates to this checkpoint, not relaxed assertions during a release.

## Future Authenticated Post-Deployment Smoke

Use the Product Owner's legitimate controlled customer session. Do not fabricate
cookies, bypass account checks, store credentials in source, or create fixtures on
shared beta. Capture request status and safe correlation references for failures.

- My Service Records: actual counts, initial tab, search, pagination, known record.
- Reviews: ready/submitted history loads; do not begin/submit a review.
- Favorites: collection/counts load; do not add/remove anything.
- Dashboard: all three summary requests succeed with authoritative values.
- Service Record detail: record and authorized media list load; do not request
  playback, change visibility, report, archive, cancel, or otherwise mutate evidence.

If a required endpoint fails or a required model is absent, stop acceptance and
classify the artifact as invalid. Do not treat empty-state UI or anonymous health
as a substitute. A missing delegate must never be hidden with optional chaining.
Release-time verification is primary; no per-request DMMF scan is added.
