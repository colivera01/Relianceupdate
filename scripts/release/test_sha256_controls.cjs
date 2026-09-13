#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  assertSha256Control,
  assertSha256ControlMatch,
  validateSha256ControlObject,
} = require('./sha256_controls.cjs');

const valid = 'a'.repeat(64);
assert.equal(assertSha256Control(valid), valid);
for (const malformed of [
  'a'.repeat(63),
  'a'.repeat(65),
  'A'.repeat(64),
  `${'a'.repeat(63)}g`,
  ` ${'a'.repeat(64)}`,
  `${'a'.repeat(64)} `,
  '',
  `sha256:${'a'.repeat(64)}`,
]) assert.throws(() => assertSha256Control(malformed), /exactly 64 lowercase hexadecimal characters/);
assert.throws(() => validateSha256ControlObject({ ledgerSha256: null }), /must be a string/);

const controls = {
  structuralSha256: valid,
  ledgerSha256: valid,
  protectedEvidenceSha256: valid,
  applicationRowCountsSha256: valid,
  sourceManifestHash: valid,
  activeMigrationAggregateHash: valid,
  legacyArchiveManifestHash: valid,
  schemaHash: valid,
  artifact: { sha256: valid },
  migrationArtifact: { sha256: valid },
  receiptSha256: valid,
  generatedClientHash: { sha256: valid },
  lockfileHash: valid,
  sourceCommit: 'b'.repeat(40),
  resourceId: '/not/a/hash',
};
assert.equal(validateSha256ControlObject(controls), 13);
assert.doesNotThrow(() => assertSha256ControlMatch(valid, valid));
assert.throws(() => assertSha256ControlMatch(valid, `${'a'.repeat(63)}b`), /differs/);

console.log(JSON.stringify({ verdict: 'PASS', valid64: 'PASS', invalid63: 'FAIL_CLOSED', invalid65: 'FAIL_CLOSED',
  uppercase: 'FAIL_CLOSED', nonHex: 'FAIL_CLOSED', whitespace: 'FAIL_CLOSED', empty: 'FAIL_CLOSED',
  prefixed: 'FAIL_CLOSED', mismatch: 'FAIL_CLOSED', validatedControlClasses: 13 }));
