#!/usr/bin/env python3
"""Build a deterministic Azure App Service Run From Package artifact.

The archive is assembled from explicit Next.js standalone runtime roots. Files
are written directly at the ZIP root; directory entries and ``./`` prefixes are
intentionally omitted because Azure mounts the archive itself as ``wwwroot``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Iterable


FIXED_ZIP_TIME = (2020, 1, 1, 0, 0, 0)
REQUIRED_ARCHIVE_FILES = (
    "server.js",
    "package.json",
    "node_modules/next/package.json",
    ".next/BUILD_ID",
    ".next/required-server-files.json",
)
FORBIDDEN_ROOTS = {
    ".git",
    ".github",
    ".vscode",
    "coverage",
    "docs",
    "e2e",
    "prisma",
    "scripts",
    "src",
    "test",
    "tests",
    "tmp",
}


@dataclass(frozen=True)
class PackageFile:
    source: Path
    archive_name: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata-output", type=Path)
    parser.add_argument("--commit")
    return parser.parse_args()


def git_value(repo_root: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", *args], cwd=repo_root, text=True, stderr=subprocess.DEVNULL
    ).strip()


def normalized_zip_time(repo_root: Path, commit: str) -> tuple[int, int, int, int, int, int]:
    try:
        epoch = int(git_value(repo_root, "show", "-s", "--format=%ct", commit))
        value = datetime.fromtimestamp(epoch, tz=timezone.utc)
        if value.year >= 1980:
            # ZIP timestamps have two-second precision.
            return (value.year, value.month, value.day, value.hour, value.minute, value.second // 2 * 2)
    except (OSError, ValueError, subprocess.CalledProcessError):
        pass
    return FIXED_ZIP_TIME


def archive_name(path: Path) -> str:
    value = PurePosixPath(*path.parts).as_posix()
    if value.startswith("./") or value.startswith("/") or "\\" in value:
        raise ValueError(f"Unsafe archive entry: {value}")
    if ".." in PurePosixPath(value).parts:
        raise ValueError(f"Archive traversal is not allowed: {value}")
    return value


def iter_tree(source_root: Path, target_root: Path) -> Iterable[PackageFile]:
    if not source_root.is_dir():
        raise FileNotFoundError(f"Required runtime directory is missing: {source_root}")
    for source in sorted(source_root.rglob("*"), key=lambda item: item.as_posix()):
        if not source.is_file() or source.suffix == ".map":
            continue
        relative = source.relative_to(source_root)
        yield PackageFile(source, archive_name(target_root / relative))


def collect_files(repo_root: Path) -> list[PackageFile]:
    standalone = repo_root / ".next" / "standalone"
    mappings: list[PackageFile] = []

    for filename in ("server.js", "package.json"):
        source = standalone / filename
        if not source.is_file():
            raise FileNotFoundError(f"Required standalone file is missing: {source}")
        mappings.append(PackageFile(source, filename))

    mappings.extend(iter_tree(standalone / "node_modules", Path("node_modules")))
    mappings.extend(iter_tree(standalone / ".next" / "server", Path(".next/server")))

    build_id = standalone / ".next" / "BUILD_ID"
    if not build_id.is_file():
        raise FileNotFoundError(f"Required standalone file is missing: {build_id}")
    mappings.append(PackageFile(build_id, ".next/BUILD_ID"))

    for source in sorted((standalone / ".next").glob("*.json")):
        mappings.append(PackageFile(source, archive_name(Path(".next") / source.name)))

    mappings.extend(iter_tree(repo_root / ".next" / "static", Path(".next/static")))
    mappings.extend(iter_tree(repo_root / "public", Path("public")))

    by_name: dict[str, PackageFile] = {}
    for item in mappings:
        if item.archive_name in by_name:
            raise ValueError(f"Duplicate archive entry: {item.archive_name}")
        validate_archive_entry(item.archive_name)
        by_name[item.archive_name] = item
    return [by_name[name] for name in sorted(by_name)]


def validate_archive_entry(name: str) -> None:
    parts = PurePosixPath(name).parts
    if not parts or parts[0] in FORBIDDEN_ROOTS:
        raise ValueError(f"Forbidden package root: {name}")
    if any(part == ".env" or part.startswith(".env.") for part in parts):
        raise ValueError(f"Environment file cannot be packaged: {name}")
    if ".next/cache" in name or "/__pycache__/" in f"/{name}/":
        raise ValueError(f"Cache content cannot be packaged: {name}")


def write_package(files: list[PackageFile], output: Path, zip_time: tuple[int, ...]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.unlink(missing_ok=True)
    try:
        with zipfile.ZipFile(
            temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True
        ) as archive:
            for item in files:
                info = zipfile.ZipInfo(item.archive_name, date_time=zip_time)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                with item.source.open("rb") as source, archive.open(info, "w", force_zip64=True) as target:
                    while chunk := source.read(1024 * 1024):
                        target.write(chunk)
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)


def inspect_package(output: Path) -> dict[str, object]:
    with zipfile.ZipFile(output) as archive:
        infos = archive.infolist()
        names = [item.filename for item in infos]
        if any(item.is_dir() for item in infos):
            raise ValueError("Directory entries are not allowed in the deployment ZIP")
        if any(name.startswith("./") or name.startswith("/") or "\\" in name for name in names):
            raise ValueError("Deployment ZIP contains a non-normalized root entry")
        if len(names) != len(set(names)):
            raise ValueError("Deployment ZIP contains duplicate entries")
        for name in names:
            validate_archive_entry(name)
        missing = sorted(set(REQUIRED_ARCHIVE_FILES) - set(names))
        if missing:
            raise ValueError(f"Deployment ZIP is missing required runtime files: {missing}")

    digest = hashlib.sha256()
    with output.open("rb") as package:
        while chunk := package.read(1024 * 1024):
            digest.update(chunk)
    return {
        "package": output.name,
        "bytes": output.stat().st_size,
        "sha256": digest.hexdigest(),
        "entries": len(names),
        "requiredEntries": list(REQUIRED_ARCHIVE_FILES),
        "rootEntriesNormalized": True,
        "directoryEntries": 0,
    }


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = args.output.resolve()
    commit = args.commit or git_value(repo_root, "rev-parse", "HEAD")
    if git_value(repo_root, "status", "--porcelain"):
        raise RuntimeError("Package builds require a clean Git worktree")

    files = collect_files(repo_root)
    write_package(files, output, normalized_zip_time(repo_root, commit))
    metadata = {"commit": commit, **inspect_package(output)}
    if args.metadata_output:
        metadata_output = args.metadata_output.resolve()
        metadata_output.parent.mkdir(parents=True, exist_ok=True)
        metadata_output.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # Release scripts must fail closed with one concise reason.
        print(f"PACKAGE_BUILD_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
