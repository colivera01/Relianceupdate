from __future__ import annotations

import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("update_azure_package_settings.py")
SPEC = importlib.util.spec_from_file_location("update_azure_package_settings", MODULE_PATH)
assert SPEC and SPEC.loader
settings_tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(settings_tool)


class StructuredSettingsTransportTests(unittest.TestCase):
    def approved_updates(self) -> dict[str, str]:
        return {
            "WEBSITE_RUN_FROM_PACKAGE": (
                "https://storage.example/deployments/app.zip?se=2031-08-12T23%3A59Z"
                "&sp=r&spr=https&sv=2026-04-06&sr=b&sig=A%2BB%3D%3Fvalue%3Dx"
            ),
            "DEPLOYED_COMMIT": "abc123",
            "DEPLOYED_PACKAGE": "app.zip",
        }

    def test_complete_sas_shaped_url_survives_structured_transport(self) -> None:
        updates = self.approved_updates()
        observed_path: str | None = None
        observed_command: list[str] | None = None

        def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
            nonlocal observed_path, observed_command
            observed_command = command
            reference = command[command.index("--settings") + 1]
            self.assertTrue(reference.startswith("@"))
            observed_path = reference[1:]
            if os.name == "nt":
                acl = subprocess.run(
                    ["icacls", str(Path(observed_path).parent)],
                    check=True,
                    text=True,
                    capture_output=True,
                ).stdout
                self.assertNotIn("(I)", acl)
            self.assertEqual(json.loads(Path(observed_path).read_text(encoding="utf-8")), updates)
            self.assertNotIn(updates["WEBSITE_RUN_FROM_PACKAGE"], command)
            return subprocess.CompletedProcess(command, 0, "", "")

        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            settings_tool, "azure_cli", return_value="az"
        ):
            settings_tool.apply_scoped_settings(
                "resource-group", "app", updates, runner=runner, temporary_directory=directory
            )

        self.assertIsNotNone(observed_command)
        self.assertIsNotNone(observed_path)
        self.assertFalse(os.path.exists(observed_path or ""))
        self.assertFalse(os.path.exists(str(Path(observed_path or "").parent)))

    def test_temporary_file_is_removed_when_azure_cli_fails(self) -> None:
        observed_path: str | None = None

        def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
            nonlocal observed_path
            observed_path = command[command.index("--settings") + 1][1:]
            raise subprocess.CalledProcessError(1, command)

        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            settings_tool, "azure_cli", return_value="az"
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                settings_tool.apply_scoped_settings(
                    "resource-group",
                    "app",
                    self.approved_updates(),
                    runner=runner,
                    temporary_directory=directory,
                )

        self.assertIsNotNone(observed_path)
        self.assertFalse(os.path.exists(observed_path or ""))
        self.assertFalse(os.path.exists(str(Path(observed_path or "").parent)))

    def test_missing_approved_setting_is_rejected_before_transport(self) -> None:
        updates = self.approved_updates()
        updates.pop("DEPLOYED_PACKAGE")
        runner = mock.Mock()
        with self.assertRaisesRegex(RuntimeError, "exactly the three approved"):
            settings_tool.apply_scoped_settings("resource-group", "app", updates, runner=runner)
        runner.assert_not_called()


class PreservationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.before = {
            "WEBSITE_RUN_FROM_PACKAGE": "old-url",
            "DEPLOYED_COMMIT": "old-commit",
            "DEPLOYED_PACKAGE": "old.zip",
            "DATABASE_URL": "unchanged-secret",
        }
        self.candidate = {
            **self.before,
            "WEBSITE_RUN_FROM_PACKAGE": "new-url",
            "DEPLOYED_COMMIT": "new-commit",
            "DEPLOYED_PACKAGE": "new.zip",
        }

    def test_unexpected_setting_count_fails_closed(self) -> None:
        after = dict(self.candidate)
        after["UNEXPECTED"] = "value"
        with self.assertRaisesRegex(RuntimeError, "preservation verification failed"):
            settings_tool.verify_post_update(self.before, after, self.candidate, b"fingerprint-key")

    def test_unrelated_setting_fingerprint_mismatch_fails_closed(self) -> None:
        after = dict(self.candidate)
        after["DATABASE_URL"] = "changed-secret"
        with self.assertRaisesRegex(RuntimeError, "preservation verification failed"):
            settings_tool.verify_post_update(self.before, after, self.candidate, b"fingerprint-key")

    def test_exact_scoped_update_passes_preservation_verification(self) -> None:
        before_fingerprint, after_fingerprint = settings_tool.verify_post_update(
            self.before, self.candidate, self.candidate, b"fingerprint-key"
        )
        self.assertEqual(before_fingerprint, after_fingerprint)


class InputAndDryRunTests(unittest.TestCase):
    def test_missing_or_masked_values_are_rejected(self) -> None:
        for properties in (
            {"A": None},
            {"A": "********"},
            {},
        ):
            with self.subTest(properties=properties), mock.patch.object(
                settings_tool, "management_request", return_value={"properties": properties}
            ):
                with self.assertRaises(RuntimeError):
                    settings_tool.load_settings("https://management.example/list", "token")

    def test_dry_run_performs_no_mutation(self) -> None:
        before = {
            "WEBSITE_RUN_FROM_PACKAGE": "https://storage.example/old.zip?sig=old",
            "DEPLOYED_COMMIT": "old",
            "DEPLOYED_PACKAGE": "old.zip",
            "OTHER": "preserved",
        }
        test_url = "https://storage.example/new.zip?sp=r&sig=A%2BB%3D"
        argv = [
            "update_azure_package_settings.py",
            "--resource-group",
            "resource-group",
            "--app",
            "app",
            "--commit",
            "new",
            "--package",
            "new.zip",
            "--package-url-env",
            "TEST_PACKAGE_URL",
        ]
        output = io.StringIO()
        with mock.patch.object(sys, "argv", argv), mock.patch.dict(
            os.environ, {"TEST_PACKAGE_URL": test_url}, clear=False
        ), mock.patch.object(
            settings_tool,
            "az_json",
            side_effect=[{"id": "subscription"}, {"accessToken": "token"}],
        ), mock.patch.object(
            settings_tool, "load_settings", return_value=before
        ), mock.patch.object(
            settings_tool, "validate_package_url"
        ), mock.patch.object(
            settings_tool, "apply_scoped_settings"
        ) as apply_mock, redirect_stdout(output):
            self.assertEqual(settings_tool.main(), 0)

        apply_mock.assert_not_called()
        result = json.loads(output.getvalue())
        self.assertEqual(result["mode"], "dry-run")
        self.assertTrue(result["unrelatedSettingsPreserved"])


if __name__ == "__main__":
    unittest.main()
