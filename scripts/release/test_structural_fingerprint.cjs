#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  assertSha256Fingerprint,
  assertStructuralFingerprintMatch,
} = require('./release_receipt_lib.cjs');

const valid = 'a'.repeat(64);
assert.equal(assertSha256Fingerprint(valid), valid);

for (const malformed of ['a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(63)}G`]) {
  assert.throws(() => assertSha256Fingerprint(malformed), /exactly 64 lowercase hexadecimal characters/);
}

assert.doesNotThrow(() => assertStructuralFingerprintMatch(valid, valid));
assert.throws(
  () => assertStructuralFingerprintMatch(valid, `${'a'.repeat(63)}b`),
  /Structural fingerprint differs/,
);

console.log(JSON.stringify({
  verdict: 'PASS',
  valid64: 'PASS',
  invalid63: 'FAIL_CLOSED',
  invalid65: 'FAIL_CLOSED',
  invalidNonHex: 'FAIL_CLOSED',
  mismatch: 'FAIL_CLOSED',
}));
