#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAzure } = require('./azure_cli.cjs');
const { capture, connect } = require('./sqlserver_contract.cjs');
const { parsePrismaSqlServerUrl } = require('./migration_safety.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const execute = args.includes('--execute');

function az(azArgs, { json = true } = {}) {
  const output = runAzure(azArgs, { label: 'Azure recovery operation' });
  return json ? JSON.parse(output || 'null') : output;
}

async function main() {
  const environment = value('--environment');
  assert(environment === 'disposable' || environment === 'beta', '--environment must be disposable or beta');
  const recoveryUrl = process.env.RELIANCE_RECOVERY_DATABASE_URL;
  assert(recoveryUrl, 'RELIANCE_RECOVERY_DATABASE_URL is required');
  const identity = parsePrismaSqlServerUrl(recoveryUrl);
  const expectedDatabase = value('--expected-database');
  assert.equal(identity.database, String(expectedDatabase || '').toLowerCase(), 'Recovery URL names the wrong database');
  assert(/restore|recovery/i.test(expectedDatabase || ''), 'Recovery database name lacks restore/recovery marker');
  const subscription = value('--subscription');
  const group = value('--resource-group');
  const server = value('--server');
  const app = value('--app');
  const expectedResourceId = String(value('--expected-resource-id') || '').toLowerCase();
  const expected = JSON.parse(fs.readFileSync(path.resolve(value('--expected-fingerprints') || ''), 'utf8'));
  const observedResource = az(['sql', 'db', 'show', '--subscription', subscription, '-g', group, '-s', server, '-n', expectedDatabase, '-o', 'json']);
  assert.equal(String(observedResource.id).toLowerCase(), expectedResourceId, 'Azure recovery database resource ID differs');
  assert.equal(String(observedResource.status).toLowerCase(), 'online', 'Recovery database is not online');
  const pool = await connect(recoveryUrl);
  let observed;
  try { observed = await capture(pool); } finally { await pool.close(); }
  assert.equal(String(observed.identity.databaseName).toLowerCase(), identity.database, 'Connected recovery database identity differs');
  assert.equal(observed.structuralSha256, expected.structuralSha256, 'Recovery structural fingerprint differs');
  assert.equal(observed.ledgerSha256, expected.ledgerSha256, 'Recovery ledger fingerprint differs');
  if (!execute) {
    console.log(JSON.stringify({ verdict: 'PASS', mode: 'DRY_RUN', database: expectedDatabase,
      resourceId: observedResource.id, structuralSha256: observed.structuralSha256, ledgerSha256: observed.ledgerSha256,
      secretPrinted: false, switchWouldProceed: true }, null, 2));
    return;
  }
  if (environment === 'beta') {
    assert.equal(process.env.RELIANCE_CUTOVER_EXECUTE, 'YES', 'Beta recovery switch requires cutover execution authorization');
    assert(process.env.RELIANCE_MIGRATION_LOCK_TOKEN, 'Beta recovery switch requires parent cutover lock');
  } else {
    assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY', 'Disposable switch requires rehearsal authorization');
  }
  az(['webapp', 'config', 'appsettings', 'set', '--subscription', subscription, '-g', group, '-n', app,
    '--settings', `DATABASE_URL=${recoveryUrl}`, '--output', 'none'], { json: false });
  az(['webapp', 'restart', '--subscription', subscription, '-g', group, '-n', app, '--output', 'none'], { json: false });
  console.log(JSON.stringify({ verdict: 'PASS', mode: 'EXECUTE', database: expectedDatabase,
    resourceId: observedResource.id, structuralSha256: observed.structuralSha256, ledgerSha256: observed.ledgerSha256,
    secretPrinted: false, applicationRestarted: true }, null, 2));
}

main().catch((error) => { console.error(`RECOVERY_CONNECTION_SWITCH_FAILED: ${error.message}`); process.exitCode = 2; });
