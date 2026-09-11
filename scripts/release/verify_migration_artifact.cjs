#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const root = path.resolve(value('--root') || process.cwd());
const artifactPath = path.resolve(value('--artifact') || '');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const artifactBytes = fs.readFileSync(artifactPath);
const artifact = JSON.parse(artifactBytes.toString('utf8'));
assert.equal(artifact.artifactVersion, 1, 'Unsupported migration artifact');
assert(!artifact.files.some((file) => file.path.startsWith('docs/database/migration-history-legacy/')), 'Legacy archive appears in migration artifact');
const active = artifact.files.filter((file) => /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(file.path));
for (const file of artifact.files) {
  const bytes = Buffer.from(file.contentBase64, 'base64');
  assert.equal(bytes.length, file.bytes, `Byte count differs: ${file.path}`);
  assert.equal(sha256(bytes), file.sha256, `Embedded hash differs: ${file.path}`);
  if (value('--compare-source')) assert.deepEqual(bytes, fs.readFileSync(path.join(root, file.path)), `Source differs: ${file.path}`);
}
assert.deepEqual(active.map((file) => file.path).sort(), [
  'prisma/migrations/00000000000000_reliance_forward_baseline_20260910/migration.sql',
  'prisma/migrations/20260910030000_enforce_one_active_device_assignment/migration.sql',
]);
console.log(JSON.stringify({ verdict: 'PASS', artifactSha256: sha256(artifactBytes), sourceCommit: artifact.sourceCommit, fileCount: artifact.files.length, activeMigrationCount: active.length, legacyArchiveExecutable: false }, null, 2));
