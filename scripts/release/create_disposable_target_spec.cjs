#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canonical, capture, connect, sha256 } = require('./sqlserver_contract.cjs');
const { parsePrismaSqlServerUrl } = require('./migration_safety.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };

async function main() {
  assert.equal(process.env.RELIANCE_DISPOSABLE, 'YES', 'RELIANCE_DISPOSABLE=YES is required');
  const databaseUrl = process.env.DATABASE_URL;
  const identity = parsePrismaSqlServerUrl(databaseUrl);
  assert(/checkpoint|rehearsal|disposable|test/i.test(identity.database), 'Database name lacks disposable marker');
  const resourceId = value('--resource-id');
  assert(resourceId && /checkpoint|rehearsal|disposable|test/i.test(resourceId), 'Resource ID lacks disposable marker');
  assert(!/rg-reliance-beta-eastus/i.test(resourceId), 'Live beta resource is forbidden');
  const output = path.resolve(value('--output') || '');
  assert(value('--output') && !fs.existsSync(output), 'A new --output path is required');
  const pool = await connect(databaseUrl);
  let observed;
  try { observed = await capture(pool); } finally { await pool.close(); }
  assert.equal(String(observed.identity.databaseName).toLowerCase(), identity.database);
  const spec = {
    specVersion: 1,
    environment: 'disposable',
    server: identity.server,
    database: identity.database,
    resourceId,
    expectedStates: {
      preCutover: {
        captureVersion: 1,
        structuralSha256: observed.structuralSha256,
        ledgerSha256: observed.ledgerSha256,
        ledgerRows: observed.ledgerRows,
        successfulDistinctMigrations: observed.successfulDistinctMigrations,
      },
    },
  };
  spec.sha256 = sha256(Buffer.from(canonical(spec)));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(spec, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ verdict: 'PASS', output, resourceId, structuralSha256: observed.structuralSha256,
    ledgerSha256: observed.ledgerSha256, ledgerRows: observed.ledgerRows }, null, 2));
}

main().catch((error) => { console.error(`DISPOSABLE_TARGET_SPEC_FAILED: ${error.message}`); process.exitCode = 2; });
