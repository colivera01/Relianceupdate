#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { connect } = require('./sqlserver_contract.cjs');
const { parsePrismaSqlServerUrl } = require('./migration_safety.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const allowed = new Set(['rotate_legacy_migration_ledger_20260910.sql', 'rollback_active_assignment_index.sql']);

async function main() {
  const root = process.cwd();
  const file = path.resolve(root, value('--file') || '');
  assert(file.startsWith(path.join(root, 'scripts', 'release', 'sql') + path.sep), 'SQL file must be inside scripts/release/sql');
  assert(allowed.has(path.basename(file)), 'SQL file is not allowlisted');
  const environment = process.env.RELIANCE_DB_ENVIRONMENT;
  const identity = parsePrismaSqlServerUrl(process.env.DATABASE_URL);
  const protectedTarget = environment === 'beta' || environment === 'production' || /beta|prod|production/i.test(`${identity.server}/${identity.database}`);
  if (protectedTarget) {
    assert(process.env.RELIANCE_MIGRATION_WRITE_APPROVED === 'YES', 'Protected SQL requires explicit write approval');
    assert(process.env.RELIANCE_MIGRATION_LOCK_TOKEN, 'Protected SQL requires the exclusive migration lock');
    const verifiedByLock = process.env.RELIANCE_TARGET_VERIFICATION_TOKEN
      && process.env.RELIANCE_TARGET_VERIFICATION_TOKEN === process.env.RELIANCE_MIGRATION_LOCK_TOKEN;
    if (!verifiedByLock) {
      const verification = spawnSync(process.execPath, [path.join(root, 'scripts', 'release', 'verify_database_target.cjs'),
        '--spec', process.env.RELIANCE_TARGET_SPEC || '', '--receipt', process.env.RELIANCE_RELEASE_RECEIPT || '',
        '--phase', process.env.RELIANCE_TARGET_PHASE || 'preCutover', '--resource-id', process.env.RELIANCE_EXPECTED_RESOURCE_ID || '', '--azure-verify'],
      { cwd: root, env: process.env, stdio: 'inherit' });
      assert.equal(verification.status, 0, 'Protected target verification failed');
    }
  } else {
    assert.equal(environment, 'disposable', 'Non-protected SQL writes require disposable environment');
    assert.equal(process.env.RELIANCE_DISPOSABLE, 'YES', 'RELIANCE_DISPOSABLE=YES is required');
    assert(/rehearsal|checkpoint|disposable|test/i.test(identity.database), 'Disposable database name marker is missing');
  }
  const pool = await connect(process.env.DATABASE_URL);
  try {
    const observed = (await pool.request().query('SELECT DB_NAME() AS databaseName')).recordset[0].databaseName;
    assert.equal(String(observed).toLowerCase(), identity.database, 'Connected database differs from DATABASE_URL');
    const batches = fs.readFileSync(file, 'utf8').split(/^\s*GO\s*$/gim).filter((batch) => batch.trim());
    for (const batch of batches) await pool.request().batch(batch);
    console.log(JSON.stringify({ verdict: 'PASS', database: observed, sqlFile: path.basename(file), batchesExecuted: batches.length }));
  } finally {
    await pool.close();
  }
}

main().catch((error) => { console.error(`GUARDED_SQL_FAILED: ${error.message}`); process.exitCode = 2; });
