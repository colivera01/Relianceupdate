#!/usr/bin/env python3
"""Produce a candidate only. No Azure access, database access, or deployment."""
import argparse
from contextlib import contextmanager
import gzip
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


# npm 7+ runs lifecycle scripts in parallel by default. Prisma's client and
# engines postinstalls can then download the same engine set concurrently,
# which makes an otherwise valid isolated build vulnerable to transient
# connection resets. Keep lifecycle scripts on npm's supported foreground path
# so the locked dependency install remains fresh while postinstalls run in a
# deterministic sequence.
NPM_CI_ARGS = ('ci', '--foreground-scripts', '--no-audit', '--no-fund')
PRISMA_ENGINE_ORIGIN = 'https://binaries.prisma.sh'
PRISMA_SCHEMA_ENGINE_REMOTE_NAME = 'schema-engine.exe'
PRISMA_SCHEMA_ENGINE_CACHE_NAME = 'schema-engine'
PRISMA_DOWNLOAD_ATTEMPTS = 4
PRISMA_DOWNLOAD_CHUNK_BYTES = 1024 * 1024
PRISMA_MAX_CHECKSUM_BYTES = 1024
PRISMA_MAX_COMPRESSED_ENGINE_BYTES = 64 * 1024 * 1024
PRISMA_MAX_RAW_ENGINE_BYTES = 128 * 1024 * 1024
SHA256_RECORD = re.compile(r'^([0-9a-fA-F]{64})(?:[ \t]+[^\r\n]+)?\r?\n?$')


def locked_prisma_engine_commit(lockfile: Path) -> str:
    lock = json.loads(lockfile.read_text(encoding='utf-8'))
    packages = lock.get('packages')
    if not isinstance(packages, dict):
        raise RuntimeError('package-lock.json does not contain a packages map')
    engines = packages.get('node_modules/@prisma/engines')
    engines_version = packages.get('node_modules/@prisma/engines-version')
    if not isinstance(engines, dict) or not isinstance(engines_version, dict):
        raise RuntimeError('package-lock.json is missing the locked Prisma engine packages')
    dependencies = engines.get('dependencies')
    locked_version = engines_version.get('version')
    if not isinstance(dependencies, dict) or dependencies.get('@prisma/engines-version') != locked_version:
        raise RuntimeError('Prisma engine version dependency does not match package-lock.json')
    if not isinstance(locked_version, str):
        raise RuntimeError('Prisma engine version is invalid')
    match = re.search(r'\.([0-9a-f]{40})$', locked_version)
    if not match:
        raise RuntimeError('Prisma engine commit is not a locked 40-character hash')
    return match.group(1)


def _validate_official_prisma_url(url: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    if (
        parsed.scheme != 'https'
        or parsed.hostname != 'binaries.prisma.sh'
        or parsed.port not in (None, 443)
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise RuntimeError('Prisma engine downloads must use the official HTTPS origin')


def _official_response(url: str, opener, timeout: int = 60):
    _validate_official_prisma_url(url)
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Reliance-Release-Builder/1.0',
            'Accept': 'application/octet-stream',
        },
    )
    response = opener(request, timeout=timeout)
    final_url = response.geturl() if hasattr(response, 'geturl') else url
    try:
        _validate_official_prisma_url(final_url)
        status = getattr(response, 'status', 200)
        if status != 200:
            raise RuntimeError(f'Official Prisma download returned HTTP {status}')
        return response
    except Exception:
        response.close()
        raise


def _retry_network(operation, *, sleeper=time.sleep):
    retryable = (
        urllib.error.URLError,
        TimeoutError,
        ConnectionError,
        http.client.HTTPException,
        ssl.SSLError,
    )
    for attempt in range(1, PRISMA_DOWNLOAD_ATTEMPTS + 1):
        try:
            return operation()
        except urllib.error.HTTPError:
            raise
        except retryable:
            if attempt == PRISMA_DOWNLOAD_ATTEMPTS:
                raise
            sleeper(attempt)
    raise RuntimeError('Prisma engine download retry loop ended unexpectedly')


def _read_official_bytes(url: str, *, opener=urllib.request.urlopen, sleeper=time.sleep, max_bytes: int) -> bytes:
    def read_once() -> bytes:
        with _official_response(url, opener) as response:
            data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise RuntimeError('Official Prisma response exceeded the allowed size')
        return data

    return _retry_network(read_once, sleeper=sleeper)


