#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readJson, sha256, verifyReceipt } = require('./release_receipt_lib.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
try {
  const receiptPath = path.resolve(value('--receipt') || '');
  const result = verifyReceipt(readJson(receiptPath), {
    root: path.resolve(value('--root') || process.cwd()),
    buildRoot: path.resolve(value('--build-root') || ''),
    applicationArtifact: path.resolve(value('--application-artifact') || ''),
    migrationArtifact: path.resolve(value('--migration-artifact') || ''),
    targetSpec: path.resolve(value('--target-spec') || ''),
  });
  console.log(JSON.stringify({ ...result, receiptSha256: sha256(fs.readFileSync(receiptPath)) }, null, 2));
} catch (error) {
  console.error(`RELEASE_RECEIPT_VERIFY_FAILED: ${error.message}`);
  process.exitCode = 2;
}
