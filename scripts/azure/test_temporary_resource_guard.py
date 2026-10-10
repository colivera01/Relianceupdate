import importlib.util
import json
from datetime import date
from pathlib import Path
import subprocess
import sys
import unittest
from unittest import mock


spec = importlib.util.spec_from_file_location(
    "temporary_resource_guard", Path(__file__).with_name("temporary_resource_guard.py")
)
guard = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = guard
spec.loader.exec_module(guard)


SUBSCRIPTION = "00000000-0000-0000-0000-000000000000"
TEMP_ID = (
    f"/subscriptions/{SUBSCRIPTION}/resourceGroups/rg-reliance-rehearsal/"
    "providers/Microsoft.Sql/servers/sql-rehearsal/databases/reliance-run-db"
)


def manifest_payload(resource_id=TEMP_ID):
    return {
        "schemaVersion": 1,
        "subscriptionId": SUBSCRIPTION,
        "runId": "rehearsal-20261010",
        "completion": {"mode": "cleanup"},
        "resources": [
            {
                "id": resource_id,
                "purpose": "Disposable migration rehearsal",
                "expectedMonthlyCostUsd": 5.0,
                "createdByRun": True,
                "retention": "Temporary",
                "expiresOn": "2026-10-12",
                "cleanupCondition": "Delete after the rehearsal finishes",
            }
        ],
    }


def live_resource(resource_id=TEMP_ID, **tag_overrides):
    tags = {
        "Project": "Reliance",
        "Environment": "Rehearsal",
        "Owner": "ProductOwner",
        "Purpose": "Disposable migration rehearsal",
        "Retention": "Temporary",
        "ExpiresOn": "2026-10-12",
        "MonthlyCostClass": "Temporary",
        "RelianceRunId": "rehearsal-20261010",
    }
    tags.update(tag_overrides)
    return {
        "id": resource_id,
        "name": resource_id.rsplit("/", 1)[-1],
        "type": guard.resource_type_from_id(resource_id),
        "tags": tags,
    }


class ManifestValidationTests(unittest.TestCase):
    def validate(self, payload=None):
        return guard.validate_manifest(payload or manifest_payload(), today=date(2026, 10, 10))

    def test_valid_cleanup_manifest(self):
        result = self.validate()
        self.assertEqual(result.mode, "cleanup")
        self.assertEqual(result.resources[0].expected_monthly_cost_usd, 5.0)

    def test_expiration_must_be_real_and_future(self):
        payload = manifest_payload()
        payload["resources"][0]["expiresOn"] = "NONE"
        with self.assertRaisesRegex(guard.GuardError, "YYYY-MM-DD"):
            self.validate(payload)
        payload["resources"][0]["expiresOn"] = "2026-10-10"
        with self.assertRaisesRegex(guard.GuardError, "future date"):
            self.validate(payload)

    def test_cost_and_cleanup_reason_are_required(self):
        payload = manifest_payload()
        del payload["resources"][0]["expectedMonthlyCostUsd"]
        with self.assertRaisesRegex(guard.GuardError, "must be numeric"):
            self.validate(payload)
        payload = manifest_payload()
        payload["resources"][0]["cleanupCondition"] = ""
        with self.assertRaisesRegex(guard.GuardError, "cleanupCondition"):
            self.validate(payload)

    def test_retention_requires_reason_and_product_owner_approval(self):
        payload = manifest_payload()
        payload["completion"] = {"mode": "retain"}
        with self.assertRaisesRegex(guard.GuardError, "retentionReason"):
            self.validate(payload)
        payload["completion"] = {
            "mode": "retain",
            "retentionReason": "Needed for incident evidence",
            "productOwnerApproval": "github-issue-1-comment-123",
        }
        self.assertEqual(self.validate(payload).mode, "retain")

    def test_broad_or_unsupported_resource_type_is_rejected(self):
        resource_group = f"/subscriptions/{SUBSCRIPTION}/resourceGroups/rehearsal"
        with self.assertRaisesRegex(guard.GuardError, "no provider namespace"):
            self.validate(manifest_payload(resource_group))


