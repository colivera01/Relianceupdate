#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-migration-immutability-'));
const verifier = path.join(root, 'scripts', 'release', 'verify_migration_manifest.cjs');
const run = () => spawnSync(process.execPath, [verifier, '--root', temp], { encoding: 'utf8' });
try {
  fs.mkdirSync(path.join(temp, 'prisma'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'docs', 'database'), { recursive: true });
  fs.cpSync(path.join(root, 'prisma', 'migrations'), path.join(temp, 'prisma', 'migrations'), { recursive: true });
  fs.copyFileSync(path.join(root, 'prisma', 'active-migration-manifest.json'), path.join(temp, 'prisma', 'active-migration-manifest.json'));
  fs.cpSync(path.join(root, 'docs', 'database', 'migration-history-legacy'), path.join(temp, 'docs', 'database', 'migration-history-legacy'), { recursive: true });
  const original = run();
  assert.equal(original.status, 0, original.stderr);
  const baseline = path.join(temp, 'prisma', 'migrations', '00000000000000_reliance_forward_baseline_20260914_v2', 'migration.sql');
  const bytes = fs.readFileSync(baseline);
  fs.writeFileSync(baseline, Buffer.concat([bytes, Buffer.from(' ')]));
  const altered = run();
  assert.equal(altered.status, 2, 'One-byte mutation was not rejected');
  fs.writeFileSync(baseline, bytes);
  const restored = run();
  assert.equal(restored.status, 0, restored.stderr);
  console.log(JSON.stringify({ verdict: 'PASS', original: 'PASS', oneByteMutation: 'FAIL_CLOSED', restored: 'PASS' }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
