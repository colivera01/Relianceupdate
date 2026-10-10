#!/usr/bin/env python3
"""Fail-closed lifecycle guard for temporary Reliance Azure resources.

Temporary infrastructure must be declared in a run manifest, tagged to the
same run, and either cleaned up or explicitly retained with Product Owner
approval. Cleanup is deliberately limited to a small allowlist of billable
resource types and revalidates the live beta bindings before deleting.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence


SCHEMA_VERSION = 1
RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$")
ALLOWED_RESOURCE_TYPES = {
    "microsoft.sql/servers/databases",
    "microsoft.storage/storageaccounts",
    "microsoft.web/serverfarms",
    "microsoft.web/sites",
}
ALLOWED_TEMPORARY_ENVIRONMENTS = {"test", "rehearsal"}
REQUIRED_TAGS = {
    "project": "Reliance",
    "owner": "ProductOwner",
    "retention": "Temporary",
    "monthlycostclass": "Temporary",
}
DEFAULT_PROTECTED_NAMES = {
    "app-reliance-beta-wcus",
    "asp-reliance-beta-b1-wcus",
    "beta.relianceonline.org",
    "logic-reliance-beta-permission-notifications",
    "maps-reliance-beta-wcus",
    "reliance-beta-recovery-v2-1caa43e",
    "reliance-db",
    "relianceorgsqlserver",
    "reliancestorage01",
    "sql-reliance-beta-wcus",
    "strelcp30911a7",
    "streliancebetawcus",
}
RUNTIME_APPS = (("rg-reliance-beta-eastus", "app-reliance-beta-wcus"),)
DELETE_PRIORITY = {
    "microsoft.web/sites": 10,
    "microsoft.web/serverfarms": 20,
    "microsoft.sql/servers/databases": 30,
    "microsoft.storage/storageaccounts": 40,
}


class GuardError(ValueError):
    """Raised when a manifest or live resource fails a safety rule."""


@dataclass(frozen=True)
class ResourceSpec:
    resource_id: str
    purpose: str
    expected_monthly_cost_usd: float
    cleanup_condition: str
    expires_on: date

    @property
    def resource_type(self) -> str:
        return resource_type_from_id(self.resource_id)

    @property
    def name(self) -> str:
        return resource_name_from_id(self.resource_id)


@dataclass(frozen=True)
class Manifest:
    subscription_id: str
    run_id: str
    mode: str
    retention_reason: str | None
    product_owner_approval: str | None
    resources: tuple[ResourceSpec, ...]


Runner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "preflight", "cleanup"):
        item = subparsers.add_parser(command)
        item.add_argument("manifest", type=Path)
        if command == "cleanup":
            item.add_argument("--execute", action="store_true")
            item.add_argument("--confirm-run-id", required=True)
    run = subparsers.add_parser(
        "run", help="Run a creator command and enforce end-of-run cleanup"
    )
    run.add_argument("manifest", type=Path)
    run.add_argument("--confirm-run-id", required=True)
    run.add_argument("creator_command", nargs=argparse.REMAINDER)
    return parser.parse_args()


def normalize_resource_id(value: str) -> str:
    return value.strip().rstrip("/").lower()


def _resource_tail(resource_id: str) -> tuple[str, list[str]]:
    parts = [part for part in resource_id.strip().strip("/").split("/") if part]
    try:
        provider_index = next(
            index for index, part in enumerate(parts) if part.casefold() == "providers"
        )
    except StopIteration as error:
        raise GuardError(f"Resource ID has no provider namespace: {resource_id}") from error
    if provider_index + 3 >= len(parts):
        raise GuardError(f"Resource ID is incomplete: {resource_id}")
    namespace = parts[provider_index + 1]
    tail = parts[provider_index + 2 :]
    if len(tail) % 2:
        raise GuardError(f"Resource ID has an invalid type/name tail: {resource_id}")
    return namespace, tail


def resource_type_from_id(resource_id: str) -> str:
    namespace, tail = _resource_tail(resource_id)
    return "/".join((namespace, *tail[0::2])).casefold()


def resource_name_from_id(resource_id: str) -> str:
    _, tail = _resource_tail(resource_id)
    return tail[-1]


def parse_iso_date(value: Any, label: str) -> date:
    if not isinstance(value, str):
        raise GuardError(f"{label} must be an ISO date")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise GuardError(f"{label} must use YYYY-MM-DD") from error


def require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise GuardError(f"{label} is required")
    return value.strip()


def load_manifest(path: Path, today: date | None = None) -> Manifest:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise GuardError(f"Unable to read manifest {path}: {error}") from error
    return validate_manifest(payload, today=today)


def validate_manifest(payload: Mapping[str, Any], today: date | None = None) -> Manifest:
    today = today or date.today()
    if payload.get("schemaVersion") != SCHEMA_VERSION:
        raise GuardError(f"schemaVersion must be {SCHEMA_VERSION}")
    subscription_id = require_text(payload.get("subscriptionId"), "subscriptionId")
    run_id = require_text(payload.get("runId"), "runId")
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise GuardError("runId must be 3-64 URL-safe characters")

    completion = payload.get("completion")
    if not isinstance(completion, Mapping):
        raise GuardError("completion is required")
    mode = require_text(completion.get("mode"), "completion.mode").casefold()
    if mode not in {"cleanup", "retain"}:
        raise GuardError("completion.mode must be cleanup or retain")
    retention_reason = completion.get("retentionReason")
    product_owner_approval = completion.get("productOwnerApproval")
    if mode == "retain":
        retention_reason = require_text(retention_reason, "completion.retentionReason")
        product_owner_approval = require_text(
            product_owner_approval, "completion.productOwnerApproval"
        )

    raw_resources = payload.get("resources")
    if not isinstance(raw_resources, list) or not raw_resources:
        raise GuardError("resources must contain at least one item")
    resources: list[ResourceSpec] = []
    seen: set[str] = set()
    subscription_prefix = f"/subscriptions/{subscription_id}/".casefold()
    for index, raw in enumerate(raw_resources):
        label = f"resources[{index}]"
        if not isinstance(raw, Mapping):
            raise GuardError(f"{label} must be an object")
        resource_id = require_text(raw.get("id"), f"{label}.id")
        normalized_id = normalize_resource_id(resource_id)
        if not normalized_id.startswith(subscription_prefix):
            raise GuardError(f"{label}.id must belong to manifest subscriptionId")
        if normalized_id in seen:
            raise GuardError(f"Duplicate resource ID: {resource_id}")
        seen.add(normalized_id)
        resource_type = resource_type_from_id(resource_id)
        if resource_type not in ALLOWED_RESOURCE_TYPES:
            raise GuardError(f"Cleanup type is not allowed: {resource_type}")
        if raw.get("createdByRun") is not True:
            raise GuardError(f"{label}.createdByRun must be true")
        if str(raw.get("retention", "")).casefold() != "temporary":
            raise GuardError(f"{label}.retention must be Temporary")
        expected_cost = raw.get("expectedMonthlyCostUsd")
        if isinstance(expected_cost, bool) or not isinstance(expected_cost, (int, float)):
            raise GuardError(f"{label}.expectedMonthlyCostUsd must be numeric")
        if expected_cost < 0:
            raise GuardError(f"{label}.expectedMonthlyCostUsd cannot be negative")
        expires_on = parse_iso_date(raw.get("expiresOn"), f"{label}.expiresOn")
        if expires_on <= today:
            raise GuardError(f"{label}.expiresOn must be a future date")
        resources.append(
            ResourceSpec(
                resource_id=resource_id,
                purpose=require_text(raw.get("purpose"), f"{label}.purpose"),
                expected_monthly_cost_usd=float(expected_cost),
                cleanup_condition=require_text(
                    raw.get("cleanupCondition"), f"{label}.cleanupCondition"
                ),
                expires_on=expires_on,
            )
        )
    return Manifest(
        subscription_id=subscription_id,
        run_id=run_id,
        mode=mode,
        retention_reason=retention_reason,
        product_owner_approval=product_owner_approval,
        resources=tuple(resources),
    )


def tags_casefold(tags: Mapping[str, Any] | None) -> dict[str, str]:
    return {str(key).casefold(): str(value) for key, value in (tags or {}).items()}


def extract_runtime_protected_names(settings: Iterable[Mapping[str, Any]]) -> set[str]:
    values = {str(item.get("name")): str(item.get("value", "")) for item in settings}
    protected: set[str] = set()
    database_url = values.get("DATABASE_URL", "")
    database_match = re.search(
        r"(?i)(?:database|initial catalog)\s*=\s*([^;?]+)", database_url
    )
    if database_match:
        protected.add(database_match.group(1))
    package_url = values.get("WEBSITE_RUN_FROM_PACKAGE", "")
    storage_match = re.search(r"https://([^.]+)\.blob\.core\.windows\.net/", package_url)
    if storage_match:
        protected.add(storage_match.group(1))
    return protected


def validate_live_resource(
    manifest: Manifest,
    spec: ResourceSpec,
    live: Mapping[str, Any],
    dynamic_protected_names: Iterable[str] = (),
) -> None:
    live_id = require_text(live.get("id"), "live resource id")
    if normalize_resource_id(live_id) != normalize_resource_id(spec.resource_id):
        raise GuardError(f"Live resource ID mismatch for {spec.resource_id}")
    live_type = require_text(live.get("type"), "live resource type").casefold()
    if live_type != spec.resource_type:
        raise GuardError(f"Live resource type mismatch for {spec.resource_id}")
    protected_names = {name.casefold() for name in DEFAULT_PROTECTED_NAMES}
    protected_names.update(name.casefold() for name in dynamic_protected_names)
    if spec.name.casefold() in protected_names:
        raise GuardError(f"Protected Reliance resource cannot be cleaned up: {spec.name}")

    tags = tags_casefold(live.get("tags"))
    for key, expected in REQUIRED_TAGS.items():
        if tags.get(key, "").casefold() != expected.casefold():
            raise GuardError(f"{spec.name} must have {key}={expected}")
    if tags.get("environment", "").casefold() not in ALLOWED_TEMPORARY_ENVIRONMENTS:
        raise GuardError(f"{spec.name} must be tagged Environment=Test or Rehearsal")
    if tags.get("expireson") != spec.expires_on.isoformat():
        raise GuardError(f"{spec.name} ExpiresOn does not match its manifest")
    if tags.get("reliancerunid") != manifest.run_id:
        raise GuardError(f"{spec.name} RelianceRunId does not match its manifest")


def subprocess_runner(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=False, capture_output=True, text=True)


def run_az_json(arguments: Sequence[str], runner: Runner = subprocess_runner) -> Any:
    result = runner(("az", *arguments, "--output", "json"))
    if result.returncode:
        raise GuardError(result.stderr.strip() or f"Azure CLI failed: {' '.join(arguments)}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise GuardError("Azure CLI returned invalid JSON") from error


def runtime_protected_names(runner: Runner = subprocess_runner) -> set[str]:
    names: set[str] = set()
    for resource_group, app_name in RUNTIME_APPS:
        settings = run_az_json(
            (
                "webapp",
                "config",
                "appsettings",
                "list",
                "--resource-group",
                resource_group,
                "--name",
                app_name,
            ),
            runner,
        )
        names.update(extract_runtime_protected_names(settings))
    return names


def fetch_live_resource(resource_id: str, runner: Runner = subprocess_runner) -> Mapping[str, Any] | None:
    result = runner(("az", "resource", "show", "--ids", resource_id, "--output", "json"))
    if result.returncode:
        message = f"{result.stdout}\n{result.stderr}".casefold()
        if "could not be found" in message or "resourcenotfound" in message:
            return None
        raise GuardError(result.stderr.strip() or f"Unable to inspect {resource_id}")
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise GuardError(f"Azure CLI returned invalid JSON for {resource_id}") from error
    if not isinstance(value, Mapping):
        raise GuardError(f"Azure CLI returned an invalid resource for {resource_id}")
    return value


def preflight_manifest(
    manifest: Manifest, runner: Runner = subprocess_runner
) -> tuple[list[ResourceSpec], list[ResourceSpec]]:
    account = run_az_json(("account", "show"), runner)
    if str(account.get("id", "")).casefold() != manifest.subscription_id.casefold():
        raise GuardError("Azure CLI is not targeting the manifest subscription")
    protected_names = runtime_protected_names(runner)
    live_specs: list[ResourceSpec] = []
    absent_specs: list[ResourceSpec] = []
    for spec in manifest.resources:
        live = fetch_live_resource(spec.resource_id, runner)
        if live is None:
            absent_specs.append(spec)
            continue
        validate_live_resource(manifest, spec, live, protected_names)
        live_specs.append(spec)
    return live_specs, absent_specs


def cleanup_order(resources: Iterable[ResourceSpec]) -> list[ResourceSpec]:
    return sorted(
        resources,
        key=lambda item: (DELETE_PRIORITY[item.resource_type], normalize_resource_id(item.resource_id)),
    )


def delete_resources(resources: Iterable[ResourceSpec], runner: Runner = subprocess_runner) -> None:
    for spec in cleanup_order(resources):
        result = runner(("az", "resource", "delete", "--ids", spec.resource_id))
        if result.returncode:
            raise GuardError(result.stderr.strip() or f"Unable to delete {spec.resource_id}")
        if fetch_live_resource(spec.resource_id, runner) is not None:
            raise GuardError(f"Azure still reports resource after cleanup: {spec.resource_id}")


def run_guarded_command(
    manifest: Manifest,
    command: Sequence[str],
    command_runner: Runner = subprocess_runner,
    azure_runner: Runner = subprocess_runner,
) -> tuple[int, dict[str, Any]]:
    if not command:
        raise GuardError("run requires a creator command after --")
    command_result: subprocess.CompletedProcess[str] | None = None
    command_error: OSError | None = None
    try:
        command_result = command_runner(command)
    except OSError as error:
        command_error = error
    live, absent = preflight_manifest(manifest, azure_runner)
    if manifest.mode == "cleanup":
        delete_resources(live, azure_runner)
        absent = [*absent, *live]
        live = []
    if command_error is not None:
        raise GuardError(f"Unable to run creator command: {command_error}") from command_error
    assert command_result is not None
    summary = manifest_summary(manifest, live, absent)
    summary["creatorExitCode"] = command_result.returncode
    summary["cleanupVerified"] = manifest.mode == "cleanup"
    summary["retentionApproved"] = manifest.mode == "retain"
    return command_result.returncode, summary


def manifest_summary(
    manifest: Manifest,
    live: Iterable[ResourceSpec] | None = None,
    absent: Iterable[ResourceSpec] | None = None,
) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "runId": manifest.run_id,
        "completionMode": manifest.mode,
        "resourcesDeclared": len(manifest.resources),
        "resourcesLive": len(list(live or ())),
        "resourcesAlreadyAbsent": len(list(absent or ())),
        "expectedMonthlyCostUsd": round(
            sum(item.expected_monthly_cost_usd for item in manifest.resources), 2
        ),
    }


def main() -> int:
    args = parse_args()
    try:
        manifest = load_manifest(args.manifest)
        if args.command == "validate":
            print(json.dumps(manifest_summary(manifest), indent=2, sort_keys=True))
            return 0
        if args.command == "run":
            if args.confirm_run_id != manifest.run_id:
                raise GuardError("--confirm-run-id does not match the manifest")
            command = list(args.creator_command)
            if command[:1] == ["--"]:
                command = command[1:]
            exit_code, summary = run_guarded_command(manifest, command)
            print(json.dumps(summary, indent=2, sort_keys=True))
            return exit_code
        live, absent = preflight_manifest(manifest)
        if args.command == "preflight":
            print(json.dumps(manifest_summary(manifest, live, absent), indent=2, sort_keys=True))
            return 0
        if manifest.mode != "cleanup":
            raise GuardError("A retained run cannot use the cleanup command")
        if not args.execute:
            raise GuardError("cleanup requires --execute")
        if args.confirm_run_id != manifest.run_id:
            raise GuardError("--confirm-run-id does not match the manifest")
        delete_resources(live)
        summary = manifest_summary(manifest, (), (*absent, *live))
        summary["cleanupVerified"] = True
        print(json.dumps(summary, indent=2, sort_keys=True))
        return 0
    except GuardError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
