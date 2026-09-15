#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { capture, connect } = require('./sqlserver_contract.cjs');
const { parsePrismaSqlServerUrl, sameServer } = require('./migration_safety.cjs');
const { targetSpecEvidence } = require('./release_receipt_lib.cjs');
const { assertSha256ControlMatch, validateSha256ControlObject } = require('./sha256_controls.cjs');

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const has = (flag) => args.includes(flag);
const root = process.cwd();

async function main() {
  const specPath = path.resolve(root, value('--spec') || '');
  const receiptPath = path.resolve(root, value('--receipt') || '');
  const phase = value('--phase');
  const resourceId = value('--resource-id');
  assert(fs.existsSync(specPath), 'Target specification is required');
  assert(fs.existsSync(receiptPath), 'Exact release receipt is required');
  assert(phase, 'Target phase is required');
  const { spec } = targetSpecEvidence(specPath);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  validateSha256ControlObject(receipt, 'Release receipt');
  const expected = spec.expectedStates?.[phase];
  assert(expected, `Unknown target phase: ${phase}`);
  assert.equal(resourceId, spec.resourceId, 'Azure resource ID differs from target specification');
  assertSha256ControlMatch(receipt.expectedDatabaseMigrationState?.targetSpecSha256, spec.sha256,
    'Release receipt target specification differs');
  const configured = parsePrismaSqlServerUrl(process.env.DATABASE_URL);
  assert(sameServer(configured.server, spec.server), 'Connection server differs from target specification');
  assert.equal(configured.database, String(spec.database).toLowerCase(), 'Connection database differs from target specification');
  assert.equal(process.env.RELIANCE_DB_ENVIRONMENT, spec.environment, 'Declared environment differs from target specification');

  if (has('--azure-verify')) {
    const result = spawnSync('az', ['resource', 'show', '--ids', spec.resourceId, '--query', 'id', '-o', 'tsv'], { encoding: 'utf8', shell: process.platform === 'win32' });
    assert.equal(result.status, 0, `Azure resource lookup failed: ${result.stderr.trim()}`);
    assert.equal(result.stdout.trim().toLowerCase(), spec.resourceId.toLowerCase(), 'Azure control-plane resource differs');
  }

  const pool = await connect(process.env.DATABASE_URL);
  try {
    const observed = await capture(pool);
    assert(sameServer(observed.identity.serverName, spec.server), 'Connected SQL Server differs');
    assert.equal(String(observed.identity.databaseName).toLowerCase(), String(spec.database).toLowerCase(), 'Connected database differs');
    if (expected.structuralSha256) assertSha256ControlMatch(observed.structuralSha256, expected.structuralSha256, 'Structural fingerprint differs');
    if (expected.ledgerSha256) assertSha256ControlMatch(observed.ledgerSha256, expected.ledgerSha256, 'Migration ledger digest differs');
    if (Number.isInteger(expected.ledgerRows)) assert.equal(observed.ledgerRows, expected.ledgerRows, 'Migration ledger row count differs');
    if (Number.isInteger(expected.successfulDistinctMigrations)) assert.equal(observed.successfulDistinctMigrations, expected.successfulDistinctMigrations, 'Successful migration-name count differs');
    if (expected.successfulMigrationNames) assert.deepEqual(observed.successfulMigrationNames, [...expected.successfulMigrationNames].sort(), 'Successful migration names differ');
    console.log(JSON.stringify({
      verdict: 'PASS',
      environment: spec.environment,
      server: spec.server,
      database: spec.database,
      resourceId: spec.resourceId,
      phase,
      structuralSha256: observed.structuralSha256,
      ledgerSha256: observed.ledgerSha256,
      ledgerRows: observed.ledgerRows,
      successfulDistinctMigrations: observed.successfulDistinctMigrations,
      releaseCommit: receipt.sourceCommit,
    }, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch((error) => { console.error(`TARGET_IDENTITY_FAILED: ${error.message}`); process.exitCode = 2; });

