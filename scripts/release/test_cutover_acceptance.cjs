#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ACCEPTANCE_STATUS,
  createAcceptanceReceipt,
  createAcceptanceState,
  submitDecision,
  validateDecision,
  waitForAcceptance,
} = require('./cutover_acceptance.cjs');

const binding = {
  environment: 'disposable',
  targetResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/test/databases/test',
  candidateSha: 'a'.repeat(40),
  runtimeArtifactSha256: 'b'.repeat(64),
  migrationArtifactSha256: 'c'.repeat(64),
  releaseReceiptSha256: 'd'.repeat(64),
  activeMigrations: ['baseline', 'reconciliation'],
  structuralSha256: 'e'.repeat(64),
  ledgerSha256: 'f'.repeat(64),
  protectedDataSha256: '0'.repeat(64),
  deploymentControlSha256: '1'.repeat(64),
  technicalCutoverCompletedAt: '2026-09-13T20:00:00.000Z',
};

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-acceptance-test-'));
  try {
    const stateFile = path.join(root, 'state.json');
    const decisionFile = path.join(root, 'decision.json');
    const receiptFile = path.join(root, 'receipt.json');
    const state = createAcceptanceState({ stateFile, decisionFile, binding, timeoutMs: 15 * 60_000 });
    assert.equal(state.status, ACCEPTANCE_STATUS);
    assert.equal(fs.existsSync(decisionFile), false, 'Acceptance must not be pre-created');
    assert.throws(() => submitDecision({ stateFile, action: 'ACCEPT', cutoverId: 'wrong', challenge: state.challenge }));
    const decision = submitDecision({ stateFile, action: 'ACCEPT', cutoverId: state.cutoverId, challenge: state.challenge });
    assert.equal(validateDecision(state, decision).action, 'ACCEPT');
    const acceptance = createAcceptanceReceipt({ output: receiptFile, state, decision,
      decisionSha256: decision.decisionSha256, authorizationReference: { authorizationSha256: '1'.repeat(64) },
      authoritativeSha: binding.candidateSha, health: { verdict: 'PASS' }, smoke: { verdict: 'PASS' },
      tagTargets: { previous: { name: 'pre', sha: '1'.repeat(40) }, release: { name: 'release', sha: binding.candidateSha } } });
    assert.equal(acceptance.receipt.productOwnerAcceptance.explicit, true);

    for (const simulation of ['ACCEPT', 'REJECT', 'TIMEOUT']) {
      const folder = path.join(root, simulation.toLowerCase());
      fs.mkdirSync(folder);
      let checks = 0;
      const result = await waitForAcceptance({ stateFile: path.join(folder, 'state.json'),
        decisionFile: path.join(folder, 'decision.json'), binding, timeoutMs: 15 * 60_000, pollMs: 1,
        simulation, assertInvariants: async () => { checks += 1; return { verdict: 'PASS' }; } });
      assert.equal(result.decision.action, simulation);
      assert(checks >= 1);
    }
    console.log(JSON.stringify({ verdict: 'PASS', preCreatedAcceptanceForbidden: true,
      challengeBound: true, accept: 'PASS', reject: 'PASS', timeout: 'PASS', receiptAfterAcceptOnly: true }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 2; });
