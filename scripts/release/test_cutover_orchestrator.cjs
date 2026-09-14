#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PHASES, runCutover } = require('./cutover_orchestrator_lib.cjs');
const { SerializedRequestGate } = require('./continuous_cutover_lock.cjs');
const { normalizedTextBytes, sha256 } = require('./release_receipt_lib.cjs');

class FakeLock {
  constructor(events) { this.events = events; this.owned = false; }
  async acquire() { this.owned = true; this.events.push('lock:acquired'); return { verdict: 'LOCK_ACQUIRED' }; }
  async assertOwned() { assert(this.owned); this.events.push('lock:held'); return { verdict: 'LOCK_HELD' }; }
  async assertEnvironmentOwned() { assert(this.owned); this.events.push('environment-lock:held'); return { verdict: 'ENVIRONMENT_LOCK_HELD' }; }
  async releaseDatabaseForAcceptance() { this.events.push('database-lock:released'); return { verdict: 'DATABASE_LOCK_RELEASED_FOR_BOUNDED_ACCEPTANCE' }; }
  async reacquireDatabaseForRollback() { this.events.push('database-lock:reacquired'); return { verdict: 'DATABASE_LOCK_REACQUIRED_FOR_ROLLBACK' }; }
  async release() { assert(this.owned); this.owned = false; this.events.push('lock:released'); return { verdict: 'LOCK_RELEASED' }; }
}

const acceptanceBinding = () => ({
  environment: 'disposable', targetResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/test/databases/test',
  candidateSha: 'a'.repeat(40), runtimeArtifactSha256: 'b'.repeat(64), migrationArtifactSha256: 'c'.repeat(64),
  releaseReceiptSha256: 'd'.repeat(64), activeMigrations: ['baseline', 'reconciliation'],
  structuralSha256: 'e'.repeat(64), ledgerSha256: 'f'.repeat(64), protectedDataSha256: '0'.repeat(64),
  deploymentControlSha256: '1'.repeat(64),
  technicalCutoverCompletedAt: new Date().toISOString(),
});

async function scenario(injectFailureAfter, acceptanceSimulation = 'ACCEPT') {
  const trace = [];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-cutover-state-test-'));
  const driver = {
    state: { health: { verdict: 'PASS' }, authenticatedSmoke: { verdict: 'PASS' } },
    async runPhase(phase) { trace.push(`phase:${phase}`); return { phase }; },
    async runDryRun() { trace.push('dry-run'); return { validated: true }; },
    async rollback() { trace.push('rollback'); return { verdict: 'PASS' }; },
    async prepareAcceptance() { trace.push('acceptance:prepared'); return acceptanceBinding(); },
    async verifyAcceptanceInvariants() { trace.push('acceptance:invariants'); return { verdict: 'PASS' }; },
    async cleanup() { trace.push('cleanup'); },
  };
  const context = { environment: 'disposable', resourceId: 'disposable-resource', candidateSha: 'a'.repeat(40),
    preCutoverSha: '1'.repeat(40), tags: { previous: 'pre', release: 'release' },
    acceptanceState: path.join(temp, 'state.json'), acceptanceDecision: path.join(temp, 'decision.json'),
    acceptanceReceipt: path.join(temp, 'receipt.json'), acceptanceTimeoutMs: 15 * 60_000, acceptancePollMs: 1,
    acceptanceSimulation };
  process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
  try {
    const result = await runCutover({ mode: 'execute', context, driver, injectFailureAfter,
      lockFactory: async () => new FakeLock(trace) });
    return { ...result, trace };
  } catch (error) {
    return { error, trace };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

async function lockLossScenario() {
  const trace = [];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-lock-loss-test-'));
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
    await runCutover({ mode: 'execute', context: { environment: 'disposable', resourceId: 'disposable-resource',
      acceptanceState: path.join(temp, 'state.json'), acceptanceDecision: path.join(temp, 'decision.json'),
      acceptanceReceipt: path.join(temp, 'receipt.json') },
      driver, lockFactory: async () => lock });
    assert.fail('Lock-loss scenario unexpectedly passed');
  } catch (error) {
    assert.match(error.message, /simulated original database lock loss/);
    assert.equal(state.applicationFrozen, true, 'Application traffic reopened after lock loss');
    assert(!trace.includes('rollback'), 'Rollback must not switch databases after original lock loss');
    assert(!trace.includes('phase:externalActorUnfreeze'), 'Normal traffic must not unfreeze after lock loss');
    return trace;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
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
  assert(success.trace.includes('database-lock:released'));
  assert(success.events.some((event) => event.phase === 'physicalAcceptance' && event.verdict === 'PENDING'));
  assert(success.events.some((event) => event.phase === 'physicalAcceptance' && event.verdict === 'PASS'));
  assert(success.events.some((event) => event.phase === 'continuousLock'));
  for (const injectedPhase of ['ledgerRotation', 'reconciliationDeploy', 'applicationDeploy']) {
    const failure = await scenario(injectedPhase);
    assert(failure.error);
    assert(failure.trace.includes('rollback'));
    assert(failure.trace.indexOf('rollback') < failure.trace.indexOf('lock:released'));
  }
  for (const decision of ['REJECT', 'TIMEOUT']) {
    const rejected = await scenario(null, decision);
    assert(rejected.error);
    assert(rejected.trace.includes('database-lock:reacquired'));
    assert(rejected.trace.includes('rollback'));
    assert(!rejected.trace.includes('phase:acceptanceTags'));
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
    databaseLockReleasedForAcceptance: true, explicitAcceptRequired: true, rejectRollsBack: true,
    timeoutRollsBack: true, rollbackBeforeUnlock: true, lockLossFailsClosed: true,
    dryRunWriteDisabled: true, phases: PHASES.length }));
})().catch((error) => { console.error(error); process.exitCode = 2; });
