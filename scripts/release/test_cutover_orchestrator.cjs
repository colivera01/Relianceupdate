#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { PHASES, runCutover } = require('./cutover_orchestrator_lib.cjs');
const { SerializedRequestGate } = require('./continuous_cutover_lock.cjs');
const { normalizedTextBytes, sha256 } = require('./release_receipt_lib.cjs');

class FakeLock {
  constructor(events) { this.events = events; this.owned = false; }
  async acquire() { this.owned = true; this.events.push('lock:acquired'); return { verdict: 'LOCK_ACQUIRED' }; }
  async assertOwned() { assert(this.owned); this.events.push('lock:held'); return { verdict: 'LOCK_HELD' }; }
  async release() { assert(this.owned); this.owned = false; this.events.push('lock:released'); return { verdict: 'LOCK_RELEASED' }; }
}

async function scenario(injectFailureAfter) {
  const trace = [];
  const driver = {
    async runPhase(phase) { trace.push(`phase:${phase}`); return { phase }; },
    async runDryRun() { trace.push('dry-run'); return { validated: true }; },
    async rollback() { trace.push('rollback'); return { verdict: 'PASS' }; },
    async cleanup() { trace.push('cleanup'); },
  };
  const context = { environment: 'disposable', resourceId: 'disposable-resource' };
  process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
  try {
    return await runCutover({ mode: 'execute', context, driver, injectFailureAfter,
      lockFactory: async () => new FakeLock(trace) });
  } catch (error) {
    return { error, trace };
  }
}

async function lockLossScenario() {
  const trace = [];
  const lock = {
    owned: false,
    async acquire() { this.owned = true; trace.push('environment-and-database-locks:acquired'); return {}; },
    async assertOwned() { assert(this.owned, 'simulated original database lock loss'); return {}; },
    async release() { trace.push('lock-connections:closed'); return { verdict: 'LOCK_CONNECTION_CLOSED_AFTER_LOSS' }; },
  };
  const state = { applicationFrozen: false };
  const driver = {
    async runPhase(phase) {
      trace.push(`phase:${phase}`);
      if (phase === 'externalActorFreeze') state.applicationFrozen = true;
      if (phase === 'ledgerRotation') lock.owned = false;
      if (phase === 'externalActorUnfreeze') state.applicationFrozen = false;
      return {};
    },
    async rollback() { trace.push('rollback'); state.applicationFrozen = false; return { verdict: 'PASS' }; },
    async cleanup() { trace.push('cleanup'); },
  };
  process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
  try {
    await runCutover({ mode: 'execute', context: { environment: 'disposable', resourceId: 'disposable-resource' },
      driver, lockFactory: async () => lock });
    assert.fail('Lock-loss scenario unexpectedly passed');
  } catch (error) {
    assert.match(error.message, /simulated original database lock loss/);
    assert.equal(state.applicationFrozen, true, 'Application traffic reopened after lock loss');
    assert(!trace.includes('rollback'), 'Rollback must not switch databases after original lock loss');
    assert(!trace.includes('phase:externalActorUnfreeze'), 'Normal traffic must not unfreeze after lock loss');
    return trace;
  }
}

(async () => {
  assert.equal(sha256(normalizedTextBytes('model A {\r\n}\r\n')), sha256(normalizedTextBytes('model A {\n}\n')),
    'Release receipt text hashing must be stable across Windows and Linux line endings');
  assert.equal(sha256(normalizedTextBytes('{\r\n  "lockfileVersion": 3\r\n}\r\n')),
    sha256(normalizedTextBytes('{\n  "lockfileVersion": 3\n}\n')),
    'Release receipt lockfile hashing must be stable across Windows and Linux line endings');
  const gate = new SerializedRequestGate();
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const gatedRequest = () => gate.run(async () => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise((resolve) => setTimeout(resolve, 10));
    activeRequests -= 1;
  });
  await Promise.all([gatedRequest(), gatedRequest(), gatedRequest()]);
  assert.equal(maxActiveRequests, 1, 'Lock-session heartbeat and ownership checks must not overlap');
  const success = await scenario(null);
  assert.equal(success.verdict, 'PASS');
  assert(success.events.some((event) => event.phase === 'continuousLock'));
  for (const injectedPhase of ['ledgerRotation', 'reconciliationDeploy', 'applicationDeploy']) {
    const failure = await scenario(injectedPhase);
    assert(failure.error);
    assert(failure.trace.includes('rollback'));
    assert(failure.trace.indexOf('rollback') < failure.trace.indexOf('lock:released'));
  }
  const lockLossTrace = await lockLossScenario();
  assert(lockLossTrace.includes('lock-connections:closed'));
  assert(PHASES.includes('physicalAcceptance'));

  const dryTrace = [];
  const dryDriver = {
    async runPhase(phase) { dryTrace.push(phase); return {}; },
    async runDryRun() { dryTrace.push('dryRun'); return {}; },
    async cleanup() {},
  };
  const dry = await runCutover({ mode: 'dry-run', context: { environment: 'beta', resourceId: 'beta' }, driver: dryDriver });
  assert.equal(dry.liveMutations, 0);
  assert.equal(dry.cutoverWouldProceedIfAuthorized, true);
  assert.deepEqual(dryTrace, [...PHASES.slice(0, 5), 'dryRun']);
  console.log(JSON.stringify({ verdict: 'PASS', continuousParentLock: true, serializedHeartbeatRequests: true,
    rollbackBeforeUnlock: true, lockLossFailsClosed: true, dryRunWriteDisabled: true, phases: PHASES.length }));
})().catch((error) => { console.error(error); process.exitCode = 2; });
