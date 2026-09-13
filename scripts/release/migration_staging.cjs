#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertSha256ControlMatch, validateSha256ControlObject } = require('./sha256_controls.cjs');

const BASELINE = '00000000000000_reliance_forward_baseline_20260910';
const RECONCILIATION = '20260910030000_enforce_one_active_device_assignment';
const STAGES = Object.freeze({
  baseline: [BASELINE],
  reconciliation: [BASELINE, RECONCILIATION],
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function expectedEntries(root, stageName) {
  assert(Object.hasOwn(STAGES, stageName), `Unknown migration stage: ${stageName}`);
  const manifestPath = path.join(root, 'prisma', 'active-migration-manifest.json');
  const manifest = readJson(manifestPath);
  validateSha256ControlObject(manifest, 'Active migration manifest');
  const entries = STAGES[stageName].map((name) => {
    const entry = manifest.entries.find((candidate) => candidate.name === name);
    assert(entry, `Migration ${name} is absent from reviewed manifest`);
    assert(!/legacy|archive/i.test(name), `Archived migration cannot be staged: ${name}`);
    return entry;
  });
  assert.equal(manifest.entries.length, 2, 'Reviewed active manifest must contain exactly baseline and reconciliation');
  assert.deepEqual(manifest.entries.map((entry) => entry.name), STAGES.reconciliation,
    'Reviewed migration order differs from the approved contract');
  return { manifest, entries };
}

function verifySourceEntry(root, entry) {
  const source = path.join(root, 'prisma', 'migrations', entry.name, 'migration.sql');
  assert(fs.statSync(source).isFile(), `Migration source missing: ${entry.name}`);
  const bytes = fs.readFileSync(source);
  assert.equal(bytes.length, entry.bytes, `Migration byte count differs: ${entry.name}`);
  assertSha256ControlMatch(sha256(bytes), entry.sha256, `Migration checksum differs: ${entry.name}`);
  return { source, bytes };
}

function createStage({ root, stageName, parentDirectory }) {
  const { manifest, entries } = expectedEntries(root, stageName);
  const stageRoot = fs.mkdtempSync(path.join(parentDirectory || os.tmpdir(), `reliance-${stageName}-`));
  const prismaRoot = path.join(stageRoot, 'prisma');
  const migrationsRoot = path.join(prismaRoot, 'migrations');
  fs.mkdirSync(migrationsRoot, { recursive: true });
  fs.copyFileSync(path.join(root, 'prisma', 'schema.prisma'), path.join(prismaRoot, 'schema.prisma'));
  fs.copyFileSync(path.join(root, 'prisma', 'migrations', 'migration_lock.toml'), path.join(migrationsRoot, 'migration_lock.toml'));
  for (const entry of entries) {
    const { bytes } = verifySourceEntry(root, entry);
    const targetDirectory = path.join(migrationsRoot, entry.name);
    fs.mkdirSync(targetDirectory);
    fs.writeFileSync(path.join(targetDirectory, 'migration.sql'), bytes, { flag: 'wx' });
  }
  const receipt = {
    receiptVersion: 1,
    stage: stageName,
    sourceManifestSha256: sha256(fs.readFileSync(path.join(root, 'prisma', 'active-migration-manifest.json'))),
    sourceSchemaSha256: sha256(fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'))),
    migrationNames: entries.map((entry) => entry.name),
    migrations: entries.map(({ name, bytes, sha256: digest }) => ({ name, bytes, sha256: digest })),
    activeMigrationAggregateSha256: manifest.aggregateSha256,
    archiveIncluded: false,
  };
  fs.writeFileSync(path.join(stageRoot, 'stage-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  return { stageRoot, prismaRoot, schemaPath: path.join(prismaRoot, 'schema.prisma'), receipt };
}

function verifyStage({ root, stageRoot, stageName }) {
  const { manifest, entries } = expectedEntries(root, stageName);
  const receiptPath = path.join(stageRoot, 'stage-receipt.json');
  const receipt = readJson(receiptPath);
  validateSha256ControlObject(receipt, 'Migration stage receipt');
  assert.equal(receipt.stage, stageName, 'Stage receipt names a different stage');
  assert.equal(receipt.archiveIncluded, false, 'Stage receipt indicates archive content');
  assert.equal(receipt.sourceManifestSha256,
    sha256(fs.readFileSync(path.join(root, 'prisma', 'active-migration-manifest.json'))),
    'Stage receipt references a different manifest');
  const migrationsRoot = path.join(stageRoot, 'prisma', 'migrations');
  const directories = fs.readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(directories, entries.map((entry) => entry.name).sort(), 'Stage migration contents differ');
  const files = [];
  for (const entry of entries) {
    const staged = path.join(migrationsRoot, entry.name, 'migration.sql');
    const source = path.join(root, 'prisma', 'migrations', entry.name, 'migration.sql');
    const stagedBytes = fs.readFileSync(staged);
    const sourceBytes = fs.readFileSync(source);
    assert.deepEqual(stagedBytes, sourceBytes, `Staged bytes differ: ${entry.name}`);
    assertSha256ControlMatch(sha256(stagedBytes), entry.sha256, `Staged checksum differs: ${entry.name}`);
    files.push({ name: entry.name, bytes: stagedBytes.length, sha256: sha256(stagedBytes) });
  }
  const allPaths = [];
  fs.readdirSync(stageRoot, { recursive: true, withFileTypes: true }).forEach((entry) => allPaths.push(entry.name));
  assert(!allPaths.some((name) => /migration-history-legacy|archive-manifest|legacy-migration/i.test(name)),
    'Archive content entered executable migration stage');
  assertSha256ControlMatch(receipt.activeMigrationAggregateSha256, manifest.aggregateSha256, 'Active manifest aggregate differs');
  return { verdict: 'PASS', stage: stageName, schemaPath: path.join(stageRoot, 'prisma', 'schema.prisma'), files, archiveIncluded: false };
}

function destroyStage(stageRoot) {
  assert(path.basename(stageRoot).startsWith('reliance-'), 'Refusing to remove an unrecognized staging directory');
  fs.rmSync(stageRoot, { recursive: true, force: true });
}

module.exports = { BASELINE, RECONCILIATION, STAGES, createStage, destroyStage, expectedEntries, sha256, verifyStage };
