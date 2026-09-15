#!/usr/bin/env python3
"""Safely update only DATABASE_URL through the shared structured settings transport."""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets

from update_azure_package_settings import (
    apply_scoped_settings,
    az_json,
    collection_fingerprint,
    load_settings,
    verify_post_update,
)

API_VERSION = "2025-03-01"
APPROVED_KEYS = {"DATABASE_URL"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resource-group", required=True)
    parser.add_argument("--app", required=True)
    parser.add_argument("--database-url-env", required=True)
    parser.add_argument("--expected-database", required=True)
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    database_url = os.environ.get(args.database_url_env, "")
    if not database_url:
        raise RuntimeError("Recovery database URL was not supplied through the approved environment source")
    match = re.search(r"(?i)(?:^|;)database=([^;]+)", database_url)
    if not match or match.group(1).lower() != args.expected_database.lower():
        raise RuntimeError("Recovery database URL names an unexpected database")

    account = az_json("account", "show")
    token_result = az_json("account", "get-access-token", "--resource", "https://management.azure.com/")
    subscription = account.get("id")
    token = token_result.get("accessToken")
    if not subscription or not token:
        raise RuntimeError("Unable to obtain Azure management identity")
    base_url = (
        f"https://management.azure.com/subscriptions/{subscription}/resourceGroups/"
        f"{args.resource_group}/providers/Microsoft.Web/sites/{args.app}/config/appsettings"
    )
    list_url = f"{base_url}/list?api-version={API_VERSION}"
    before = load_settings(list_url, token)
    candidate = dict(before)
    candidate["DATABASE_URL"] = database_url
    key = secrets.token_bytes(32)
    preserved = {name: value for name, value in before.items() if name not in APPROVED_KEYS}
    fingerprint = collection_fingerprint(preserved, key)
    if not args.apply:
        print(json.dumps({
            "mode": "dry-run",
            "database": args.expected_database,
            "approvedChanges": ["DATABASE_URL"],
            "unrelatedSettingsPreserved": True,
            "preservationFingerprint": fingerprint,
            "secretPrinted": False,
        }, indent=2))
        return 0

    apply_scoped_settings(
        args.resource_group,
        args.app,
        {"DATABASE_URL": database_url},
        approved_keys=APPROVED_KEYS,
    )
    after = load_settings(list_url, token)
    before_hash, after_hash = verify_post_update(
        before,
        after,
        candidate,
        key,
        approved_keys=APPROVED_KEYS,
    )
    print(json.dumps({
        "mode": "apply",
        "database": args.expected_database,
        "approvedChanges": ["DATABASE_URL"],
        "unrelatedSettingsPreserved": True,
        "preservationFingerprintBefore": before_hash,
        "preservationFingerprintAfter": after_hash,
        "secretPrinted": False,
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"DATABASE_SETTING_UPDATE_ABORTED: {error}", file=__import__("sys").stderr)
        raise SystemExit(1)
