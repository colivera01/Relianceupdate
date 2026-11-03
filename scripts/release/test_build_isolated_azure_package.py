import importlib.util
from pathlib import Path
import sys
import unittest


MODULE_PATH = Path(__file__).with_name("build_isolated_azure_package.py")
SPEC = importlib.util.spec_from_file_location("build_isolated_azure_package", MODULE_PATH)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = builder
SPEC.loader.exec_module(builder)


class IsolatedDependencyInstallContractTests(unittest.TestCase):
    def test_npm_ci_runs_lifecycle_scripts_in_the_foreground(self) -> None:
        self.assertEqual(builder.NPM_CI_ARGS[0], "ci")
        self.assertIn("--foreground-scripts", builder.NPM_CI_ARGS)
        self.assertIn("--no-audit", builder.NPM_CI_ARGS)
        self.assertIn("--no-fund", builder.NPM_CI_ARGS)

    def test_primary_install_does_not_skip_locked_package_scripts(self) -> None:
        self.assertNotIn("--ignore-scripts", builder.NPM_CI_ARGS)


if __name__ == "__main__":
    unittest.main()
