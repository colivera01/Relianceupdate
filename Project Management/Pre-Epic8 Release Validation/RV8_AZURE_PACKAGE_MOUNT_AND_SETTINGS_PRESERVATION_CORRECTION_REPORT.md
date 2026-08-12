# RV-8 Azure Package Mount And Settings Preservation Correction Report

## Checkpoint

- **Objective:** Determine and correct the release-engineering defects exposed by the failed Azure deployment of commit `a82b15aff45a917ed4860184d0a2cc326ec86191`.
- **Repository:** `C:\Users\Cesar Olivera\Project Reliance-rv8-residence`
- **Branch:** `codex/rv8-residence-location-correction`
- **Starting commit:** `a82b15aff45a917ed4860184d0a2cc326ec86191`
- **Application behavior changed:** No.
- **Azure modified:** No.
- **Database or migrations modified:** No.
- **Deployment or remount performed:** No.
- **RV-9 / Epic 8:** Not begun.

## Executive Finding

Two separate release-engineering defects were confirmed.

1. The failed package was created with a literal `./` prefix on every ZIP entry and included 1,094 directory entries. Azure Run From Package mounts the archive contents as `wwwroot`; the failed archive therefore did not present `server.js` and `node_modules/next` as true root entries. This explains the observed `MODULE_NOT_FOUND: next`.
2. The deployment procedure used a full App Settings collection replacement path while settings could be returned with masked or unavailable values. Azure's App Settings update endpoint replaces the collection, so an incomplete snapshot can erase unrelated settings. This is a separate, confirmed preservation defect.

The later `VolumeMountFailure / BadRunFromPackageConfig` cannot be assigned to one exact trigger from the retained evidence. The package blob was accessible and had the same relevant headers as the known-good package. The unsafe App Settings/reference mutation path could produce a bad mount reference or destructive configuration change, but the precise Azure-side causal event was not preserved well enough to prove that conclusion.

## Package Forensics

### Compared artifacts

| Artifact | Commit | Bytes | SHA-256 | Entries |
| --- | --- | ---: | --- | ---: |
| Failed | `a82b15a` | 70,362,766 | `5ea9a734933110cf1f61b6d814d1fb0392c3fc9df8bee28cab20c79113d630d6` | 4,443 |
| Known-good rollback | `90a21ab` | 69,880,534 | `ed1b92571fbe2315dd09121e5821fae3a32b07d2ee8da4c1801252743658f2fd` | 3,349 |
| Corrected clean candidate | application source `a82b15a` | 69,957,605 | `0f1f5f8950de69a029675abe148ef6b98bbc46854938d84e31cd7033c676cc9e` | 3,349 |

### Structural comparison

| Property | Failed package | Known-good package | Corrected candidate |
| --- | --- | --- | --- |
| True root `server.js` | No | Yes | Yes |
| True root `node_modules/next/package.json` | No | Yes | Yes |
| Literal `./` entries | 4,443 | 0 | 0 |
| File entries | 3,349 | 3,349 | 3,349 |
| Directory entries | 1,094 | 0 | 0 |
| Root nesting | Literal `.` path component | Direct archive root | Direct archive root |
| Required standalone graph | Present under `./` | Present at root | Present at root |

The failed artifact was created by the retained release command:

```text
tar.exe -a -c -f <zip> -C <stage> .
```

That command encoded `.` into every ZIP entry. Normal Windows extraction silently normalizes these names, which explains why an ordinary extracted-ZIP test could pass even though Azure mounting failed.

Microsoft's Azure App Service guidance requires the application contents, not a containing/root directory, at the ZIP root. The corrected package builder enforces that contract explicitly.

References:

- Azure Run From Package: <https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package>
- Azure ZIP deployment structure: <https://learn.microsoft.com/en-us/azure/app-service/deploy-zip>

### Package URL and blob observations

The failed and known-good blobs were both:

