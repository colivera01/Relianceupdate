#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createReceipt, sha256 } = require('./release_receipt_lib.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
try {
  const options = {
    root: path.resolve(value('--root') || process.cwd()),
    buildRoot: path.resolve(value('--build-root') || ''),
    applicationArtifact: path.resolve(value('--application-artifact') || ''),
    migrationArtifact: path.resolve(value('--migration-artifact') || ''),
    testResults: path.resolve(value('--test-results') || ''),
    linuxResults: path.resolve(value('--linux-results') || ''),
    targetSpec: path.resolve(value('--target-spec') || ''),
  };
  const output = path.resolve(value('--output') || '');
  if (!value('--output') || fs.existsSync(output)) throw new Error('A new --output path is required');
  const receipt = createReceipt(options);
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
  console.log(JSON.stringify({ verdict: 'PASS', output, sourceCommit: receipt.sourceCommit, sha256: sha256(bytes) }, null, 2));
} catch (error) {
  console.error(`RELEASE_RECEIPT_CREATE_FAILED: ${error.message}`);
  process.exitCode = 2;
}
