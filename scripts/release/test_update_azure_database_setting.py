from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("update_azure_database_setting.py")
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("update_azure_database_setting", MODULE_PATH)
assert SPEC and SPEC.loader
database_tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(database_tool)


class DatabaseSettingTransportTests(unittest.TestCase):
    def test_dry_run_is_non_mutating_and_does_not_print_secret(self) -> None:
        secret = (
            "sqlserver://server.database.windows.net:1433;"
            "database=reliance-beta-recovery-v2-c1fe9e5;user=u;password=super-private-password;encrypt=true"
        )
        argv = [
            "update_azure_database_setting.py",
            "--resource-group", "rg",
            "--app", "app",
            "--database-url-env", "TEST_DATABASE_URL",
            "--expected-database", "reliance-beta-recovery-v2-c1fe9e5",
        ]
        output = io.StringIO()
        with mock.patch.object(sys, "argv", argv), mock.patch.dict(
            os.environ, {"TEST_DATABASE_URL": secret}, clear=False
        ), mock.patch.object(
            database_tool, "az_json", side_effect=[{"id": "subscription"}, {"accessToken": "token"}]
        ), mock.patch.object(
            database_tool, "load_settings", return_value={"DATABASE_URL": "old", "OTHER": "preserved"}
        ), mock.patch.object(database_tool, "apply_scoped_settings") as apply_mock, redirect_stdout(output):
            self.assertEqual(database_tool.main(), 0)
        apply_mock.assert_not_called()
        rendered = output.getvalue()
        self.assertNotIn("super-private-password", rendered)
        self.assertEqual(json.loads(rendered)["database"], "reliance-beta-recovery-v2-c1fe9e5")

    def test_unexpected_database_is_rejected_before_azure_access(self) -> None:
        argv = [
            "update_azure_database_setting.py",
            "--resource-group", "rg", "--app", "app",
            "--database-url-env", "TEST_DATABASE_URL",
            "--expected-database", "expected-recovery",
        ]
        with mock.patch.object(sys, "argv", argv), mock.patch.dict(
            os.environ, {"TEST_DATABASE_URL": "sqlserver://s;database=wrong;user=u;password=p"}, clear=False
        ), mock.patch.object(database_tool, "az_json") as az_mock:
            with self.assertRaisesRegex(RuntimeError, "unexpected database"):
                database_tool.main()
        az_mock.assert_not_called()

    def test_apply_uses_only_database_url_approved_key(self) -> None:
        secret = "sqlserver://s;database=recovery;user=u;password=p"
        argv = [
            "update_azure_database_setting.py",
            "--resource-group", "rg", "--app", "app",
            "--database-url-env", "TEST_DATABASE_URL",
            "--expected-database", "recovery", "--apply",
        ]
        before = {"DATABASE_URL": "old", "OTHER": "preserved"}
        after = {"DATABASE_URL": secret, "OTHER": "preserved"}
        output = io.StringIO()
        with mock.patch.object(sys, "argv", argv), mock.patch.dict(
            os.environ, {"TEST_DATABASE_URL": secret}, clear=False
        ), mock.patch.object(
            database_tool, "az_json", side_effect=[{"id": "subscription"}, {"accessToken": "token"}]
        ), mock.patch.object(
            database_tool, "load_settings", side_effect=[before, after]
        ), mock.patch.object(
            database_tool, "apply_scoped_settings"
        ) as apply_mock, redirect_stdout(output):
            self.assertEqual(database_tool.main(), 0)
        self.assertEqual(apply_mock.call_args.args[2], {"DATABASE_URL": secret})
        self.assertEqual(apply_mock.call_args.kwargs["approved_keys"], {"DATABASE_URL"})
        self.assertNotIn(secret, output.getvalue())


if __name__ == "__main__":
    unittest.main()
