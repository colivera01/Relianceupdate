#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertProtectedReliance, captureApplicationEvidence } = require('./cutover_evidence.cjs');
const { capture, connect } = require('./sqlserver_contract.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const output = path.resolve(value('--output') || '');
  assert(value('--output'), '--output is required');
  assert(!fs.existsSync(output), 'Refusing to overwrite evidence');
  const pool = await connect(process.env.DATABASE_URL);
  let contract;
  let application;
  try {
    contract = await capture(pool);
    application = await captureApplicationEvidence(pool);
  } finally { await pool.close(); }
  const allowEmptyProtected = args.includes('--allow-empty-protected');
  let protectedStatus;
  if (allowEmptyProtected) {
    assert.equal(process.env.RELIANCE_DB_ENVIRONMENT, 'disposable', 'Empty protected evidence is disposable-only');
    assert(/fresh|empty|test/i.test(contract.identity.databaseName), 'Empty protected evidence requires a fresh/empty/test database');
    assert.equal(application.protectedEvidence.vendor.length, 0, 'Fresh database unexpectedly contains the protected Vendor');
    protectedStatus = { verdict: 'NOT_APPLICABLE_EMPTY_DATABASE' };
  } else protectedStatus = assertProtectedReliance(application);
  const evidence = {
    evidenceVersion: 1,
    capturedAt: new Date().toISOString(),
    database: contract.identity,
    structuralSha256: contract.structuralSha256,
    ledgerSha256: contract.ledgerSha256,
    ledgerRows: contract.ledgerRows,
    successfulDistinctMigrations: contract.successfulDistinctMigrations,
    successfulMigrationNames: contract.successfulMigrationNames,
    applicationRowCounts: application.applicationRowCounts,
    applicationRowCountsSha256: application.applicationRowCountsSha256,
    materialTableFingerprints: application.materialTableFingerprints,
    materialTableFingerprintsSha256: application.materialTableFingerprintsSha256,
    protectedEvidenceSha256: application.protectedEvidenceSha256,
    protectedStatus,
    preflight: application.preflight,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ verdict: 'PASS', output, database: contract.identity.databaseName,
    structuralSha256: contract.structuralSha256, ledgerSha256: contract.ledgerSha256,
    applicationRowCountsSha256: application.applicationRowCountsSha256,
    materialTableFingerprintsSha256: application.materialTableFingerprintsSha256,
    protectedEvidenceSha256: application.protectedEvidenceSha256 }, null, 2));
}

main().catch((error) => { console.error(`CUTOVER_EVIDENCE_FAILED: ${error.message}`); process.exitCode = 2; });
