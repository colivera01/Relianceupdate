#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  assertSha256Control,
  assertSha256ControlMatch,
  validateSha256ControlObject,
} = require('./sha256_controls.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const canonical = (value) => `${JSON.stringify(stable(value), null, 2)}\n`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fileEvidence = (file) => ({ name: path.basename(file), bytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)) });
const normalizedTextBytes = (value) => Buffer.from(String(value).replace(/\r\n/g, '\n'), 'utf8');

const assertSha256Fingerprint = assertSha256Control;

function assertStructuralFingerprintMatch(actual, expected, label = 'Structural fingerprint differs') {
  assertSha256ControlMatch(actual, expected, label);
}

function validateTargetSpecSha256Controls(spec) {
  const count = validateSha256ControlObject(spec, 'Target specification');
  assert(count > 0, 'Target specification has no SHA-256 controls');
  return count;
}

const validateTargetSpecStructuralFingerprints = validateTargetSpecSha256Controls;

function aggregateDirectory(directory, ignored = () => false) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) walk(target);
      else {
        const relative = path.relative(directory, target).replace(/\\/g, '/');
        if (!ignored(relative)) {
          const bytes = fs.readFileSync(target);
          files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
        }
      }
    }
  };
  walk(directory);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { fileCount: files.length, sha256: sha256(Buffer.from(files.map((file) => `${file.path}\0${file.sha256}\0${file.bytes}\n`).join(''))) };
}

function targetSpecEvidence(file) {
  const spec = readJson(file);
  validateTargetSpecSha256Controls(spec);
  const declared = spec.sha256;
  const withoutHash = { ...spec };
  delete withoutHash.sha256;
  const actual = sha256(Buffer.from(canonical(withoutHash)));
  assertSha256ControlMatch(actual, declared, 'Target specification canonical hash differs');
  return { spec, sha256: actual };
}

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sourceEvidence(root, targetSpecPath) {
  const active = readJson(path.join(root, 'prisma', 'active-migration-manifest.json'));
  validateSha256ControlObject(active, 'Active migration manifest');
  const target = targetSpecEvidence(targetSpecPath);
  const lock = readJson(path.join(root, 'package-lock.json'));
  const schemaBytes = normalizedTextBytes(fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8'));
  const structuralContract = {
    schemaSha256: sha256(schemaBytes),
    activeMigrationAggregateHash: active.aggregateSha256,
    legacyArchiveManifestHash: active.legacyArchiveManifestSha256,
    targetSpecSha256: target.sha256,
  };
  return {
    sourceCommit: git(root, 'rev-parse', 'HEAD'),
    branch: git(root, 'branch', '--show-current'),
    cleanStatus: git(root, 'status', '--porcelain') === '',
    schemaHash: structuralContract.schemaSha256,
    baseline: active.entries[0],
    reconciliation: active.entries[1],
    activeMigrationManifest: active.entries,
    activeMigrationAggregateHash: active.aggregateSha256,
    legacyArchiveManifestHash: active.legacyArchiveManifestSha256,
    prismaVersions: {
      cli: lock.packages['node_modules/prisma'].version,
      client: lock.packages['node_modules/@prisma/client'].version,
    },
    lockfileHash: sha256(normalizedTextBytes(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))),
    structuralContractHash: sha256(Buffer.from(canonical(structuralContract))),
    target,
  };
}

