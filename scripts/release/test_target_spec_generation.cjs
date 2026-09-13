#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { generate } = require('./generate_target_spec_from_evidence.cjs');
const { targetSpecEvidence } = require('./release_receipt_lib.cjs');

const valid = 'a'.repeat(64);
const template = {
  specVersion: 1,
  environment: 'beta',
  server: 'sql.example.database.windows.net',
  database: 'beta-db',
  resourceId: '/subscriptions/example/databases/beta-db',
  sha256: valid,
  expectedStates: { preCutover: { captureVersion: 1, structuralSha256: 'b'.repeat(64), ledgerSha256: 'c'.repeat(64),
    ledgerRows: 1, successfulDistinctMigrations: 1 } },
};
const evidence = { database: { serverName: 'sql.example', databaseName: 'beta-db' }, structuralSha256: 'd'.repeat(64),
  ledgerSha256: 'e'.repeat(64), ledgerRows: 64, successfulDistinctMigrations: 57 };
const first = generate({ template, evidence });
const second = generate({ template, evidence });
assert.deepEqual(first, second, 'Target generation is not deterministic');
assert.equal(first.expectedStates.preCutover.structuralSha256, evidence.structuralSha256);
assert.equal(first.expectedStates.preCutover.ledgerSha256, evidence.ledgerSha256);
assert.equal(first.expectedStates.preCutover.ledgerRows, 64);
assert.equal(first.expectedStates.preCutover.successfulDistinctMigrations, 57);
assert.throws(() => generate({ template, evidence: { ...evidence, database: { ...evidence.database, databaseName: 'other' } } }),
  /different database/);
assert.equal(typeof targetSpecEvidence, 'function');
console.log(JSON.stringify({ verdict: 'PASS', deterministic: true, reviewedEvidenceOnly: true, identityBound: true }));
