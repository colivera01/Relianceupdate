import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import urllib.error


MODULE_PATH = Path(__file__).with_name("build_isolated_azure_package.py")
SPEC = importlib.util.spec_from_file_location("build_isolated_azure_package", MODULE_PATH)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = builder
SPEC.loader.exec_module(builder)


ENGINE_COMMIT = "2ba551f319ab1df4bc874a89965d8b3641056773"
ENGINE_VERSION = f"6.19.0-26.{ENGINE_COMMIT}"


class FakeResponse(io.BytesIO):
    status = 200

    def __init__(self, body: bytes, url: str):
        super().__init__(body)
        self._url = url

    def geturl(self) -> str:
        return self._url


class FakeOpener:
    def __init__(self, responses: dict[str, bytes], transient_url: str | None = None):
        self.responses = responses
        self.transient_url = transient_url
        self.calls: list[str] = []
        self.user_agents: list[str | None] = []

    def __call__(self, request, *, timeout: int):
        url = request.full_url
        self.calls.append(url)
        self.user_agents.append(request.get_header("User-agent"))
        if self.transient_url == url:
            self.transient_url = None
            raise urllib.error.URLError("temporary reset")
        return FakeResponse(self.responses[url], url)


def write_lockfile(path: Path, *, declared_version: str = ENGINE_VERSION) -> None:
    path.write_text(
        json.dumps(
            {
                "packages": {
                    "node_modules/@prisma/engines": {
                        "dependencies": {
                            "@prisma/engines-version": declared_version,
                        }
                    },
                    "node_modules/@prisma/engines-version": {
                        "version": ENGINE_VERSION,
                    },
                }
            }
        ),
        encoding="utf-8",
    )


def official_responses(raw_engine: bytes) -> tuple[dict[str, bytes], str, str]:
    compressed = gzip.compress(raw_engine)
    remote_base = (
        f"{builder.PRISMA_ENGINE_ORIGIN}/all_commits/{ENGINE_COMMIT}/windows/"
        f"{builder.PRISMA_SCHEMA_ENGINE_REMOTE_NAME}"
    )
    raw_hash = hashlib.sha256(raw_engine).hexdigest()
    compressed_hash = hashlib.sha256(compressed).hexdigest()
    return (
        {
            remote_base + ".sha256": (
                f"{raw_hash}  ./windows/{builder.PRISMA_SCHEMA_ENGINE_REMOTE_NAME}\n"
            ).encode("ascii"),
            remote_base + ".gz.sha256": (
                f"{compressed_hash}  ./windows/{builder.PRISMA_SCHEMA_ENGINE_REMOTE_NAME}.gz\n"
            ).encode("ascii"),
            remote_base + ".gz": compressed,
        },
        remote_base,
        raw_hash,
    )


class IsolatedDependencyInstallContractTests(unittest.TestCase):
    def test_npm_ci_runs_lifecycle_scripts_in_the_foreground(self) -> None:
        self.assertEqual(builder.NPM_CI_ARGS[0], "ci")
        self.assertIn("--foreground-scripts", builder.NPM_CI_ARGS)
        self.assertIn("--no-audit", builder.NPM_CI_ARGS)
        self.assertIn("--no-fund", builder.NPM_CI_ARGS)

    def test_primary_install_does_not_skip_locked_package_scripts(self) -> None:
        self.assertNotIn("--ignore-scripts", builder.NPM_CI_ARGS)


class PrismaSchemaEngineBootstrapTests(unittest.TestCase):
    def test_locked_engine_commit_must_match_the_engines_dependency(self) -> None:
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            lockfile = Path(directory) / "package-lock.json"
            write_lockfile(lockfile, declared_version="6.19.0-26." + "a" * 40)
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                builder.locked_prisma_engine_commit(lockfile)

    def test_bootstrap_writes_one_verified_engine_in_prismas_exact_cache_shape(self) -> None:
        raw_engine = b"verified schema engine bytes"
        responses, remote_base, raw_hash = official_responses(raw_engine)
        opener = FakeOpener(responses, transient_url=remote_base + ".gz")
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            root = Path(directory)
            lockfile = root / "package-lock.json"
            cache_root = root / "fresh-cache"
            cache_root.mkdir()
            write_lockfile(lockfile)

            cached_engine = builder.bootstrap_windows_prisma_schema_engine(
                lockfile,
                cache_root,
                opener=opener,
                sleeper=lambda _: None,
            )

            expected_directory = (
                cache_root / "prisma" / "master" / ENGINE_COMMIT / "windows"
            )
            self.assertEqual(cached_engine, expected_directory / "schema-engine")
            self.assertEqual(cached_engine.read_bytes(), raw_engine)
            self.assertEqual(
                (expected_directory / "schema-engine.sha256").read_bytes(),
                raw_hash.encode("ascii"),
            )
            self.assertEqual(
                (expected_directory / "schema-engine.gz.sha256").read_bytes(),
                hashlib.sha256(responses[remote_base + ".gz"]).hexdigest().encode("ascii"),
            )
            self.assertNotIn(b"\n", (expected_directory / "schema-engine.sha256").read_bytes())
            self.assertFalse((expected_directory / "libquery-engine").exists())
            self.assertEqual(opener.calls.count(remote_base + ".gz"), 2)
            self.assertTrue(all(value == "Reliance-Release-Builder/1.0" for value in opener.user_agents))

    def test_bootstrap_rejects_a_raw_checksum_mismatch_without_a_usable_cache_entry(self) -> None:
        raw_engine = b"schema engine bytes"
        responses, remote_base, _ = official_responses(raw_engine)
        responses[remote_base + ".sha256"] = (
            ("0" * 64) + "  ./windows/schema-engine.exe\n"
        ).encode("ascii")
        opener = FakeOpener(responses)
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            root = Path(directory)
            lockfile = root / "package-lock.json"
            cache_root = root / "fresh-cache"
            cache_root.mkdir()
            write_lockfile(lockfile)

            with self.assertRaisesRegex(RuntimeError, "raw engine checksum"):
                builder.bootstrap_windows_prisma_schema_engine(
                    lockfile,
                    cache_root,
                    opener=opener,
                    sleeper=lambda _: None,
                )

            cache_directory = cache_root / "prisma" / "master" / ENGINE_COMMIT / "windows"
            self.assertFalse((cache_directory / "schema-engine").exists())
            self.assertFalse((cache_directory / "schema-engine.sha256").exists())

    def test_fresh_cache_is_removed_after_failure(self) -> None:
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            cache = Path(directory) / "one-use-cache"
            with self.assertRaisesRegex(RuntimeError, "install failed"):
                with builder.fresh_prisma_cache(cache):
                    (cache / "partial").write_text("temporary", encoding="utf-8")
                    raise RuntimeError("install failed")
            self.assertFalse(cache.exists())

    def test_redirect_away_from_official_origin_is_rejected(self) -> None:
        class RedirectedResponse(FakeResponse):
            def geturl(self) -> str:
                return "https://example.invalid/schema-engine.exe.sha256"

        def opener(request, *, timeout: int):
            return RedirectedResponse(b"0" * 64, request.full_url)

        official = (
            f"{builder.PRISMA_ENGINE_ORIGIN}/all_commits/{ENGINE_COMMIT}/windows/"
            "schema-engine.exe.sha256"
        )
        with self.assertRaisesRegex(RuntimeError, "official HTTPS origin"):
            builder._official_sha256(official, opener=opener, sleeper=lambda _: None)


if __name__ == "__main__":
    unittest.main()
