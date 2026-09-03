#!/usr/bin/env python3
"""Produce a candidate only. No Azure access, database access, or deployment."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


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
    # Do not inherit database credentials or ambient generation/engine overrides.
    env = {key: value for key, value in os.environ.items() if key.upper() in {
        'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT', 'PROCESSOR_ARCHITECTURE',
    }}
    env.update(NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL='Relianceorg.support@gmail.com', NEXT_TELEMETRY_DISABLED='1', NODE_OPTIONS='--max-old-space-size=6144 --dns-result-order=ipv4first', DATABASE_URL='sqlserver://localhost:1433;database=release_build;user=unused;password=unused;trustServerCertificate=true')
    run(['git', '-c', 'core.autocrlf=false', 'clone', '--no-hardlinks', '--no-checkout', source, build], source, env)
    run(['git', '-c', 'core.autocrlf=false', 'checkout', '--detach', args.commit], build, env)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise RuntimeError('npm is required by package-lock.json')
    run([npm, 'ci', '--no-audit', '--no-fund'], build, env)
    if os.name == 'nt':
        # npm omits other operating systems' optional native packages. Install
        # the same lockfile for Azure's target in a separate fresh scratch tree;
        # copy only its Linux-native packages, never Prisma/generated contents.
        target = build / 'node_modules/.release-linux-target'
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
