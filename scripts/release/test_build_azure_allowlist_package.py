import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('package_builder', Path(__file__).with_name('build_azure_allowlist_package.py'))
builder = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = builder
spec.loader.exec_module(builder)


class PackageBoundaries(unittest.TestCase):
    def test_external_donor_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'current'
            donor = Path(directory) / 'historical'
            root.mkdir()
            donor.mkdir()
            with self.assertRaisesRegex(ValueError, 'reuse is prohibited'):
                builder.assert_current_tree(root, donor)

    def test_current_tree_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child = root / 'node_modules'
            child.mkdir()
            builder.assert_current_tree(root, child)

    def test_manifest_and_generated_schema_required_in_zip(self):
        self.assertIn('prisma-artifact-manifest.json', builder.REQUIRED_ARCHIVE_FILES)
        self.assertIn('node_modules/.prisma/client/schema.prisma', builder.REQUIRED_ARCHIVE_FILES)

    def test_archive_cannot_contain_secrets(self):
        with self.assertRaises(ValueError):
            builder.validate_archive_entry('.env.production')


if __name__ == '__main__':
    unittest.main()
