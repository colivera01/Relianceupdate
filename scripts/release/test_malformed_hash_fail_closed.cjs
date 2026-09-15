#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { CutoverV2Controller } = require('./cutover_v2/cutover_v2_controller.cjs');
const { validateSha256ControlObject } = require('./sha256_controls.cjs');

const valid = 'a'.repeat(64);

async function scenario(field) {
  const trace = [];
  const controls = { structuralSha256: valid, ledgerSha256: valid, protectedEvidenceSha256: valid };
  controls[field] = 'b'.repeat(65);
  const write = (name) => async () => { trace.push(name); return { verdict: 'PASS' }; };
  const controller = new CutoverV2Controller({
    context: { operationId: 'malformed-control-test' },
    dependencies: {
      verifySource: async () => validateSha256ControlObject(controls, 'Injected pre-write controls'),
      verifyParity: write('parity'),
      verifyPackages: write('packages'),
      verifyTarget: write('target'),
      app: { freeze: write('app-freeze') },
    },
  });
  await assert.rejects(controller.execute(), /exactly 64 lowercase hexadecimal characters/);
  assert.deepEqual(trace, []);
  assert.equal(controller.state.databaseMutationStarted, false);
  assert.equal(controller.state.runtimeActivationStarted, false);
  return { field, verdict: 'FAIL_CLOSED', writeCapableOperationsReached: 0 };
}

(async () => {
  const results = [];
  for (const field of ['structuralSha256', 'ledgerSha256', 'protectedEvidenceSha256']) {
    results.push(await scenario(field));
  }
  console.log(JSON.stringify({ verdict: 'PASS', results, writeCapableOperationsReached: 0 }));
})().catch((error) => { console.error(error); process.exitCode = 2; });
