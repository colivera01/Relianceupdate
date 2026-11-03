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


def write_schema(
    path: Path,
    *,
    targets: tuple[str, ...] = builder.PRISMA_GENERATOR_BINARY_TARGETS,
    engine_type: str = "library",
) -> None:
    rendered_targets = ", ".join(f'"{target}"' for target in targets)
    path.write_text(
        "generator client {\n"
        '  provider = "prisma-client-js"\n'
        f"  binaryTargets = [{rendered_targets}]\n"
        f'  engineType = "{engine_type}"\n'
        "}\n",
        encoding="utf-8",
    )


def official_responses() -> tuple[dict[str, bytes], dict[tuple[str, str], bytes], dict[tuple[str, str], str]]:
    responses: dict[str, bytes] = {}
    raw_engines: dict[tuple[str, str], bytes] = {}
    remote_bases: dict[tuple[str, str], str] = {}
    for index, artifact in enumerate(builder.PRISMA_REQUIRED_ENGINE_ARTIFACTS, start=1):
        key = (artifact.binary_target, artifact.cache_name)
        raw_engine = f"verified engine {index}: {artifact.binary_target}/{artifact.cache_name}".encode()
        compressed = gzip.compress(raw_engine)
        remote_base = (
            f"{builder.PRISMA_ENGINE_ORIGIN}/all_commits/{ENGINE_COMMIT}/"
            f"{artifact.binary_target}/{artifact.remote_name}"
        )
        raw_hash = hashlib.sha256(raw_engine).hexdigest()
        compressed_hash = hashlib.sha256(compressed).hexdigest()
        responses[remote_base + ".sha256"] = (
            f"{raw_hash}  ./{artifact.binary_target}/{artifact.remote_name}\n"
        ).encode("ascii")
        responses[remote_base + ".gz.sha256"] = (
            f"{compressed_hash}  ./{artifact.binary_target}/{artifact.remote_name}.gz\n"
        ).encode("ascii")
        responses[remote_base + ".gz"] = compressed
        raw_engines[key] = raw_engine
        remote_bases[key] = remote_base
    return responses, raw_engines, remote_bases


class IsolatedDependencyInstallContractTests(unittest.TestCase):
    def test_npm_ci_runs_lifecycle_scripts_in_the_foreground(self) -> None:
        self.assertEqual(builder.NPM_CI_ARGS[0], "ci")
        self.assertIn("--foreground-scripts", builder.NPM_CI_ARGS)
        self.assertIn("--no-audit", builder.NPM_CI_ARGS)
        self.assertIn("--no-fund", builder.NPM_CI_ARGS)

    def test_primary_install_does_not_skip_locked_package_scripts(self) -> None:
        self.assertNotIn("--ignore-scripts", builder.NPM_CI_ARGS)