class LiveSafetyTests(unittest.TestCase):
    def setUp(self):
        self.manifest = guard.validate_manifest(
            manifest_payload(), today=date(2026, 10, 10)
        )
        self.resource = self.manifest.resources[0]

    def test_matching_temporary_resource_passes(self):
        guard.validate_live_resource(self.manifest, self.resource, live_resource())

    def test_permanent_or_evidence_resource_is_blocked(self):
        for retention in ("Permanent", "Evidence"):
            with self.subTest(retention=retention):
                with self.assertRaisesRegex(guard.GuardError, "retention=Temporary"):
                    guard.validate_live_resource(
                        self.manifest,
                        self.resource,
                        live_resource(Retention=retention),
                    )

    def test_run_identity_must_match(self):
        with self.assertRaisesRegex(guard.GuardError, "RelianceRunId"):
            guard.validate_live_resource(
                self.manifest,
                self.resource,
                live_resource(RelianceRunId="another-run"),
            )

    def test_protected_authoritative_database_is_blocked(self):
        protected_id = TEMP_ID.rsplit("/", 1)[0] + "/reliance-beta-recovery-v2-1caa43e"
        manifest = guard.validate_manifest(
            manifest_payload(protected_id), today=date(2026, 10, 10)
        )
        with self.assertRaisesRegex(guard.GuardError, "Protected Reliance resource"):
            guard.validate_live_resource(
                manifest, manifest.resources[0], live_resource(protected_id)
            )

    def test_current_runtime_bindings_become_protected(self):
        names = guard.extract_runtime_protected_names(
            [
                {
                    "name": "DATABASE_URL",
                    "value": "sqlserver://server:1433;database=current-db;user=hidden",
                },
                {
                    "name": "WEBSITE_RUN_FROM_PACKAGE",
                    "value": "https://currentstore.blob.core.windows.net/runtime/app.zip?secret",
                },
            ]
        )
        self.assertEqual(names, {"current-db", "currentstore"})

    def test_dynamic_package_storage_is_blocked(self):
        storage_id = (
            f"/subscriptions/{SUBSCRIPTION}/resourceGroups/rg-reliance-rehearsal/"
            "providers/Microsoft.Storage/storageAccounts/currentstore"
        )
        manifest = guard.validate_manifest(
            manifest_payload(storage_id), today=date(2026, 10, 10)
        )
        with self.assertRaisesRegex(guard.GuardError, "Protected Reliance resource"):
            guard.validate_live_resource(
                manifest,
                manifest.resources[0],
                live_resource(storage_id),
                dynamic_protected_names={"currentstore"},
            )

    def test_deletion_order_keeps_plan_after_apps_and_storage_last(self):
        def spec_for(resource_id):
            payload = manifest_payload(resource_id)
            return guard.validate_manifest(payload, today=date(2026, 10, 10)).resources[0]

        app = spec_for(
            f"/subscriptions/{SUBSCRIPTION}/resourceGroups/rg/providers/Microsoft.Web/sites/temp-app"
        )
        plan = spec_for(
            f"/subscriptions/{SUBSCRIPTION}/resourceGroups/rg/providers/Microsoft.Web/serverfarms/temp-plan"
        )
        storage = spec_for(
            f"/subscriptions/{SUBSCRIPTION}/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/tempstore"
        )
        self.assertEqual(
            [item.resource_type for item in guard.cleanup_order((storage, plan, app))],
            [
                "microsoft.web/sites",
                "microsoft.web/serverfarms",
                "microsoft.storage/storageaccounts",
            ],
        )

    def test_guarded_run_cleans_up_even_when_creator_fails(self):
        command_result = subprocess.CompletedProcess(["creator"], 7, "", "")
        with (
            mock.patch.object(
                guard, "preflight_manifest", return_value=([self.resource], [])
            ),
            mock.patch.object(guard, "delete_resources") as delete,
        ):
            exit_code, summary = guard.run_guarded_command(
                self.manifest,
                ["creator"],
                command_runner=lambda _: command_result,
            )
        self.assertEqual(exit_code, 7)
        delete.assert_called_once()
        self.assertTrue(summary["cleanupVerified"])

    def test_guarded_retention_requires_approval_and_skips_cleanup(self):
        payload = manifest_payload()
        payload["completion"] = {
            "mode": "retain",
            "retentionReason": "Required for incident evidence",
            "productOwnerApproval": "github-issue-1-comment-123",
        }
        manifest = guard.validate_manifest(payload, today=date(2026, 10, 10))
        command_result = subprocess.CompletedProcess(["creator"], 0, "", "")
        with (
            mock.patch.object(
                guard, "preflight_manifest", return_value=([manifest.resources[0]], [])
            ),
            mock.patch.object(guard, "delete_resources") as delete,
        ):
            exit_code, summary = guard.run_guarded_command(
                manifest,
                ["creator"],
                command_runner=lambda _: command_result,
            )
        self.assertEqual(exit_code, 0)
        delete.assert_not_called()
        self.assertTrue(summary["retentionApproved"])


if __name__ == "__main__":
    unittest.main()
