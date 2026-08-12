# RV-8 Azure SAS Settings Transport Correction Report

**Date:** 2026-08-12
**Repository:** `colivera01/Relianceupdate`
**Branch:** `codex/rv8-residence-location-correction`
**Starting commit:** `970cd10f34684dbf1299ff0324e0716e5011f19f`
**Scope:** Release tooling and release evidence only
**Deployment:** Not performed

## Result

The SAS settings-transport defect is corrected and covered by focused automated tests. The updater now supplies the three approved App Settings through Azure CLI's supported structured JSON `@file` input instead of individual `KEY=VALUE` arguments. A synthetic SAS-shaped URL containing `?`, multiple `&` parameters, `=`, `%`, and `+` survived the transport without modification.

No Azure resource, application source, database, migration, dependency, RV-9 gate, or Epic 8 work was changed during this checkpoint.

## Proven Root Cause

The preceding controlled deployment retry established that:

- the deterministic package and remote hash were valid;
- the dry run retrieved 53 settings and preserved unrelated values;
- the `KEY=VALUE` Azure CLI invocation truncated the SAS-bearing `WEBSITE_RUN_FROM_PACKAGE` value at its `&` separators;
- Azure stored an incomplete URL that returned 403;
- the run-from-package value was partially changed while the commit and package markers remained unchanged.

The package was not the cause. The defect was the unstructured settings transport in `scripts/release/update_azure_package_settings.py`.

The incident remains preserved in:

- `Project Management/Pre-Epic8 Release Validation/RV8_CONTROLLED_DEPLOYMENT_RETRY_INCIDENT_REPORT.md`
- `Project Management/Pre-Epic8 Release Validation/RELIANCE_PRE_EPIC8_RELEASE_VALIDATION_EXECUTION_LOG.md`

## Corrected Transport Method

`scripts/release/update_azure_package_settings.py` now:

1. Requires exactly the three approved values:
   - `WEBSITE_RUN_FROM_PACKAGE`
   - `DEPLOYED_COMMIT`
   - `DEPLOYED_PACKAGE`
2. Creates a short-lived secure temporary directory.
3. Restricts that directory to the current execution identity on Windows, or owner-only permissions on POSIX.
4. Writes a compact JSON object inside that directory.
5. invokes Azure CLI without a shell using `--settings @<temporary-json-path>`.
6. Deletes the JSON file immediately after the Azure operation, including failure paths.
7. Deletes the temporary directory and verifies that it no longer exists.
8. Rereads the complete Azure setting collection and fails closed unless the count, approved values, and every unrelated-setting fingerprint are preserved.

Azure CLI 2.87.0 locally documents `@{file}` as a supported input for `az webapp config appsettings set --settings`.

The complete package URL is never placed in the command-line argument list, command output, report, Git history, screenshots, or persistent temporary files.

## Files Changed

- `scripts/release/update_azure_package_settings.py`
  - Replaced unstructured `KEY=VALUE` transport with structured JSON-file transport.
  - Added temporary secret-file lifecycle controls.
  - Extracted post-update preservation verification for focused testing.
- `scripts/release/test_update_azure_package_settings.py`
  - Added focused transport, input, cleanup, dry-run, setting-count, and fingerprint tests.
- `Project Management/Pre-Epic8 Release Validation/RV8_AZURE_SAS_SETTINGS_TRANSPORT_CORRECTION_REPORT.md`
  - Records this checkpoint.
- `Project Management/Pre-Epic8 Release Validation/RV8_CONTROLLED_DEPLOYMENT_RETRY_INCIDENT_REPORT.md`
  - Preserves the deployment failure and rollback evidence generated before this correction.
- `Project Management/Pre-Epic8 Release Validation/RELIANCE_PRE_EPIC8_RELEASE_VALIDATION_EXECUTION_LOG.md`
  - Preserves the failed retry as a historical release event.

## Focused Automated Coverage

The tests prove:

- complete synthetic SAS-shaped URL preservation;
- multiple `&` query parameters;
- `?`, `=`, `%`, and `+` characters;
- URL absence from the Azure CLI argument list;
- Windows temporary-directory ACL inheritance removal;
- file and directory cleanup after success;
- file and directory cleanup after Azure CLI failure;
- rejection of incomplete approved updates;
- rejection of missing, masked, null, or empty Azure settings collections;
- failure on unexpected setting-count changes;
- failure on unrelated-setting fingerprint changes;
- success only for an exact scoped update;
- no mutation in dry-run mode.

## Commands And Results

```text
python -m py_compile scripts/release/update_azure_package_settings.py scripts/release/test_update_azure_package_settings.py
PASS

python -m unittest -v scripts.release.test_update_azure_package_settings
PASS - 8 tests

python scripts/release/build_azure_allowlist_package.py --help
PASS - package builder imports and argument parsing remain valid

git diff --check
PASS
```

## Preservation Guarantees

- All current settings are still retrieved through the secret-returning Azure management operation before mutation.
- Missing, masked, null, or malformed values still abort the operation.
- Only the three approved deployment settings can be transported.
- Every unrelated value remains fingerprinted before and after mutation.
- A setting-count change, unrelated-value change, or approved-value mismatch still aborts verification.
- The updater still refuses a destructive full-collection PUT from an incomplete local snapshot.
- Worker secrets and all other unrelated settings remain outside the approved change set.

## Remaining Limitations

- The correction was intentionally validated without touching beta. A live scoped apply remains subject to a separate Product Owner-approved controlled deployment.
- An App Settings update can trigger normal Azure restart/remount behavior; the existing deployment health gates remain mandatory.
- If Azure reports success but the post-update preservation check fails, the tool stops and requires the approved recovery procedure. It does not attempt an automatic destructive rollback.
- Temporary data exists in memory and in the restricted temporary JSON file only for the duration of the Azure CLI operation. Operating-system administrators necessarily retain host-level access.

## Deployment Safety Verdict

The corrected transport is ready for Product Owner approval of another controlled deployment attempt. That future attempt must still perform the full 53-setting dry run, scoped apply, immediate reread/fingerprint verification, package-reference validation, and deployment health gates before RV-8 resumes.

RV-8 remains paused. RV-9 and Epic 8 remain unstarted.
