#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const root = path.resolve(value('--root') || process.cwd());
const output = path.resolve(value('--output') || '');
const commit = value('--commit');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const slash = (value) => value.replace(/\\/g, '/');
const git = (...gitArgs) => spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });

assert(output && value('--output'), '--output is required');
assert(!fs.existsSync(output), 'Refusing to overwrite migration artifact');
assert(/^[a-f0-9]{40}$/.test(commit || ''), 'Exact 40-character commit is required');
assert.equal(git('rev-parse', 'HEAD').stdout.trim(), commit, 'Commit differs from HEAD');
assert.equal(git('status', '--porcelain').stdout.trim(), '', 'Migration artifact requires a clean worktree');

const fixed = [
  '.gitattributes',
  'package.json',
  'package-lock.json',
  'prisma/schema.prisma',
  'prisma/active-migration-manifest.json',
  'prisma/migrations/migration_lock.toml',
  'config/release-targets/reliance-beta.json',
  'docs/database/CUTOVER-V2-RUNBOOK.md',
  'docs/database/MIGRATION-SAFETY-CONTROLS-V2.md',
];
const releaseScripts = fs.readdirSync(path.join(root, 'scripts', 'release'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /(?:azure_cli|azure_(?:package|database)_setting|migration|cutover|quiescence|recovery|release_receipt|database_target|target_spec|prisma_command|sqlserver_contract|sha256_controls|guarded_prisma|guarded_sql|release_artifacts|forward_git)/.test(entry.name))
  .map((entry) => `scripts/release/${entry.name}`);
const v2Scripts = fs.readdirSync(path.join(root, 'scripts', 'release', 'cutover_v2'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.cjs'))
  .map((entry) => `scripts/release/cutover_v2/${entry.name}`);
const releaseSql = fs.readdirSync(path.join(root, 'scripts', 'release', 'sql'))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => `scripts/release/sql/${name}`);
const cutoverConfig = fs.readdirSync(path.join(root, 'config', 'release-cutover-v2'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => `config/release-cutover-v2/${name}`);
const activeSql = fs.readdirSync(path.join(root, 'prisma', 'migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `prisma/migrations/${entry.name}/migration.sql`);
const paths = [...new Set([...fixed, ...releaseScripts, ...v2Scripts, ...releaseSql, ...cutoverConfig, ...activeSql])].sort();
for (const relative of paths) {
  assert(!relative.startsWith('docs/database/migration-history-legacy/'), 'Legacy archive cannot enter executable migration artifact');
  assert(fs.statSync(path.join(root, relative)).isFile(), `Missing artifact input: ${relative}`);
}
const files = paths.map((relative) => {
  const content = fs.readFileSync(path.join(root, relative));
  return { path: slash(relative), bytes: content.length, sha256: sha256(content), contentBase64: content.toString('base64') };
});
const artifact = { artifactVersion: 1, sourceCommit: commit, files };
const encoded = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, encoded);
console.log(JSON.stringify({ verdict: 'PASS', output, files: files.length, bytes: encoded.length, sha256: sha256(encoded), legacyArchiveIncluded: false }, null, 2));