- accessible through their approved private package references during inspection;
- non-empty ZIP objects;
- below the Azure 1 GB Run From Package limit;
- stored with `application/x-zip-compressed`;
- server encrypted and unlocked;
- not differentiated by a content-encoding, cache-control, or language header.

The retained evidence does not show a blob-header or package-size cause for the failure.

## Root Cause Classification

### `MODULE_NOT_FOUND: next`

**Proven root cause:** malformed ZIP root entries.

The package contained `./server.js` and `./node_modules/next/package.json`, but did not contain `server.js` or `node_modules/next/package.json` as direct root entries. The known-good artifact used direct root entries. The corrected builder produces direct root entries and the packaged server resolves `next` from its own runtime tree.

### `VolumeMountFailure / BadRunFromPackageConfig`

**Exact root cause:** unable to prove from retained evidence.

This occurred after the module-resolution incident. It is treated as a separate failure because:

- the earlier `MODULE_NOT_FOUND` proves Azure reached application startup from some mounted/extracted view;
- the blob remained accessible and structurally a ZIP;
- subsequent deployment handling mutated the package reference/settings path;
- the prior settings workflow could not guarantee full preservation.

The unsafe settings mechanism is corrected below, but this report does not rewrite uncertainty into a proven Azure diagnosis.

## Corrected Package Builder

Created:

- `scripts/release/build_azure_allowlist_package.py`

The builder:

- consumes only the Next.js standalone runtime and required static/public roots;
- writes `server.js`, `package.json`, `node_modules`, `.next`, and `public` directly at the ZIP root;
- excludes source, tests, scripts, caches, environment files, source maps, and repository metadata;
- emits files only, with no directory records;
- sorts entries and uses a commit-derived fixed timestamp;
- validates required runtime entries;
- rejects `./`, absolute, backslash, traversal, cache, and forbidden-root entries;
- refuses to build from a dirty Git worktree;
- emits package size, entry count, commit, and SHA-256 metadata.

It does not copy the full repository and does not broaden the approved allow-list.

## Azure-Like Isolated Startup

The corrected clean package was extracted outside every Git checkout and `NODE_PATH` was removed.

`require.resolve('next')` returned:

```text
<isolated-package>\node_modules\next\dist\server\next.js
```

The path was inside the extracted package. No parent `node_modules` fallback was available.

A Windows ACL then denied file/directory creation beneath the extracted application root while preserving read/execute access. Under:

- read-only application root;
- Azure-style package-root working directory;
- `NODE_ENV=production`;
- standalone `node server.js`;
- no `NODE_PATH`;

the application reached Ready and `/` returned HTTP 200. No missing-`next` error occurred.

Expected warnings for intentionally absent database, storage, email, SMS, and base-URL environment values were present in this isolated test; no secret values were loaded.

## App Settings Preservation Defect

### Confirmed flaw

The prior deployment path could:

1. read an App Settings collection through a response path that returned null/masked values;
2. reconstruct a partial local collection;
3. submit a full collection PUT.

Azure documents the App Settings update operation as replacing the collection. A partial or masked local snapshot therefore cannot safely preserve unrelated settings.

Reference:

- App Settings update operation: <https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/update-application-settings?view=rest-appservice-2026-03-15>

### Corrected mechanism

Created:

- `scripts/release/update_azure_package_settings.py`

The tool:

1. defaults to dry-run;
2. reads the complete current collection directly from Azure's secret-returning `/config/appsettings/list` operation;
3. aborts on an empty, null, non-string, or masked value;
4. validates the HTTPS ZIP reference before mutation;
5. permits changes to exactly:
   - `WEBSITE_RUN_FROM_PACKAGE`
   - `DEPLOYED_COMMIT`
   - `DEPLOYED_PACKAGE`
