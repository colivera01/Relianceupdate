#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canonical, sha256 } = require('./release_receipt_lib.cjs');
const { validateSha256ControlObject } = require('./sha256_controls.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };

function generate({ template, evidence }) {
  validateSha256ControlObject(evidence, 'Reviewed machine evidence');
  assert.equal(String(evidence.database?.databaseName || '').toLowerCase(), String(template.database || '').toLowerCase(),
    'Reviewed evidence names a different database');
  const observedServer = String(evidence.database?.serverName || '').toLowerCase().replace(/\.database\.windows\.net$/, '');
  const expectedServer = String(template.server || '').toLowerCase().replace(/\.database\.windows\.net$/, '');
  assert.equal(observedServer, expectedServer, 'Reviewed evidence names a different server');
  assert(Number.isInteger(evidence.ledgerRows), 'Reviewed evidence ledgerRows is missing');
  assert(Number.isInteger(evidence.successfulDistinctMigrations), 'Reviewed evidence successfulDistinctMigrations is missing');
  const output = JSON.parse(JSON.stringify(template));
  const preCutover = output.expectedStates?.preCutover;
  assert(preCutover, 'Template preCutover state is missing');
  preCutover.structuralSha256 = evidence.structuralSha256;
  preCutover.ledgerSha256 = evidence.ledgerSha256;
  preCutover.ledgerRows = evidence.ledgerRows;
  preCutover.successfulDistinctMigrations = evidence.successfulDistinctMigrations;
  const withoutHash = { ...output };
  delete withoutHash.sha256;
  output.sha256 = sha256(Buffer.from(canonical(withoutHash)));
  validateSha256ControlObject(output, 'Generated target specification');
  return output;
}

if (require.main === module) {
  try {
    const templatePath = path.resolve(value('--template') || '');
    const evidencePath = path.resolve(value('--reviewed-evidence') || '');
    const outputPath = path.resolve(value('--output') || '');
    assert(value('--template') && fs.statSync(templatePath).isFile(), '--template is required');
    assert(value('--reviewed-evidence') && fs.statSync(evidencePath).isFile(), '--reviewed-evidence is required');
    assert(value('--output') && !fs.existsSync(outputPath), 'A new --output path is required');
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const generated = generate({ template, evidence });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ verdict: 'PASS', output: outputPath, reviewedEvidenceSha256: sha256(fs.readFileSync(evidencePath)),
      targetSpecSha256: generated.sha256, ledgerRows: generated.expectedStates.preCutover.ledgerRows,
      successfulDistinctMigrations: generated.expectedStates.preCutover.successfulDistinctMigrations }));
  } catch (error) { console.error(`TARGET_SPEC_GENERATION_FAILED: ${error.message}`); process.exitCode = 2; }
}

module.exports = { generate };