function createReceipt(options) {
  const source = sourceEvidence(options.root, options.targetSpec);
  assert(source.cleanStatus, 'Release receipt requires a clean source worktree');
  assert(fs.existsSync(path.join(options.buildRoot, '.next')), 'Exact isolated application build is required');
  assert(fs.existsSync(path.join(options.buildRoot, 'node_modules', '.prisma', 'client')), 'Generated Prisma client is required');
  const testResults = readJson(options.testResults);
  const linuxResults = readJson(options.linuxResults);
  assert.equal(testResults.verdict, 'PASS', 'Protected/local test result is not PASS');
  assert.equal(linuxResults.verdict, 'PASS', 'Linux result is not PASS');
  const receipt = {
    receiptVersion: 2,
    sourceCommit: source.sourceCommit,
    branch: source.branch,
    cleanStatus: source.cleanStatus,
    schemaHash: source.schemaHash,
    baseline: source.baseline,
    reconciliation: source.reconciliation,
    activeMigrationManifest: source.activeMigrationManifest,
    activeMigrationAggregateHash: source.activeMigrationAggregateHash,
    legacyArchiveManifestHash: source.legacyArchiveManifestHash,
    prismaVersions: source.prismaVersions,
    generatedClientHash: aggregateDirectory(path.join(options.buildRoot, 'node_modules', '.prisma', 'client')),
    lockfileHash: source.lockfileHash,
    buildHash: aggregateDirectory(path.join(options.buildRoot, '.next'), (file) => file.startsWith('cache/')),
    applicationArtifact: fileEvidence(options.applicationArtifact),
    migrationArtifact: fileEvidence(options.migrationArtifact),
    structuralContractHash: source.structuralContractHash,
    testResults: { ...fileEvidence(options.testResults), verdict: testResults.verdict, files: testResults.files, tests: testResults.tests, failed: testResults.failed, skipped: testResults.skipped },
    linuxValidation: { ...fileEvidence(options.linuxResults), verdict: linuxResults.verdict },
    expectedDatabaseMigrationState: {
      targetSpecSha256: source.target.sha256,
      preCutover: source.target.spec.expectedStates.preCutover,
      postBaselineSuccessfulNames: [source.baseline.name],
      postReconciliationSuccessfulNames: source.activeMigrationManifest.map((entry) => entry.name),
      legacyLedgerPreservedSha256: source.target.spec.expectedStates.preCutover.ledgerSha256,
    },
  };
  validateSha256ControlObject(receipt, 'Release receipt');
  return receipt;
}

function verifyReceipt(receipt, options) {
  validateSha256ControlObject(receipt, 'Release receipt');
  const source = sourceEvidence(options.root, options.targetSpec);
  for (const key of ['sourceCommit', 'branch', 'cleanStatus', 'schemaHash', 'baseline', 'reconciliation', 'activeMigrationManifest', 'activeMigrationAggregateHash', 'legacyArchiveManifestHash', 'prismaVersions', 'lockfileHash', 'structuralContractHash']) {
    assert.deepEqual(receipt[key], source[key], `Release receipt source mismatch: ${key}`);
  }
  assert.deepEqual(receipt.applicationArtifact, fileEvidence(options.applicationArtifact), 'Application artifact differs');
  assert.deepEqual(receipt.migrationArtifact, fileEvidence(options.migrationArtifact), 'Migration artifact differs');
  assert.deepEqual(receipt.generatedClientHash, aggregateDirectory(path.join(options.buildRoot, 'node_modules', '.prisma', 'client')), 'Generated client differs');
  assert.deepEqual(receipt.buildHash, aggregateDirectory(path.join(options.buildRoot, '.next'), (file) => file.startsWith('cache/')), 'Build output differs');
  assert.equal(receipt.expectedDatabaseMigrationState.targetSpecSha256, source.target.sha256, 'Target spec differs');
  return { verdict: 'PASS', sourceCommit: source.sourceCommit, activeMigrationAggregateHash: source.activeMigrationAggregateHash, structuralContractHash: source.structuralContractHash };
}

module.exports = {
  aggregateDirectory,
  assertSha256Fingerprint,
  assertSha256ControlMatch,
  assertStructuralFingerprintMatch,
  canonical,
  createReceipt,
  fileEvidence,
  normalizedTextBytes,
  readJson,
  sha256,
  sourceEvidence,
  targetSpecEvidence,
  validateSha256ControlObject,
  validateTargetSpecSha256Controls,
  validateTargetSpecStructuralFingerprints,
  verifyReceipt,
};