def _official_sha256(url: str, *, opener=urllib.request.urlopen, sleeper=time.sleep) -> str:
    body = _read_official_bytes(
        url,
        opener=opener,
        sleeper=sleeper,
        max_bytes=PRISMA_MAX_CHECKSUM_BYTES,
    )
    try:
        text = body.decode('ascii')
    except UnicodeDecodeError as error:
        raise RuntimeError('Official Prisma checksum is not ASCII') from error
    match = SHA256_RECORD.fullmatch(text)
    if not match:
        raise RuntimeError('Official Prisma checksum is not a sha256sum record')
    return match.group(1).lower()


def _download_official_file(
    url: str,
    destination: Path,
    *,
    opener=urllib.request.urlopen,
    sleeper=time.sleep,
    max_bytes: int,
) -> str:
    partial = destination.with_name(destination.name + '.partial')

    def download_once() -> str:
        partial.unlink(missing_ok=True)
        digest = hashlib.sha256()
        total = 0
        with _official_response(url, opener) as response, partial.open('xb') as output:
            while True:
                chunk = response.read(PRISMA_DOWNLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise RuntimeError('Official Prisma engine exceeded the allowed size')
                output.write(chunk)
                digest.update(chunk)
        os.replace(partial, destination)
        return digest.hexdigest()

    try:
        return _retry_network(download_once, sleeper=sleeper)
    finally:
        partial.unlink(missing_ok=True)


def bootstrap_windows_prisma_schema_engine(
    lockfile: Path,
    cache_root: Path,
    *,
    opener=urllib.request.urlopen,
    sleeper=time.sleep,
) -> Path:
    engine_commit = locked_prisma_engine_commit(lockfile)
    cache_directory = cache_root / 'prisma' / 'master' / engine_commit / 'windows'
    cache_directory.mkdir(parents=True, exist_ok=False)
    remote_base = (
        f'{PRISMA_ENGINE_ORIGIN}/all_commits/{engine_commit}/windows/'
        f'{PRISMA_SCHEMA_ENGINE_REMOTE_NAME}'
    )
    expected_raw = _official_sha256(remote_base + '.sha256', opener=opener, sleeper=sleeper)
    expected_compressed = _official_sha256(
        remote_base + '.gz.sha256', opener=opener, sleeper=sleeper
    )
    compressed = cache_directory / (PRISMA_SCHEMA_ENGINE_REMOTE_NAME + '.gz')
    cached_engine = cache_directory / PRISMA_SCHEMA_ENGINE_CACHE_NAME
    uncompressed_partial = cached_engine.with_name(cached_engine.name + '.partial')
    raw_hash_path = cached_engine.with_name(cached_engine.name + '.sha256')
    compressed_hash_path = cached_engine.with_name(cached_engine.name + '.gz.sha256')
    try:
        actual_compressed = _download_official_file(
            remote_base + '.gz',
            compressed,
            opener=opener,
            sleeper=sleeper,
            max_bytes=PRISMA_MAX_COMPRESSED_ENGINE_BYTES,
        )
        if actual_compressed != expected_compressed:
            raise RuntimeError('Official Prisma compressed engine checksum did not match')
        digest = hashlib.sha256()
        total = 0
        with gzip.open(compressed, 'rb') as source, uncompressed_partial.open('xb') as output:
            while True:
                chunk = source.read(PRISMA_DOWNLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > PRISMA_MAX_RAW_ENGINE_BYTES:
                    raise RuntimeError('Prisma schema engine exceeded the allowed raw size')
                output.write(chunk)
                digest.update(chunk)
        if digest.hexdigest() != expected_raw:
            raise RuntimeError('Official Prisma raw engine checksum did not match')
        os.replace(uncompressed_partial, cached_engine)
        raw_hash_path.write_bytes(expected_raw.encode('ascii'))
        compressed_hash_path.write_bytes(expected_compressed.encode('ascii'))
        return cached_engine
    except Exception:
        for path in (cached_engine, raw_hash_path, compressed_hash_path):
            path.unlink(missing_ok=True)
        raise
    finally:
        compressed.unlink(missing_ok=True)
        uncompressed_partial.unlink(missing_ok=True)


@contextmanager
def fresh_prisma_cache(path: Path):
    if path.exists():
        raise RuntimeError('Prisma release cache path must be new')
    path.mkdir()
    try:
        yield path
    finally:
        shutil.rmtree(path)
        if path.exists():
            raise RuntimeError('Prisma release cache could not be removed')


def run(args, cwd, env):
    subprocess.run([str(arg) for arg in args], cwd=cwd, env=env, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo-root', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--build-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = args.repo_root.resolve()
    build = args.build_root.resolve()
    if build.exists():
        raise RuntimeError('Build root must be new; dependency/build reuse is prohibited')
    if subprocess.check_output(['git', 'status', '--porcelain'], cwd=source).strip():
        raise RuntimeError('Source worktree must be clean')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip() != args.commit:
        raise RuntimeError('HEAD must match exact approved commit')
    public_contact = json.loads(
        (source / 'src/config/reliance-public-contact.json').read_text(encoding='utf-8')
    )
    support_email = str(public_contact.get('supportEmail', '')).strip()
    if not support_email:
        raise RuntimeError('Canonical Reliance support email is missing')
    # Do not inherit database credentials or ambient generation/engine overrides.
    env = {key: value for key, value in os.environ.items() if key.upper() in {
        'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT', 'PROCESSOR_ARCHITECTURE',
    }}
    env.update(NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL=support_email, NEXT_TELEMETRY_DISABLED='1', NODE_OPTIONS='--max-old-space-size=6144 --dns-result-order=ipv4first', DATABASE_URL='sqlserver://localhost:1433;database=release_build;user=unused;password=unused;trustServerCertificate=true')
    run(['git', '-c', 'core.autocrlf=false', 'clone', '--no-hardlinks', '--no-checkout', source, build], source, env)
    run(['git', '-c', 'core.autocrlf=false', 'checkout', '--detach', args.commit], build, env)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise RuntimeError('npm is required by package-lock.json')
    if os.name == 'nt':
        cache_fingerprint = hashlib.sha256(str(build).encode('utf-8')).hexdigest()[:12]
        prisma_cache_path = (
            build.parent / f'.release-prisma-cache-{args.commit[:12]}-{cache_fingerprint}'
        )
        with fresh_prisma_cache(prisma_cache_path) as prisma_cache:
            env['CACHE_DIR'] = str(prisma_cache)
            try:
                # Seed exactly one official, checksum-verified engine. Prisma
                # independently validates the raw cache hash, then downloads
                # only its query engine instead of opening both transfers at once.
                bootstrap_windows_prisma_schema_engine(
                    build / 'package-lock.json', prisma_cache
                )
                run([npm, *NPM_CI_ARGS], build, env)
            finally:
                env.pop('CACHE_DIR', None)
        # npm omits other operating systems' optional native packages. Install
        # the same lockfile for Azure's target in a separate fresh scratch tree;
        # copy only its Linux-native packages, never Prisma/generated contents.
        target = build.parent / f'.release-linux-target-{args.commit[:12]}'
        if target.exists():
            raise RuntimeError('Linux target dependency scratch path must be new')
        target.mkdir()
        for name in ('package.json', 'package-lock.json'):
            shutil.copy2(build / name, target / name)
        run([npm, 'ci', '--ignore-scripts', '--os=linux', '--cpu=x64', '--libc=glibc', '--no-audit', '--no-fund'], target, env)
        lock = json.loads((build / 'package-lock.json').read_text(encoding='utf-8'))
        for relative, package in lock['packages'].items():
            if 'linux' not in package.get('os', []) or 'x64' not in package.get('cpu', []):
                continue
            if package.get('libc') and 'glibc' not in package['libc']:
                continue
            installed = target / relative
            destination = build / relative
            if not installed.is_dir() or destination.exists():
                raise RuntimeError(f'Unexpected target-native dependency state: {relative}')
            shutil.copytree(installed, destination)
        shutil.rmtree(target)
    else:
        run([npm, *NPM_CI_ARGS], build, env)
    run(['node', 'node_modules/prisma/build/index.js', 'generate', '--schema=prisma/schema.prisma'], build, env)
    verifier = build / 'scripts/release/verify_prisma_artifact.cjs'
    manifest = build / 'prisma-artifact-manifest.json'
    run(['node', verifier, '--mode', 'create', '--root', build, '--schema', build / 'prisma/schema.prisma', '--lockfile', build / 'package-lock.json', '--commit', args.commit, '--output', manifest], build, env)
    run([npm, 'run', 'build'], build, env)
    run(['node', verifier, '--mode', 'verify', '--root', build / '.next/standalone', '--manifest', manifest], build, env)
    receipt = json.loads(manifest.read_text(encoding='utf-8'))
    receipt.update(isolatedBuild=True, nextBuildId=(build / '.next/standalone/.next/BUILD_ID').read_text().strip(), npmVersion=subprocess.check_output([npm, '--version'], cwd=build, env=env, text=True).strip())
    manifest.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    run([sys.executable, build / 'scripts/release/build_azure_allowlist_package.py', '--repo-root', build, '--commit', args.commit, '--output', args.output.resolve(), '--metadata-output', args.output.resolve().with_suffix('.metadata.json')], build, env)


if __name__ == '__main__':
    main()
