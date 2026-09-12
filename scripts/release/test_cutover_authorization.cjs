#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sha256, validateAuthorization } = require('./cutover_orchestrator_lib.cjs');

const template = path.join(process.cwd(), 'config', 'release-cutover', 'authorization-template.json');
const expected = { environment: 'beta', resourceId: '/beta', candidateSha: 'a'.repeat(40), receiptSha256: 'b'.repeat(64) };
assert.throws(() => validateAuthorization({ file: template, expected }));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-auth-test-'));
try {
  const file = path.join(directory, 'authorization.json');
  const authorization = {
    authorizationVersion: 1,
    approval: 'PRODUCT_OWNER_AUTHORIZED_FORWARD_BASELINE_CUTOVER',
    environment: expected.environment,
    resourceId: expected.resourceId,
    candidateSha: expected.candidateSha,
    receiptSha256: expected.receiptSha256,
    operator: 'test operator',
    exclusiveOperatorCustodyConfirmed: true,
    proceduralResidualRiskAccepted: true,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    nonce: '00000000-0000-4000-8000-000000000001',
  };
  fs.writeFileSync(file, `${JSON.stringify(authorization, null, 2)}\n`);
  process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256 = sha256(fs.readFileSync(file));
  assert.equal(validateAuthorization({ file, expected }).verdict, 'PASS');
  process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256 = '0'.repeat(64);
  assert.throws(() => validateAuthorization({ file, expected }));
  console.log(JSON.stringify({ verdict: 'PASS', invalidTemplateBlocked: true, digestBinding: true,
    targetBinding: true, candidateBinding: true, receiptBinding: true }));
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
