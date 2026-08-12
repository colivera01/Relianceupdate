#!/usr/bin/env python3
"""Safely prepare or apply the three Azure package deployment settings.

The script reads the complete setting collection from Azure's ``/list``
endpoint, changes only the approved keys, and compares all unrelated values in
memory. Secret values, package URLs, and fingerprints are never persisted.
Dry-run is the default; ``--apply`` is required to perform a write.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import secrets
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


API_VERSION = "2025-03-01"
APPROVED_KEYS = {"WEBSITE_RUN_FROM_PACKAGE", "DEPLOYED_COMMIT", "DEPLOYED_PACKAGE"}


def azure_cli() -> str:
    executable = shutil.which("az") or shutil.which("az.cmd")
    if not executable:
        raise RuntimeError("Azure CLI was not found on PATH")
    return executable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resource-group", required=True)
    parser.add_argument("--app", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--package", required=True)
    package_source = parser.add_mutually_exclusive_group(required=True)
    package_source.add_argument("--package-url-env")
    package_source.add_argument("--reuse-current-package-url", action="store_true")
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def az_json(*args: str) -> Any:
    result = subprocess.run(
        [azure_cli(), *args, "-o", "json"], check=True, text=True, capture_output=True
    )
    return json.loads(result.stdout)


def management_request(url: str, token: str, method: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Azure management request failed with HTTP {error.code}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Azure management request failed: {type(error.reason).__name__}") from None


def load_settings(list_url: str, token: str) -> dict[str, str]:
    response = management_request(list_url, token, "POST")
    properties = response.get("properties")
    if not isinstance(properties, dict) or not properties:
        raise RuntimeError("Azure returned an empty or invalid App Settings collection")
    settings: dict[str, str] = {}
    for name, value in properties.items():
        if not isinstance(name, str) or not isinstance(value, str):
            raise RuntimeError(f"App Setting {name!r} was unavailable or masked")
        if value and set(value) == {"*"}:
            raise RuntimeError(f"App Setting {name!r} was masked and cannot be safely preserved")
        settings[name] = value
    return settings


def collection_fingerprint(values: dict[str, str], key: bytes) -> str:
    payload = json.dumps(values, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def validate_package_url(value: str) -> None:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or not parsed.path.lower().endswith(".zip"):
        raise RuntimeError("The package URL must be an HTTPS URL ending in .zip")
    request = urllib.request.Request(value, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            length = int(response.headers.get("Content-Length", "0"))
            if response.status != 200 or length <= 0:
                raise RuntimeError("The package URL did not return a non-empty ZIP")
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Package availability check failed with HTTP {error.code}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Package availability check failed: {type(error.reason).__name__}") from None


def compare_preserved(before: dict[str, str], after: dict[str, str]) -> list[str]:
    names = (set(before) | set(after)) - APPROVED_KEYS
    return sorted(name for name in names if before.get(name) != after.get(name))


def main() -> int:
    args = parse_args()
    if args.reuse_current_package_url and args.apply:
        raise RuntimeError("--reuse-current-package-url is available only for preservation dry runs")

    account = az_json("account", "show")
    subscription = account.get("id")
    token_result = az_json("account", "get-access-token", "--resource", "https://management.azure.com/")
    token = token_result.get("accessToken")
    if not subscription or not token:
        raise RuntimeError("Unable to obtain the active Azure subscription and access token")

    base_url = (
        f"https://management.azure.com/subscriptions/{subscription}/resourceGroups/"
        f"{urllib.parse.quote(args.resource_group, safe='')}/providers/Microsoft.Web/sites/"
        f"{urllib.parse.quote(args.app, safe='')}/config/appsettings"
    )
    list_url = f"{base_url}/list?api-version={API_VERSION}"
    before = load_settings(list_url, token)

    if args.reuse_current_package_url:
        package_url = before.get("WEBSITE_RUN_FROM_PACKAGE", "")
    else:
        package_url = os.environ.get(args.package_url_env or "", "")
    if not package_url:
        raise RuntimeError("The package URL was not supplied through the approved source")
    validate_package_url(package_url)

    candidate = dict(before)
    candidate.update(
        {
            "WEBSITE_RUN_FROM_PACKAGE": package_url,
            "DEPLOYED_COMMIT": args.commit,
            "DEPLOYED_PACKAGE": args.package,
        }
    )
    unexpected = compare_preserved(before, candidate)
    if unexpected:
        raise RuntimeError(f"Preflight changed unapproved settings: {unexpected}")

    fingerprint_key = secrets.token_bytes(32)
    preserved_before = {name: value for name, value in before.items() if name not in APPROVED_KEYS}
    before_fingerprint = collection_fingerprint(preserved_before, fingerprint_key)
    if not args.apply:
        print(
            json.dumps(
                {
                    "mode": "dry-run",
                    "settingCount": len(before),
                    "approvedChanges": sorted(APPROVED_KEYS),
                    "unrelatedSettingsPreserved": True,
                    "preservationFingerprint": before_fingerprint,
                    "packageUrlAvailable": True,
                },
                indent=2,
            )
        )
        return 0

    # Invoke Azure CLI without a shell so the SAS query string remains one
    # argument. This command updates only the named settings rather than
    # replacing the collection from a partial local snapshot.
    subprocess.run(
        [
            azure_cli(),
            "webapp",
            "config",
            "appsettings",
            "set",
            "--resource-group",
            args.resource_group,
            "--name",
            args.app,
            "--settings",
            f"WEBSITE_RUN_FROM_PACKAGE={package_url}",
            f"DEPLOYED_COMMIT={args.commit}",
            f"DEPLOYED_PACKAGE={args.package}",
            "--output",
            "none",
        ],
        check=True,
        text=True,
        capture_output=True,
    )
    after = load_settings(list_url, token)
    preserved_after = {name: value for name, value in after.items() if name not in APPROVED_KEYS}
    after_fingerprint = collection_fingerprint(preserved_after, fingerprint_key)
    mismatches = compare_preserved(before, after)
    approved_match = all(after.get(name) == candidate[name] for name in APPROVED_KEYS)

    if len(after) != len(before) or mismatches or not approved_match or before_fingerprint != after_fingerprint:
        raise RuntimeError(
            "Post-update preservation verification failed. Stop before any explicit restart and use the active "
            "Azure revision/history for recovery; this tool will not perform a destructive full-collection PUT."
        )

    print(
        json.dumps(
            {
                "mode": "apply",
                "settingCountBefore": len(before),
                "settingCountAfter": len(after),
                "approvedChanges": sorted(APPROVED_KEYS),
                "unrelatedSettingsPreserved": True,
                "preservationFingerprintBefore": before_fingerprint,
                "preservationFingerprintAfter": after_fingerprint,
                "packageUrlAvailable": True,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"SETTINGS_UPDATE_ABORTED: {error}", file=sys.stderr)
        raise SystemExit(1)