class PrismaEngineBootstrapTests(unittest.TestCase):
    def test_required_artifact_contract_matches_windows_and_azure_targets(self) -> None:
        self.assertEqual(
            tuple(
                (artifact.binary_target, artifact.remote_name, artifact.cache_name)
                for artifact in builder.PRISMA_REQUIRED_ENGINE_ARTIFACTS
            ),
            (
                ("windows", "schema-engine.exe", "schema-engine"),
                ("windows", "query_engine.dll.node", "libquery-engine"),
                (
                    "debian-openssl-3.0.x",
                    "libquery_engine.so.node",
                    "libquery-engine",
                ),
            ),
        )

    def test_locked_engine_commit_must_match_the_engines_dependency(self) -> None:
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            lockfile = Path(directory) / "package-lock.json"
            write_lockfile(lockfile, declared_version="6.19.0-26." + "a" * 40)
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                builder.locked_prisma_engine_commit(lockfile)

    def test_bootstrap_writes_all_required_engines_in_prismas_exact_cache_shape(self) -> None:
        responses, raw_engines, remote_bases = official_responses()
        schema_key = ("windows", "schema-engine")
        opener = FakeOpener(
            responses,
            transient_url=remote_bases[schema_key] + ".gz",
        )
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            root = Path(directory)
            lockfile = root / "package-lock.json"
            schema = root / "schema.prisma"
            cache_root = root / "fresh-cache"
            cache_root.mkdir()
            write_lockfile(lockfile)
            write_schema(schema)

            cached_engines = builder.bootstrap_required_prisma_engines(
                lockfile,
                schema,
                cache_root,
                opener=opener,
                sleeper=lambda _: None,
            )

            expected_paths = []
            for artifact in builder.PRISMA_REQUIRED_ENGINE_ARTIFACTS:
                key = (artifact.binary_target, artifact.cache_name)
                directory_path = (
                    cache_root
                    / "prisma"
                    / "master"
                    / ENGINE_COMMIT
                    / artifact.binary_target
                )
                cached_engine = directory_path / artifact.cache_name
                expected_paths.append(cached_engine)
                self.assertEqual(cached_engine.read_bytes(), raw_engines[key])
                raw_hash = hashlib.sha256(raw_engines[key]).hexdigest().encode("ascii")
                self.assertEqual(
                    cached_engine.with_name(cached_engine.name + ".sha256").read_bytes(),
                    raw_hash,
                )
                self.assertNotIn(
                    b"\n",
                    cached_engine.with_name(cached_engine.name + ".sha256").read_bytes(),
                )
                remote_base = remote_bases[key]
                self.assertEqual(
                    cached_engine.with_name(cached_engine.name + ".gz.sha256").read_bytes(),
                    hashlib.sha256(responses[remote_base + ".gz"]).hexdigest().encode("ascii"),
                )
                expected_calls = 2 if key == schema_key else 1
                self.assertEqual(opener.calls.count(remote_base + ".gz"), expected_calls)
            self.assertEqual(cached_engines, tuple(expected_paths))
            self.assertTrue(all(value == "Reliance-Release-Builder/1.0" for value in opener.user_agents))

    def test_bootstrap_rejects_a_raw_checksum_mismatch_without_a_usable_cache_entry(self) -> None:
        responses, _, remote_bases = official_responses()
        artifact = builder.PRISMA_REQUIRED_ENGINE_ARTIFACTS[-1]
        key = (artifact.binary_target, artifact.cache_name)
        remote_base = remote_bases[key]
        responses[remote_base + ".sha256"] = (
            ("0" * 64) + f"  ./{artifact.binary_target}/{artifact.remote_name}\n"
        ).encode("ascii")
        opener = FakeOpener(responses)
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            root = Path(directory)
            cache_root = root / "fresh-cache"
            cache_root.mkdir()

            with self.assertRaisesRegex(RuntimeError, "raw engine checksum"):
                builder.bootstrap_prisma_engine_artifact(
                    ENGINE_COMMIT,
                    cache_root,
                    artifact,
                    opener=opener,
                    sleeper=lambda _: None,
                )

            cache_directory = (
                cache_root / "prisma" / "master" / ENGINE_COMMIT / artifact.binary_target
            )
            self.assertFalse((cache_directory / artifact.cache_name).exists())
            self.assertFalse((cache_directory / f"{artifact.cache_name}.sha256").exists())

    def test_generator_contract_rejects_changed_targets_or_engine_type(self) -> None:
        with tempfile.TemporaryDirectory(dir=MODULE_PATH.parent) as directory:
            schema = Path(directory) / "schema.prisma"
            write_schema(schema, targets=("native",))
            with self.assertRaisesRegex(RuntimeError, "binaryTargets changed"):
                builder.validate_prisma_generator_contract(schema)
            write_schema(schema, engine_type="binary")
            with self.assertRaisesRegex(RuntimeError, "engineType must remain library"):
                builder.validate_prisma_generator_contract(schema)

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

        artifact = builder.PRISMA_REQUIRED_ENGINE_ARTIFACTS[0]
        official = (
            f"{builder.PRISMA_ENGINE_ORIGIN}/all_commits/{ENGINE_COMMIT}/"
            f"{artifact.binary_target}/{artifact.remote_name}.sha256"
        )
        with self.assertRaisesRegex(RuntimeError, "official HTTPS origin"):
            builder._official_sha256(official, opener=opener, sleeper=lambda _: None)


if __name__ == "__main__":
    unittest.main()
