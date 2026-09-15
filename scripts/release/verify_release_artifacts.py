#!/usr/bin/env python3
"""Verify separation between runtime and migration release artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile


FORBIDDEN_RUNTIME_ROOTS = {"docs", "prisma", "scripts", "src", "tests", ".git", ".github"}
EXPECTED_ACTIVE = {
    "prisma/migrations/00000000000000_reliance_forward_baseline_20260914_v2/migration.sql",
    "prisma/migrations/20260914030000_enforce_one_active_device_assignment_v2/migration.sql",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime-zip", type=Path, required=True)
    parser.add_argument("--migration-artifact", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    with zipfile.ZipFile(args.runtime_zip) as archive:
        runtime_names = sorted(item.filename for item in archive.infolist() if not item.is_dir())
    runtime_violations = [name for name in runtime_names if PurePosixPath(name).parts[0] in FORBIDDEN_RUNTIME_ROOTS]

    migration = json.loads(args.migration_artifact.read_text(encoding="utf-8"))
    migration_names = {entry["path"] for entry in migration["files"]}
    migration_active = {name for name in migration_names if name.startswith("prisma/migrations/") and name.endswith("/migration.sql")}
    archived_in_migration = sorted(name for name in migration_names if name.startswith("docs/database/migration-history-legacy/"))
    unmanifested = sorted(migration_active ^ EXPECTED_ACTIVE)
    result = {
        "verdict": "PASS" if not runtime_violations and not archived_in_migration and not unmanifested else "FAIL",
        "runtimeArtifactSha256": digest(args.runtime_zip),
        "runtimeEntryCount": len(runtime_names),
        "runtimeForbiddenEntries": runtime_violations,
        "runtimeContainsArchivedSql": any("migration-history-legacy" in name for name in runtime_names),
        "migrationArtifactSha256": digest(args.migration_artifact),
        "migrationActiveFiles": sorted(migration_active),
        "migrationArchivedFiles": archived_in_migration,
        "unmanifestedMigrations": unmanifested,
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if result["verdict"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