6. compares all unrelated settings in memory;
7. uses `az webapp config appsettings set` without a shell so only the named settings are changed and a SAS query string remains one argument;
8. rereads the complete collection and verifies count, approved values, and HMAC fingerprints of every unrelated setting;
9. never prints or persists setting values, package URLs, SAS values, or the temporary HMAC key;
10. refuses to perform an automatic destructive rollback or full-collection PUT.

Azure may restart an application as a consequence of changing App Settings. The safety guarantee is therefore: fail before mutation unless complete preservation can be proven, mutate only the approved keys, and verify immediately afterward. The tool does not issue an explicit restart.

### Worker and unrecoverable secrets

If Azure cannot return an existing value, the tool aborts. It does not overwrite the setting with a placeholder and does not attempt to infer it. A worker-secret rotation remains a separate, explicitly approved operation involving every dependent Azure resource; this deployment tool cannot perform it implicitly.

## Validation Results

| Gate | Result |
| --- | --- |
| Clean detached worktree | Passed |
| `npm ci` | Passed; 601 packages installed and Prisma Client generated |
| TypeScript | Passed |
| Production build | Passed; Next.js 15.5.21 compiled and generated 205 App Router pages plus the two legacy compatibility pages |
| Python syntax compilation | Passed |
| Deterministic package build | Passed; two independent packages had identical SHA-256 |
| Required package entries | Passed |
| Forbidden root / env / cache checks | Passed |
| Isolated `require('next')` | Passed; resolved only inside package |
| Read-only-root startup | Passed |
| Isolated homepage probe | HTTP 200 |
| App Settings dry run | Passed against beta; all 53 settings read, 3 approved keys selected, unrelated settings preserved |
| Azure write | Not performed |
| Beta deployment/remount | Not performed |

The first production-build command was terminated by its two-minute command limit. The complete rerun with the established six-gigabyte Node heap and full build window passed in 141.9 seconds. This was a harness timeout, not a compiler failure.

The clean install reported the repository's existing dependency audit result of 29 advisories (1 critical, 19 high, 7 moderate, 2 low). This checkpoint did not modify dependencies or classify those pre-existing advisories.

Evidence artifacts were kept outside Git at:

```text
C:\Users\Cesar Olivera\Documents\Codex\release-evidence\pre-epic8\rv8-package-forensics-a82b15a
```

No ZIP, log, environment file, setting value, SAS value, or secret is included in this commit.

## Files Changed

- `scripts/release/build_azure_allowlist_package.py`
- `scripts/release/update_azure_package_settings.py`
- `Project Management/Pre-Epic8 Release Validation/RV8_AZURE_PACKAGE_MOUNT_AND_SETTINGS_PRESERVATION_CORRECTION_REPORT.md`

No application, UI, API, database, migration, dependency, Azure resource, or frozen governing document changed.

## Remaining Uncertainty And Limitations

- The exact Azure-side trigger for the later `VolumeMountFailure / BadRunFromPackageConfig` is not recoverable from the retained evidence.
- The corrected settings tool was validated in dry-run only, as required. Its apply path has not been authorized or executed.
- The corrected package was not uploaded, mounted, or tested on beta.
- The tool requires an Azure identity that can read complete App Settings values and update only the approved settings.
- Run From Package references that use short-lived authorization must remain valid for cold starts and remounts; URL lifetime remains an operational release responsibility.
- The existing audit advisories are unchanged and outside this checkpoint.

## Deployment Safety Decision

Another controlled beta deployment is **safe to propose for Product Owner approval**, subject to all of the following:

1. build from a clean worktree with the corrected allow-list builder;
2. inspect and hash the resulting ZIP;
3. verify remote accessibility and matching hash;
4. run the settings tool in dry-run against the target immediately before mutation;
5. use only its scoped apply path for the three approved keys;
6. verify settings preservation before any separate restart action;
7. retain the currently healthy rollback package and its settings reference;
8. run the full bounded health and smoke gate after mounting.

This report does not authorize that deployment. RV-8 remains paused, RV-9 has not begun, and Epic 8 has not begun.
