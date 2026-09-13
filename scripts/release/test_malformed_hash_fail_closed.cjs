#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { MUTATING_PHASES, runCutover } = require('./cutover_orchestrator_lib.cjs');
const { validateSha256ControlObject } = require('./sha256_controls.cjs');

const valid = 'a'.repeat(64);

async function scenario(field) {
  const trace = [];
  const controls = { structuralSha256: valid, ledgerSha256: valid, protectedEvidenceSha256: valid };
  controls[field] = 'b'.repeat(65);
  const driver = {
    async runPhase(phase) {
      trace.push(phase);
      if (phase === (field === 'protectedEvidenceSha256' ? 'artifactValidation' : 'targetValidation')) {
        validateSha256ControlObject(controls, 'Injected pre-write controls');
      }
      return {};
    },
    async cleanup() {},
  };
  process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
  try {
    await runCutover({ mode: 'execute', context: { environment: 'disposable', resourceId: '/disposable' }, driver });
    assert.fail(`${field} unexpectedly reached execution`);
  } catch (error) {
    assert.match(error.message, /exactly 64 lowercase hexadecimal characters/);
    const mutatingReached = trace.filter((phase) => MUTATING_PHASES.has(phase));
    assert.deepEqual(mutatingReached, []);
    assert.equal(error.cutoverEvidence?.mutationOccurred, false);
    return { field, verdict: 'FAIL_CLOSED', writeCapableOperationsReached: 0 };
  }
}

(async () => {
  const results = [];
  for (const field of ['structuralSha256', 'ledgerSha256', 'protectedEvidenceSha256']) results.push(await scenario(field));
  console.log(JSON.stringify({ verdict: 'PASS', results, writeCapableOperationsReached: 0 }));
})().catch((error) => { console.error(error); process.exitCode = 2; });
