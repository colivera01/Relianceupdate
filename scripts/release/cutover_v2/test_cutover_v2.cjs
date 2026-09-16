#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { activateRuntime, rollbackRuntime, runChild, setRuntimePointer,
  verifyRemotePackage, verifyRunningRuntime } = require('./runtime_package.cjs');
const { DurableFreezeController, validateJournal } = require('./durable_freeze.cjs');
const { RecoveryLockHandoff } = require('./lock_handoff.cjs');
const { compareParity, REQUIRED_PROPERTIES } = require('./parity_manifest.cjs');
const { scanFiles, verifyV2ExecutionPaths } = require('./prohibited_path_guard.cjs');
const { CutoverV2Controller, controllerLoss, durableRecoveryDatabase } = require('./cutover_v2_controller.cjs');
const { AppQuiescence, snapshotIdentity } = require('./app_quiescence.cjs');
const { assertInitialDurableControl, assertRecoveryDatabaseName, databaseUrlFor, requiredPackageThrough,
  createAcceptanceAdapter, validateAuthorization, validateExpectedDurableControl,
  verifyAcceptanceControllerWiring } = require('./orchestrator.cjs');
const { createAcceptanceReceipt, createAcceptanceState, submitDecision, validateDecision,
  waitForRecordedAcceptance } = require('./acceptance_control.cjs');
const { parseSqlServerUrl } = require('./sql_application_lock.cjs');

const results = [];
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
async function test(name, operation) {
  try {
    await operation();
    results.push({ name, verdict: 'PASS' });
  } catch (error) {
    results.push({ name, verdict: 'FAIL', error: error.message });
  }
}

const bytes = Buffer.from('reviewed-runtime-package');
const packageHash = crypto.createHash('sha256').update(bytes).digest('hex');
const reference = 'https://storage.example/runtime/candidate.zip?se=2030-01-01T00%3A00%3A00Z&sp=r&sig=A%2BB%3D%25';
const requiredThrough = '2029-12-31T00:00:00Z';
const runtime = (name, commit) => ({ reference: reference.replace('candidate.zip', name), packageName: name,
  commit, size: bytes.length, sha256: packageHash, requiredThrough });
const candidate = runtime('candidate.zip', 'a'.repeat(40));
const recovery = runtime('recovery.zip', 'b'.repeat(40));
const okPackage = async ({ reference: value }) => ({ verdict: 'PASS', sanitizedReference: value.split('?')[0],
  referenceSha256: crypto.createHash('sha256').update(value).digest('hex'), size: bytes.length, sha256: packageHash });

function acceptanceBinding(overrides = {}) {
  return {
    cutoverId: 'v2-acceptance-test', durableGeneration: 8, candidateSha: candidate.commit,
    runtimeArtifactSha256: packageHash, runtimePackageReferenceSha256: sha256(candidate.reference),
    migrationArtifactSha256: 'c'.repeat(64), releaseReceiptSha256: 'd'.repeat(64),
    structuralSha256: '1'.repeat(64), ledgerSha256: '2'.repeat(64), protectedDataSha256: '3'.repeat(64),
    deploymentControlSha256: '4'.repeat(64), durableFreezeControlSha256: '5'.repeat(64),
    parityManifestSha256: '6'.repeat(64), targetResourceId: '/subscriptions/test/app',
    activeMigrations: [{ name: 'baseline' }, { name: 'reconciliation' }],
    runtimePackageName: candidate.packageName, runtimePackageSize: candidate.size,
    technicalCutoverCompletedAt: '2026-09-16T12:00:00.000Z', environment: 'disposable',
    ...overrides,
  };
}

function decisionFor(state, overrides = {}) {
  return {
    decisionVersion: 1, action: 'ACCEPT', cutoverId: state.cutoverId, challenge: state.challenge,
    candidateSha: state.binding.candidateSha, targetResourceId: state.binding.targetResourceId,
    durableGeneration: state.binding.durableGeneration, decidedAt: '2026-09-16T12:01:00.000Z',
    explicitProductOwnerAction: true, ...overrides,
  };
}

function runtimeHarness(initial = recovery, options = {}) {
  let settings = {
    WEBSITE_RUN_FROM_PACKAGE: initial.reference,
    DEPLOYED_COMMIT: initial.commit,
    DEPLOYED_PACKAGE: initial.packageName,
  };
  const calls = { apply: 0, restart: 0 };
  return {
    calls,
    current: () => settings,
    dependencies: {
      verifyPackage: options.verifyPackage || okPackage,
      readSettings: async () => ({ ...settings }),
      applySettings: async (next) => {
        calls.apply += 1;
        if (options.rejectPointer) throw new Error('injected pointer rejection');
        settings = { WEBSITE_RUN_FROM_PACKAGE: next.reference, DEPLOYED_COMMIT: next.commit, DEPLOYED_PACKAGE: next.packageName };
      },
      restart: async () => {
        calls.restart += 1;
        if (options.restartFailure) throw new Error('injected restart failure');
      },
      health: async () => {
        if (options.healthFailure) return { ok: false };
        return { ok: true, build: { sourceCommit: settings.DEPLOYED_COMMIT, packageName: settings.DEPLOYED_PACKAGE } };
      },
    },
  };
}

class MemoryFreezeStore {
  constructor() { this.document = { version: 1, state: 'OPEN', generation: 0 }; this.lease = null; }
  async read({ leaseId } = {}) { if (leaseId && leaseId !== this.lease) throw new Error('lease lost'); return structuredClone(this.document); }
  async write(value, { leaseId }) { if (leaseId !== this.lease) throw new Error('lease lost'); this.document = structuredClone(value); }
  async acquireLease() { if (this.lease) throw new Error('lease already held'); this.lease = crypto.randomUUID(); return { id: this.lease }; }
  async renewLease(id) { if (id !== this.lease) throw new Error('lease lost'); }
  async releaseLease(id) { if (id !== this.lease) throw new Error('lease lost'); this.lease = null; }
  loseLease() { this.lease = null; }
}

function freezeContext(overrides = {}) {
  return {
    cutoverId: 'v2-test',
    expectedOpenGeneration: 0,
    targetAppServiceResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Web/sites/app',
    targetSqlServerResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/sql',
    targetDatabaseResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/sql/databases/source',
    candidateSha: 'a'.repeat(40),
    candidatePackageSha256: packageHash,
    migrationArtifactSha256: 'c'.repeat(64),
    releaseReceiptSha256: 'd'.repeat(64),
    authorizationSha256: 'e'.repeat(64),
    recoveryPackageSha256: packageHash,
    currentDatabase: {
      role: 'SOURCE',
      resourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/sql/databases/source',
      database: 'source',
      structuralSha256: '1'.repeat(64),
      ledgerSha256: '2'.repeat(64),
      protectedDataSha256: '3'.repeat(64),
      applicationRowCountsSha256: '4'.repeat(64),
      materialTableFingerprintsSha256: '5'.repeat(64),
    },
    packageState: {
      preCutover: { commit: recovery.commit, packageName: recovery.packageName, sha256: recovery.sha256,
        size: recovery.size, requiredThrough: recovery.requiredThrough, referenceSha256: sha256(recovery.reference) },
      candidate: { commit: candidate.commit, packageName: candidate.packageName, sha256: candidate.sha256,
        size: candidate.size, requiredThrough: candidate.requiredThrough, referenceSha256: sha256(candidate.reference) },
      recovery: { commit: recovery.commit, packageName: recovery.packageName, sha256: recovery.sha256,
        size: recovery.size, requiredThrough: recovery.requiredThrough, referenceSha256: sha256(recovery.reference) },
      expectedActive: 'RECOVERY',
      observedActive: 'RECOVERY_ACTIVE',
    },
    ...overrides,
  };
}

function adoptionFor(document, overrides = {}) {
  return {
    expectedGeneration: document.generation,
    expectedPhase: document.phase,
    previousControllerStatus: 'EXPLICITLY_RELINQUISHED',
    cutoverId: document.cutoverId,
    targetAppServiceResourceId: document.targetAppServiceResourceId,
    targetSqlServerResourceId: document.targetSqlServerResourceId,
    targetDatabaseResourceId: document.targetDatabaseResourceId,
    candidateSha: document.candidateSha,
    candidatePackageSha256: document.candidatePackageSha256,
    migrationArtifactSha256: document.migrationArtifactSha256,
    releaseReceiptSha256: document.releaseReceiptSha256,
    authorizationSha256: document.authorizationSha256,
    recoveryPackageSha256: document.recoveryPackageSha256,
    quiescenceSnapshot: document.quiescenceSnapshot,
    ...overrides,
  };
}

function fakeLock({ failAcquire = false } = {}) {
  let held = false;
  return {
    async acquire() { if (failAcquire) throw new Error('lock unavailable'); held = true; return { verdict: 'LOCK_ACQUIRED' }; },
    async assertOwned() { assert(held, 'lock lost'); return { verdict: 'LOCK_HELD' }; },
    async release() { held = false; return { verdict: 'LOCK_RELEASED' }; },
    lose() { held = false; },
  };
}

function parityFixture() {
  const value = {};
  for (const property of REQUIRED_PROPERTIES) {
    const parts = property.split('.');
    let target = value;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)] = property.endsWith('Sha256') ? 'c'.repeat(64) : `value:${property}`;
  }
  return value;
}

function controllerHarness(options = {}) {
  const runtimeState = runtimeHarness(options.initialRuntime || recovery, { rejectPointer: options.rejectPointer,
    restartFailure: options.restartFailure, healthFailure: options.healthFailure });
  const store = options.store || new MemoryFreezeStore();
  const durableFreeze = options.durableFreeze || new DurableFreezeController({
    store,
    owner: options.controllerId || 'controller-one',
  });
  const lockHandoff = {
    async acquireForMutation() { return { verdict: 'PASS' }; },
    async assertMutationOwnership() { return { verdict: 'PASS' }; },
    async abandonOriginalForPitr() { return { verdict: 'PASS' }; },
    async acquireRecovery() { if (options.recoveryLockFails) throw new Error('recovery lock unavailable'); return { verdict: 'PASS' }; },
    async assertCanSwitchConnection() { return { verdict: 'PASS' }; },
  };
  const calls = { restore: 0, forwardRecovery: 0, cleanup: 0, migration: 0,
    switchConnection: 0, restrictedRestart: 0 };
  const contextValue = freezeContext();
  let snapshot = options.initialSnapshot || null;
  let candidateVerified = false;
  const runtimeDependencies = {
    ...runtimeState.dependencies,
    inspect: async () => {
      const settings = runtimeState.current();
      if (settings.DEPLOYED_COMMIT === candidate.commit) return { verdict: 'PASS', state: 'CANDIDATE_ACTIVE' };
      if (settings.DEPLOYED_COMMIT === recovery.commit) return { verdict: 'PASS', state: 'RECOVERY_ACTIVE' };
      return { verdict: 'FAIL_CLOSED', state: 'UNKNOWN' };
    },
    verifyCandidate: async () => {
      candidateVerified = true;
      return { verdict: 'PASS', candidateSha: candidate.commit };
    },
    verifyRecovery: async () => ({ verdict: 'PASS', recoverySha: recovery.commit }),
  };
  const dependencies = {
    verifySource: async () => ({ verdict: 'PASS' }),
    verifyParity: async () => ({ verdict: 'PASS', liveAndDisposableDeploymentImplementationPath: 'MATCH' }),
    verifyPackages: async () => ({ candidate: { verdict: 'PASS' }, recovery: { verdict: 'PASS' } }),
    verifyTarget: async () => ({ verdict: 'PASS' }),
    durableFreeze,
    lockHandoff,
    app: {
      freeze: async ({ binding, expectedSnapshot: expected }) => {
        if (snapshot) {
          assert.deepEqual(expected, snapshot);
          assert.deepEqual(binding, snapshot.binding,
            'Resume must preserve the original immutable snapshot binding');
        }
        else snapshot = { snapshotId: 'snapshot-one', snapshotSha256: '6'.repeat(64), binding };
        return { verdict: 'PASS', snapshotId: snapshot.snapshotId, snapshotSha256: snapshot.snapshotSha256,
          snapshotBinding: snapshot.binding, originalSnapshotPreserved: true };
      },
      restrictedRestart: async ({ expectedSnapshot: expected }) => {
        calls.restrictedRestart += 1;
        assert.deepEqual(expected, snapshot);
      },
      verifyAcceptanceMode: async () => ({ verdict: 'PASS' }),
      restore: async ({ expectedSnapshot: expected }) => { assert.deepEqual(expected, snapshot); return { verdict: 'PASS' }; },
    },
    database: {
      captureRecoveryPoint: async () => ({
        recoveryTimestamp: '2026-09-14T00:00:00Z',
        sourceDatabaseResourceId: contextValue.targetDatabaseResourceId,
        structuralSha256: '1'.repeat(64), ledgerSha256: '2'.repeat(64),
        protectedDataSha256: '3'.repeat(64), applicationRowCountsSha256: '4'.repeat(64),
        materialTableFingerprintsSha256: '5'.repeat(64),
      }),
      continueMigration: async ({ journal, checkpoint, resume }) => {
        calls.migration += 1;
        if (resume && ['LEDGER_ROTATION_STARTED', 'BASELINE_RECOGNITION_STARTED', 'RECONCILIATION_STARTED'].includes(journal.phase)) {
          throw new Error('ambiguous interrupted migration phase');
        }
        let current = journal;
        for (const [from, started, complete] of [
          ['DB_MUTATION_STARTED', 'LEDGER_ROTATION_STARTED', 'LEDGER_ROTATED'],
          ['LEDGER_ROTATED', 'BASELINE_RECOGNITION_STARTED', 'BASELINE_RECOGNIZED'],
          ['BASELINE_RECOGNIZED', 'RECONCILIATION_STARTED', 'RECONCILIATION_APPLIED'],
        ]) {
          if (current.phase === from) current = await checkpoint(started, { evidence: { verdict: 'READY' } });
          if (current.phase === started) {
            if (options.migrationFails) throw new Error('migration failed');
            const patch = complete === 'RECONCILIATION_APPLIED'
              ? { currentDatabase: { ...contextValue.currentDatabase } } : {};
            current = await checkpoint(complete, { evidence: { verdict: 'PASS' }, patch });
          }
        }
        return current;
      },
      planRecovery: async () => ({ resourceId: '/subscriptions/test/recovery',
        database: 'recovery-db', providerRequestId: '7'.repeat(64) }),
      resolveRecovery: async (value) => ({ ...value, databaseUrl: 'recovery' }),
      restore: async () => { calls.restore += 1; if (options.longPitr) await new Promise((resolve) => setTimeout(resolve, 20));
        if (options.lossDuringPitr) throw controllerLoss('controller lost during PITR');
        return { databaseUrl: 'recovery', resourceId: '/subscriptions/test/recovery', database: 'recovery-db' }; },
      verifyRecovery: async () => ({ verdict: 'PASS' }),
      switchConnection: async () => { calls.switchConnection += 1; return { verdict: 'PASS' }; },
    },
    runtime: runtimeDependencies,
    git: { forwardOnlyRecovery: async () => { calls.forwardRecovery += 1; return { verdict: 'PASS' }; } },
    verifyTechnical: async () => ({ verdict: 'PASS' }), verifyRecovered: async () => ({ verdict: 'PASS' }),
    verifyResumeState: async () => ({ verdict: 'PASS' }),
    acceptance: {
      prepare: async () => ({ createdAt: '2026-09-14T00:00:00Z', expiresAt: '2030-01-01T00:00:00Z',
        challenge: '8'.repeat(64) }),
      wait: async () => ({ action: options.acceptance || 'ACCEPT' }),
      createReceipt: async () => ({ sha256: 'd'.repeat(64) }),
      resumeReceipt: async () => ({ sha256: 'd'.repeat(64) }),
    },
    createRecoveryReceipt: async () => ({ sha256: 'e'.repeat(64) }),
    cleanup: async () => { calls.cleanup += 1; if (options.cleanupFails) throw new Error('cleanup failed'); return { verdict: 'PASS' }; },
    afterCheckpoint: options.afterCheckpoint,
  };
  const context = { operationId: 'v2-test', targetResourceId: contextValue.targetAppServiceResourceId,
    candidateRuntime: candidate, recoveryRuntime: recovery, journalContext: contextValue };
  return { controller: new CutoverV2Controller({ dependencies, context }), durableFreeze, runtimeState, calls,
    store, context, dependencies, snapshot: () => snapshot, candidateVerified: () => candidateVerified };
}

async function main() {
  await test('01 exact pointer-switch happy path', async () => {
    const harness = runtimeHarness(recovery);
    const result = await activateRuntime({ runtime: candidate, ...harness.dependencies });
    assert.equal(result.activation, 'PACKAGE_POINTER'); assert.equal(harness.calls.apply, 1);
  });
  await test('02 candidate package pointer update rejection', async () => {
    const harness = runtimeHarness(recovery, { rejectPointer: true });
    await assert.rejects(activateRuntime({ runtime: candidate, ...harness.dependencies }), /pointer rejection/);
  });
  await test('03 candidate URL inaccessible', async () => {
    await assert.rejects(verifyRemotePackage({ reference, expectedSha256: packageHash, expectedSize: bytes.length,
      requiredThrough, fetchImpl: async () => ({ status: 403, arrayBuffer: async () => bytes }) }), /HTTP 403/);
  });
  await test('04 candidate local remote hash mismatch', async () => {
    await assert.rejects(verifyRemotePackage({ reference, expectedSha256: 'f'.repeat(64), expectedSize: bytes.length,
      requiredThrough, fetchImpl: async () => ({ status: 200, arrayBuffer: async () => bytes }) }), /SHA-256 differs/);
  });
  await test('05 candidate startup health failure', async () => {
    const harness = runtimeHarness(recovery, { healthFailure: true });
    await assert.rejects(activateRuntime({ runtime: candidate, ...harness.dependencies }), /health check failed/);
  });
  await test('06 database migration failure before runtime switch', async () => {
    const harness = controllerHarness({ migrationFails: true });
    const result = await harness.controller.execute(); assert.equal(result.verdict, 'RECOVERED');
    assert.equal(harness.runtimeState.calls.apply, 0);
  });
  await test('07 runtime pointer failure after database migration', async () => {
    const harness = controllerHarness({ rejectPointer: true });
    const result = await harness.controller.execute(); assert.equal(result.verdict, 'RECOVERED');
    assert.equal(harness.runtimeState.calls.apply, 1);
  });
  await test('08 Product Owner reject', async () => {
    const harness = controllerHarness({ acceptance: 'REJECT' });
    const result = await harness.controller.execute(); assert.equal(result.reason, 'REJECT');
    assert.equal(harness.calls.restrictedRestart, 2,
      'Candidate acceptance and recovered runtime must each use the restricted restart path');
  });
  await test('09 acceptance timeout', async () => {
    const harness = controllerHarness({ acceptance: 'TIMEOUT' });
    const result = await harness.controller.execute(); assert.equal(result.reason, 'TIMEOUT');
  });
  await test('10 materially long PITR remains frozen', async () => {
    const harness = controllerHarness({ acceptance: 'REJECT', longPitr: true });
    const result = await harness.controller.execute(); assert.equal(result.verdict, 'RECOVERED');
  });
  await test('11 original DB SQL-session loss during PITR', async () => {
    const store = new MemoryFreezeStore(); const freeze = new DurableFreezeController({ store, owner: 'one' });
    await freeze.freeze(freezeContext({ cutoverId: 'op' }));
    const original = fakeLock(); const handoff = new RecoveryLockHandoff({ durableFreeze: freeze,
      environmentSqlLock: fakeLock(), originalDatabaseLock: original, recoveryLockFactory: () => fakeLock() });
    await handoff.acquireForMutation(); original.lose(); await handoff.abandonOriginalForPitr();
    await handoff.acquireRecovery({ databaseUrl: 'x', resourceId: '/recovery' });
    assert.equal((await handoff.assertCanSwitchConnection()).verdict, 'RECOVERY_HANDOFF_VERIFIED');
  });
  await test('12 environment SQL-session loss remains fail closed', async () => {
    const store = new MemoryFreezeStore(); const freeze = new DurableFreezeController({ store, owner: 'one' });
    await freeze.freeze(freezeContext({ cutoverId: 'op' }));
    const environment = fakeLock(); const handoff = new RecoveryLockHandoff({ durableFreeze: freeze,
      environmentSqlLock: environment, originalDatabaseLock: fakeLock(), recoveryLockFactory: () => fakeLock() });
    await handoff.acquireForMutation(); environment.lose();
    assert.equal((await handoff.recordEnvironmentSqlLoss()).verdict, 'FAIL_CLOSED');
    assert.equal((await freeze.inspect()).verdict, 'FAIL_CLOSED');
  });
  await test('13 recovery DB lock acquisition failure', async () => {
    const store = new MemoryFreezeStore(); const freeze = new DurableFreezeController({ store, owner: 'one' });
    await freeze.freeze(freezeContext({ cutoverId: 'op' }));
    const handoff = new RecoveryLockHandoff({ durableFreeze: freeze, environmentSqlLock: fakeLock(),
      originalDatabaseLock: fakeLock(), recoveryLockFactory: () => fakeLock({ failAcquire: true }) });
    await handoff.acquireForMutation(); await handoff.abandonOriginalForPitr();
    await assert.rejects(handoff.acquireRecovery({ databaseUrl: 'x', resourceId: '/recovery' }), /unavailable/);
    assert.equal((await freeze.inspect()).verdict, 'FAIL_CLOSED');
  });
  await test('14 recovery runtime already active no-op', async () => {
    const harness = runtimeHarness(recovery);
    const result = await rollbackRuntime({ recoveryRuntime: recovery, ...harness.dependencies });
    assert.equal(result.runtimeRollback, 'NO-OP'); assert.equal(harness.calls.apply, 0);
  });
  await test('15 candidate active restores prior pointer', async () => {
    const harness = runtimeHarness(candidate);
    const result = await rollbackRuntime({ recoveryRuntime: recovery, ...harness.dependencies });
    assert.equal(result.runtimeRollback, 'PACKAGE_POINTER_RESTORED'); assert.equal(harness.calls.apply, 1);
  });
  await test('16 App Service restart failure forward', async () => {
    const harness = runtimeHarness(recovery, { restartFailure: true });
    await assert.rejects(activateRuntime({ runtime: candidate, ...harness.dependencies }), /restart failure/);
  });
  await test('17 App Service restart failure rollback', async () => {
    const harness = runtimeHarness(candidate, { restartFailure: true });
    await assert.rejects(rollbackRuntime({ recoveryRuntime: recovery, ...harness.dependencies }), /restart failure/);
  });
  await test('18 temporary firewall access cleanup failure stays frozen', async () => {
    const harness = controllerHarness({ cleanupFails: true });
    await assert.rejects(harness.controller.execute(), /cleanup failed/);
    assert.equal((await harness.durableFreeze.inspect()).verdict, 'FAIL_CLOSED');
  });
  await test('19 second cutover actor blocked by lease', async () => {
    const store = new MemoryFreezeStore(); const one = new DurableFreezeController({ store, owner: 'one' });
    const two = new DurableFreezeController({ store, owner: 'two' });
    await one.freeze(freezeContext({ cutoverId: 'one' }));
    await assert.rejects(two.freeze(freezeContext({ cutoverId: 'two' })), /lease already held/);
  });
  await test('20 SAS-shaped value remains a single opaque reference', async () => {
    const parsed = new URL(reference); assert.equal(parsed.searchParams.get('sig'), 'A+B=%');
    const verified = await verifyRemotePackage({ reference, expectedSha256: packageHash, expectedSize: bytes.length,
      requiredThrough, fetchImpl: async () => ({ status: 200, arrayBuffer: async () => bytes }) });
    assert(!verified.sanitizedReference.includes('?')); assert.match(verified.referenceSha256, /^[a-f0-9]{64}$/);
    const harness = runtimeHarness(candidate);
    const running = await verifyRunningRuntime({ runtime: candidate, ...harness.dependencies });
    assert.equal(typeof running.settings.WEBSITE_RUN_FROM_PACKAGE, 'object');
    assert(!JSON.stringify(running).includes('sig='));
  });
  await test('21 recovery package validity failure', async () => {
    const expired = reference.replace('2030-01-01', '2020-01-01');
    await assert.rejects(verifyRemotePackage({ reference: expired, expectedSha256: packageHash,
      expectedSize: bytes.length, requiredThrough,
      fetchImpl: async () => ({ status: 200, arrayBuffer: async () => bytes }) }), /expires before/);
  });
  await test('21b package reference requires a full 24-hour rollback safety buffer', async () => {
    const narrow = reference.replace('2030-01-01T00%3A00%3A00Z', '2029-12-31T23%3A00%3A00Z');
    await assert.rejects(verifyRemotePackage({ reference: narrow, expectedSha256: packageHash,
      expectedSize: bytes.length, requiredThrough,
      fetchImpl: async () => ({ status: 200, arrayBuffer: async () => bytes }) }), /expires before/);
  });
  await test('22 forward-only Git recovery contract', async () => {
    const harness = controllerHarness({ acceptance: 'REJECT' });
    const result = await harness.controller.execute(); assert.equal(result.verdict, 'RECOVERED');
    assert.equal(harness.calls.forwardRecovery, 1);
  });
  await test('23 exact implementation path and prohibited-path gate', async () => {
    const root = path.resolve(__dirname, '..', '..', '..');
    assert.equal(verifyV2ExecutionPaths(root).verdict, 'PASS');
    const fixture = parityFixture(); assert.equal(compareParity({ live: fixture, disposable: fixture }).verdict, 'PASS');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-prohibited-'));
    try {
      const file = path.join(temporary, 'bad.cjs');
      fs.writeFileSync(file, "az webapp" + " deploy");
      assert.equal(scanFiles([file]).length, 1);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });
  await test('24 long structured updater keeps lease heartbeat event loop available', async () => {
    let heartbeatObserved = false;
    const timer = setTimeout(() => { heartbeatObserved = true; }, 20);
    const result = await runChild(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 100)'], {
      cwd: process.cwd(), env: process.env,
    });
    clearTimeout(timer);
    assert.equal(result.status, 0);
    assert.equal(heartbeatObserved, true);
  });
  await test('25 Azure quiescence operations keep lease heartbeat event loop available', async () => {
    let heartbeatObserved = false;
    const timer = setTimeout(() => { heartbeatObserved = true; }, 20);
    const runner = async (args) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      const command = args.join(' ');
      if (command.startsWith('webapp show ')) return JSON.stringify({ state: 'Running', id: '/app' });
      if (command.startsWith('webapp deployment source show ')) return JSON.stringify({ repoUrl: null, isGitHubAction: false });
      if (command.startsWith('webapp log deployment list ')) return JSON.stringify([]);
      if (command.startsWith('webapp config access-restriction show ')) return JSON.stringify({ ipSecurityRestrictions: [] });
      if (command.startsWith('webapp config appsettings list ')) return JSON.stringify([]);
      throw new Error(`Unexpected Azure fixture command: ${command}`);
    };
    const quiescence = new AppQuiescence({
      subscription: 'test', resourceGroup: 'test', appService: 'test', snapshotFile: 'unused',
      operatorCidr: '127.0.0.1/32', environment: 'disposable', runner,
    });
    const result = await quiescence.dryRun();
    clearTimeout(timer);
    assert.equal(result.verdict, 'PASS');
    assert.equal(heartbeatObserved, true);
  });
  await test('26 abandoned controller can resume exact frozen operation without reopening', async () => {
    const store = new MemoryFreezeStore();
    const first = new DurableFreezeController({ store, owner: 'first' });
    await first.freeze(freezeContext({ cutoverId: 'op' }));
    await first.abandonController();
    assert.equal((await first.inspect()).verdict, 'FAIL_CLOSED');
    const resumed = new DurableFreezeController({ store, owner: 'recovery' });
    const state = (await first.inspect()).document;
    const result = await resumed.resumeFrozen(adoptionFor(state));
    assert.equal(result.verdict, 'FROZEN_ADOPTED');
    assert.equal((await resumed.inspect()).verdict, 'FAIL_CLOSED');
    assert.equal(result.document.phase, 'FROZEN');
  });
  await test('27 idempotent rollback freeze preserves original quiescence snapshot', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-quiescence-'));
    const snapshot = path.join(temporary, 'snapshot.json');
    const calls = [];
    const context = freezeContext();
    const binding = { cutoverId: context.cutoverId, controlGeneration: 1,
      targetAppServiceResourceId: context.targetAppServiceResourceId, candidateSha: context.candidateSha,
      authorizationSha256: context.authorizationSha256, cutoverCreatedAt: '2026-09-14T00:00:00Z',
      controllerId: 'controller-one', leaseGeneration: 1 };
    const runner = async (args) => {
      calls.push(args.join(' '));
      const command = args.join(' ');
      if (command.startsWith('webapp show ')) return JSON.stringify({ state: 'Stopped', id: context.targetAppServiceResourceId });
      if (command.startsWith('webapp deployment source show ')) return JSON.stringify({ repoUrl: null, isGitHubAction: false });
      if (command.startsWith('webapp log deployment list ')) return JSON.stringify([]);
      if (command.startsWith('webapp config access-restriction show ')) return JSON.stringify({ ipSecurityRestrictions: [] });
      if (command.startsWith('webapp config appsettings list ')) return JSON.stringify([]);
      if (command.startsWith('webapp stop ')) return '';
      throw new Error(`Unexpected Azure fixture command: ${command}`);
    };
    try {
      process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
      const quiescence = new AppQuiescence({ subscription: 'test', resourceGroup: 'test', appService: 'test',
        snapshotFile: snapshot, operatorCidr: '127.0.0.1/32', environment: 'disposable', runner,
        now: () => new Date('2026-09-14T00:01:00Z'), randomUUID: () => 'snapshot-one' });
      const created = await quiescence.freeze({ binding });
      const original = fs.readFileSync(snapshot);
      calls.length = 0;
      const result = await quiescence.freeze({ binding, expectedSnapshot: {
        snapshotId: created.snapshotId, snapshotSha256: created.snapshotSha256, binding,
      } });
      assert.equal(result.alreadyQuiesced, true);
      assert.deepEqual(fs.readFileSync(snapshot), original);
      assert(!calls.some((value) => value.startsWith('webapp stop ')));
    } finally {
      delete process.env.RELIANCE_REHEARSAL_AUTHORIZATION;
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
  await test('28 structured recovery URL changes only the database option', async () => {
    const original = 'sqlserver://server:1433;database=original;user=test;password=secret;encrypt=true';
    const recovered = databaseUrlFor(original, 'recovery-test');
    assert.match(recovered, /;database=recovery-test;/);
    assert.match(recovered, /;user=test;password=secret;encrypt=true$/);
  });
  await test('29 live authorization must bind the exact reviewed candidate controls', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-authorization-'));
    const file = path.join(temporary, 'authorization.json');
    const binding = {
      candidateSha: 'a'.repeat(40), candidateArtifactSha256: 'b'.repeat(64),
      recoveryArtifactSha256: '9'.repeat(64), migrationArtifactSha256: 'c'.repeat(64),
      releaseReceiptSha256: 'd'.repeat(64), appServiceResourceId: '/subscriptions/app',
      sqlServerResourceId: '/subscriptions/sql', databaseResourceId: '/subscriptions/db',
      expectedRemoteHead: 'e'.repeat(40), preStructuralSha256: 'f'.repeat(64),
      preLedgerSha256: '1'.repeat(64), preProtectedDataSha256: '2'.repeat(64),
      expectedDurableState: 'OPEN', expectedDurableGeneration: 0,
      operationId: 'cutover-v2-test',
      candidateRuntime: { requiredThrough: '2030-01-01T00:00:00.000Z' },
      recoveryRuntime: { requiredThrough: '2030-01-01T00:00:00.000Z' },
    };
    const authorization = { authorizationVersion: 2, approval: 'PRODUCT_OWNER_AUTHORIZED_CUTOVER_V2',
      environment: 'live', bindingSha256: '3'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z',
      nonce: '12345678-1234-1234', operator: 'Product Owner', packageValidThrough: binding.candidateRuntime.requiredThrough,
      recoveryPackageValidThrough: binding.recoveryRuntime.requiredThrough };
    for (const field of ['candidateSha', 'candidateArtifactSha256', 'recoveryArtifactSha256',
      'migrationArtifactSha256', 'releaseReceiptSha256',
      'appServiceResourceId', 'sqlServerResourceId', 'databaseResourceId', 'expectedRemoteHead',
      'preStructuralSha256', 'preLedgerSha256', 'preProtectedDataSha256',
      'expectedDurableState', 'expectedDurableGeneration', 'operationId']) authorization[field] = binding[field];
    try {
      fs.writeFileSync(file, JSON.stringify(authorization));
      process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256 = sha256(fs.readFileSync(file));
      assert.equal(validateAuthorization(file, binding, authorization.bindingSha256).verdict, 'PASS');
      authorization.preLedgerSha256 = '4'.repeat(64);
      fs.writeFileSync(file, JSON.stringify(authorization));
      process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256 = sha256(fs.readFileSync(file));
      assert.throws(() => validateAuthorization(file, binding, authorization.bindingSha256), /preLedgerSha256 differs/);
    } finally {
      delete process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256;
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
  await test('29b Product Owner durable OPEN generation-zero binding passes', async () => {
    const binding = { expectedDurableState: 'OPEN', expectedDurableGeneration: 0 };
    const result = assertInitialDurableControl(binding, {
      verdict: 'OPEN', document: { state: 'OPEN', generation: 0 },
    });
    assert.equal(result.stateBinding, 'PASS');
    assert.equal(result.generationBinding, 'PASS');
  });
  await test('29c authorized OPEN zero rejects actual FROZEN one before mutation', async () => {
    const binding = { expectedDurableState: 'OPEN', expectedDurableGeneration: 0 };
    assert.throws(() => assertInitialDurableControl(binding, {
      verdict: 'FAIL_CLOSED', document: { state: 'FROZEN', generation: 1 },
    }), /state differs/);
  });
  await test('29d authorized OPEN zero rejects actual OPEN one before mutation', async () => {
    const binding = { expectedDurableState: 'OPEN', expectedDurableGeneration: 0 };
    assert.throws(() => assertInitialDurableControl(binding, {
      verdict: 'OPEN', document: { state: 'OPEN', generation: 1 },
    }), /generation differs/);
  });
  await test('29e missing durable control fails closed before mutation', async () => {
    const binding = { expectedDurableState: 'OPEN', expectedDurableGeneration: 0 };
    assert.throws(() => assertInitialDurableControl(binding, null), /control blob is missing/);
  });
  await test('29f manifest missing expected durable state fails closed', async () => {
    assert.throws(() => validateExpectedDurableControl({ expectedDurableGeneration: 0 }),
      /expected durable state/);
  });
  await test('29g manifest missing expected durable generation fails closed', async () => {
    assert.throws(() => validateExpectedDurableControl({ expectedDurableState: 'OPEN' }),
      /expected durable generation/);
  });

  const snapshotCases = [
    ['30 snapshot from another cutover fails closed', (document) => { document.binding.cutoverId = 'other-cutover'; }],
    ['31 snapshot from another App Service fails closed', (document) => {
      document.binding.targetAppServiceResourceId = '/subscriptions/test/resourceGroups/test/providers/Microsoft.Web/sites/other';
    }],
    ['32 same filename with modified content fails closed', (document) => { document.preCutoverState.appState = 'Tampered'; }, true],
    ['33 snapshot with wrong generation fails closed', (document) => { document.binding.controlGeneration += 1; }],
    ['34 snapshot with wrong candidate fails closed', (document) => { document.binding.candidateSha = 'b'.repeat(40); }],
    ['35 stale snapshot predating cutover fails closed', (document) => { document.createdAt = '2026-09-13T23:59:59Z'; }],
  ];
  for (const [name, mutate, expectOriginalHash = false] of snapshotCases) {
    await test(name, async () => {
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-snapshot-negative-'));
      const file = path.join(temporary, 'snapshot.json');
      const context = freezeContext();
      const binding = { cutoverId: context.cutoverId, controlGeneration: 1,
        targetAppServiceResourceId: context.targetAppServiceResourceId, candidateSha: context.candidateSha,
        authorizationSha256: context.authorizationSha256, cutoverCreatedAt: '2026-09-14T00:00:00Z',
        controllerId: 'controller-one', leaseGeneration: 1 };
      const document = { snapshotVersion: 2, snapshotId: 'snapshot-one', createdAt: '2026-09-14T00:01:00Z',
        binding: structuredClone(binding), preCutoverState: { appId: context.targetAppServiceResourceId,
          appState: 'Running', source: {}, deployments: [], restrictions: { ipSecurityRestrictions: [] },
          acceptanceReadOnly: { present: false, value: null } } };
      const original = snapshotIdentity(document);
      mutate(document);
      const modified = snapshotIdentity(document);
      fs.writeFileSync(file, modified.bytes);
      const quiescence = new AppQuiescence({ subscription: 'test', resourceGroup: 'test', appService: 'test',
        snapshotFile: file, operatorCidr: '127.0.0.1/32', environment: 'disposable',
        runner: async () => { throw new Error('Azure must not be reached for an invalid snapshot'); },
        now: () => new Date('2026-09-14T00:02:00Z') });
      try {
        assert.throws(() => quiescence.readAndVerifySnapshot({ expected: {
          snapshotId: original.snapshotId,
          snapshotSha256: expectOriginalHash ? original.snapshotSha256 : modified.snapshotSha256,
          binding,
        } }));
      } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
    });
  }
  await test('36 duplicate snapshot creation without exact journal identity fails closed', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-snapshot-duplicate-'));
    const file = path.join(temporary, 'snapshot.json');
    const context = freezeContext();
    const binding = { cutoverId: context.cutoverId, controlGeneration: 1,
      targetAppServiceResourceId: context.targetAppServiceResourceId, candidateSha: context.candidateSha,
      authorizationSha256: context.authorizationSha256, cutoverCreatedAt: '2026-09-14T00:00:00Z',
      controllerId: 'controller-one', leaseGeneration: 1 };
    fs.writeFileSync(file, '{}');
    process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
    const quiescence = new AppQuiescence({ subscription: 'test', resourceGroup: 'test', appService: 'test',
      snapshotFile: file, operatorCidr: '127.0.0.1/32', environment: 'disposable',
      runner: async () => { throw new Error('Azure must not be reached for an unbound duplicate'); } });
    try {
      await assert.rejects(quiescence.freeze({ binding }), /binding differs|identity is required/);
    } finally {
      delete process.env.RELIANCE_REHEARSAL_AUTHORIZATION;
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
  await test('37 missing bound snapshot fails closed', async () => {
    const file = path.join(os.tmpdir(), `missing-${crypto.randomUUID()}.json`);
    const quiescence = new AppQuiescence({ subscription: 'test', resourceGroup: 'test', appService: 'test',
      snapshotFile: file, operatorCidr: '127.0.0.1/32', environment: 'disposable' });
    assert.throws(() => quiescence.readAndVerifySnapshot({ expected: {
      snapshotId: 'missing', snapshotSha256: '6'.repeat(64), binding: {},
    } }), /missing/);
  });
  await test('38 snapshot modified after creation fails closed', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-snapshot-tamper-'));
    const file = path.join(temporary, 'snapshot.json');
    fs.writeFileSync(file, '{"tampered":true}\n');
    const quiescence = new AppQuiescence({ subscription: 'test', resourceGroup: 'test', appService: 'test',
      snapshotFile: file, operatorCidr: '127.0.0.1/32', environment: 'disposable' });
    try {
      assert.throws(() => quiescence.readAndVerifySnapshot({ expected: {
        snapshotId: 'snapshot-one', snapshotSha256: '6'.repeat(64), binding: {},
      } }), /hash differs/);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  const adoptionMismatches = [
    ['39 wrong cutover adoption denied', { cutoverId: 'wrong' }],
    ['40 wrong candidate adoption denied', { candidateSha: 'b'.repeat(40) }],
    ['41 wrong authorization adoption denied', { authorizationSha256: '9'.repeat(64) }],
    ['42 wrong App Service adoption denied', {
      targetAppServiceResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Web/sites/wrong',
    }],
    ['43 wrong database adoption denied', {
      targetDatabaseResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/sql/databases/wrong',
    }],
    ['44 wrong generation adoption denied', { expectedGeneration: 999 }],
    ['45 wrong snapshot adoption denied', {
      quiescenceSnapshot: { snapshotId: 'wrong', snapshotSha256: '9'.repeat(64), binding: {} },
    }],
    ['46 wrong artifact hash adoption denied', { migrationArtifactSha256: '9'.repeat(64) }],
  ];
  for (const [name, mismatch] of adoptionMismatches) {
    await test(name, async () => {
      const store = new MemoryFreezeStore();
      const original = new DurableFreezeController({ store, owner: 'original' });
      await original.freeze(freezeContext());
      const snapshot = { snapshotId: 'snapshot-one', snapshotSha256: '6'.repeat(64),
        binding: { cutoverId: 'v2-test' } };
      await original.checkpoint('QUIESCED', { evidence: { verdict: 'PASS' },
        patch: { quiescenceSnapshot: snapshot } });
      await original.abandonController();
      const document = (await original.inspect()).document;
      const adopter = new DurableFreezeController({ store, owner: 'adopter' });
      await assert.rejects(adopter.resumeFrozen(adoptionFor(document, mismatch)));
      assert.equal((await adopter.inspect()).verdict, 'FAIL_CLOSED');
      assert.equal((await adopter.inspect()).document.controller.id, 'original');
    });
  }
  await test('47 competing active controller adoption is denied', async () => {
    const store = new MemoryFreezeStore();
    const original = new DurableFreezeController({ store, owner: 'original' });
    const document = (await original.freeze(freezeContext())).document;
    const adopter = new DurableFreezeController({ store, owner: 'adopter' });
    await assert.rejects(adopter.resumeFrozen(adoptionFor(document, {
      previousControllerStatus: 'LEASE_EXPIRED',
    })), /lease already held/);
    assert.equal((await original.inspect()).verdict, 'FAIL_CLOSED');
  });

  async function resumeAfterLoss(first, options = {}) {
    await first.durableFreeze.abandonController();
    const frozen = (await first.durableFreeze.inspect()).document;
    const adopter = new DurableFreezeController({ store: first.store, owner: 'replacement' });
    await adopter.resumeFrozen(adoptionFor(frozen));
    const second = controllerHarness({ store: first.store, durableFreeze: adopter,
      initialSnapshot: frozen.quiescenceSnapshot,
      initialRuntime: options.initialRuntime || (frozen.packageState.expectedActive === 'CANDIDATE' ? candidate : recovery),
      acceptance: options.acceptance,
    });
    return { frozen, second, result: await second.controller.resume() };
  }

  await test('48 controller-loss A resumes exact frozen pre-mutation operation', async () => {
    const first = controllerHarness({ afterCheckpoint: async (phase) => {
      if (phase === 'FROZEN') throw controllerLoss('loss A');
    } });
    await assert.rejects(first.controller.execute(), /loss A/);
    const frozenBeforeAdoption = (await first.durableFreeze.inspect()).document;
    assert(first.snapshot(), 'Application must be quiesced before the durable FROZEN checkpoint is observable');
    assert.deepEqual(frozenBeforeAdoption.quiescenceSnapshot, first.snapshot(),
      'Durable FROZEN journal must bind the already-applied application quiescence snapshot');
    const resumed = await resumeAfterLoss(first);
    assert.equal(resumed.result.verdict, 'ACCEPTED');
    assert.equal(resumed.result.journal.cutoverId, 'v2-test');
  });
  await test('49 controller-loss B skips completed database mutation', async () => {
    const first = controllerHarness({ afterCheckpoint: async (phase) => {
      if (phase === 'RECONCILIATION_APPLIED') throw controllerLoss('loss B');
    } });
    await assert.rejects(first.controller.execute(), /loss B/);
    const resumed = await resumeAfterLoss(first);
    assert.equal(resumed.result.verdict, 'ACCEPTED');
    assert.equal(resumed.second.calls.migration, 0);
  });
  await test('50 controller-loss C resumes existing PITR without a second cutover', async () => {
    const first = controllerHarness({ acceptance: 'REJECT', lossDuringPitr: true });
    await assert.rejects(first.controller.execute(), /during PITR/);
    const resumed = await resumeAfterLoss(first, { initialRuntime: candidate, acceptance: 'REJECT' });
    assert.equal(resumed.frozen.phase, 'PITR_IN_PROGRESS');
    assert.equal(resumed.result.verdict, 'RECOVERED');
    assert.equal(resumed.second.calls.restore, 1);
  });
  await test('51 controller-loss D preserves original acceptance challenge and deadline', async () => {
    const first = controllerHarness({ afterCheckpoint: async (phase) => {
      if (phase === 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE') throw controllerLoss('loss D');
    } });
    await assert.rejects(first.controller.execute(), /loss D/);
    await first.durableFreeze.abandonController();
    const frozen = (await first.durableFreeze.inspect()).document;
    const acceptance = structuredClone(frozen.acceptance);
    assert.equal(first.calls.restrictedRestart, 1,
      'Candidate must already be in restricted read-only acceptance mode before controller loss');
    const adopter = new DurableFreezeController({ store: first.store, owner: 'replacement' });
    await adopter.resumeFrozen(adoptionFor(frozen));
    const second = controllerHarness({ store: first.store, durableFreeze: adopter,
      initialSnapshot: frozen.quiescenceSnapshot, initialRuntime: candidate, acceptance: 'REJECT' });
    const result = await second.controller.resume();
    assert.equal(result.verdict, 'RECOVERED');
    const waitingEvent = result.journal.events.find((event) => event.phase === 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE');
    assert.equal(waitingEvent.evidence.challengeSha256, acceptance.challenge);
    assert.equal(waitingEvent.evidence.expiresAt, acceptance.expiresAt);
  });
  await test('52 durable lease loss never changes FROZEN to OPEN', async () => {
    const store = new MemoryFreezeStore();
    const controller = new DurableFreezeController({ store, owner: 'original' });
    await controller.freeze(freezeContext());
    store.loseLease();
    await controller.renew();
    const inspected = await controller.inspect();
    assert.equal(inspected.verdict, 'FAIL_CLOSED');
    assert.equal(inspected.document.state, 'FROZEN');
    assert.equal(inspected.document.phase, 'FROZEN');
  });
  await test('53 impossible phase transition remains fail closed', async () => {
    const store = new MemoryFreezeStore();
    const controller = new DurableFreezeController({ store, owner: 'original' });
    await controller.freeze(freezeContext());
    await assert.rejects(controller.checkpoint('CANDIDATE_STARTED', {
      evidence: { verdict: 'PASS' },
    }), /Impossible durable transition/);
    assert.equal((await controller.inspect()).document.phase, 'FROZEN');
  });
  await test('54 missing checkpoint evidence remains fail closed', async () => {
    const store = new MemoryFreezeStore();
    const controller = new DurableFreezeController({ store, owner: 'original' });
    await controller.freeze(freezeContext());
    await assert.rejects(controller.checkpoint('QUIESCED'), /evidence is required/);
    assert.equal((await controller.inspect()).document.phase, 'FROZEN');
  });
  await test('55 wrong SQL server adoption is denied', async () => {
    const store = new MemoryFreezeStore();
    const original = new DurableFreezeController({ store, owner: 'original' });
    await original.freeze(freezeContext());
    await original.abandonController();
    const document = (await original.inspect()).document;
    const adopter = new DurableFreezeController({ store, owner: 'adopter' });
    await assert.rejects(adopter.resumeFrozen(adoptionFor(document, {
      targetSqlServerResourceId: '/subscriptions/test/resourceGroups/test/providers/Microsoft.Sql/servers/wrong',
    })), /targetSqlServerResourceId differs/);
  });
  await test('56 wrong recovery package adoption is denied', async () => {
    const store = new MemoryFreezeStore();
    const original = new DurableFreezeController({ store, owner: 'original' });
    await original.freeze(freezeContext());
    await original.abandonController();
    const document = (await original.inspect()).document;
    const adopter = new DurableFreezeController({ store, owner: 'adopter' });
    await assert.rejects(adopter.resumeFrozen(adoptionFor(document, {
      recoveryPackageSha256: '9'.repeat(64),
    })), /recoveryPackageSha256 differs/);
  });
  await test('57 executable orchestrator exposes dry-run execute and resume adoption modes', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'orchestrator.cjs'), 'utf8');
    assert.match(source, /args\.includes\('--dry-run'\)/);
    assert.match(source, /args\.includes\('--execute'\)/);
    assert.match(source, /args\.includes\('--resume'\).*--adopt/s);
    assert.match(source, /resumeFrozen/);
  });
  await test('58 package requirement includes acceptance and worst-case recovery windows', async () => {
    const value = requiredPackageThrough({
      plannedCutoverEndsAt: '2026-09-15T00:00:00Z',
      acceptanceWindowMinutes: 30,
      worstCaseRecoveryMinutes: 240,
    });
    assert.equal(value.toISOString(), '2026-09-15T04:30:00.000Z');
  });
  await test('59 SQL application lock pool uses a driver-valid idle timeout', async () => {
    const parsed = parseSqlServerUrl('sqlserver://example.database.windows.net:1433;database=reliance-disposable;user=test;password=test;encrypt=true');
    assert.equal(parsed.pool.idleTimeoutMillis, 30000);
    assert(parsed.pool.idleTimeoutMillis > 0);
  });
  await test('60 frozen runtime pointer update does not restart or call health', async () => {
    const harness = runtimeHarness(recovery, { healthFailure: true, restartFailure: true });
    const result = await setRuntimePointer({ runtime: candidate, ...harness.dependencies });
    assert.equal(result.activation, 'PACKAGE_POINTER_SET_WHILE_APP_FROZEN');
    assert.equal(harness.calls.apply, 1);
    assert.equal(harness.calls.restart, 0);
  });
  await test('61 recovery database names must be unambiguously marked', async () => {
    assert.equal(assertRecoveryDatabaseName('reliance-v2-recovery-op1'), 'reliance-v2-recovery-op1');
    await assert.rejects(async () => assertRecoveryDatabaseName('reliance-v2-op1'),
      /unambiguously marked/);
  });
  await test('62 resumed PITR checks Azure provider history before any duplicate restore', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'orchestrator.cjs'), 'utf8');
    assert.match(source, /monitor', 'activity-log', 'list'/);
    assert.match(source, /no accepted Azure PITR operation exists; duplicate restore is forbidden/);
    assert.match(source, /binding\.worstCaseRecoveryMinutes \* 60_000/);
  });
  await test('63 controller exit stops lease renewal and closes local SQL connections', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'cutover_v2_controller.cjs'), 'utf8');
    assert.match(source, /closeLocalConnectionsForControllerExit/);
    assert.match(source, /stopControllerHeartbeat/);
  });
  await test('64 durable recovery database excludes connection values', async () => {
    const durable = durableRecoveryDatabase({ database: 'reliance-recovery',
      resourceId: '/subscriptions/test/recovery', providerRequestId: '7'.repeat(64),
      databaseUrl: 'sqlserver://secret' }, 'VERIFIED');
    assert.equal(Object.hasOwn(durable, 'databaseUrl'), false);
    const store = new MemoryFreezeStore();
    const controller = new DurableFreezeController({ store, owner: 'controller' });
    const document = (await controller.freeze(freezeContext())).document;
    document.recoveryDatabase = { ...durable, databaseUrl: 'sqlserver://secret' };
    assert.throws(() => validateJournal(document), /must not persist a connection value/);
  });

  await test('65 acceptance wait does not immediately time out and explicit ACCEPT creates receipt', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-acceptance-'));
    const stateFile = path.join(temporary, 'state.json');
    const decisionFile = path.join(temporary, 'decision.json');
    const receiptFile = path.join(temporary, 'receipt.json');
    let current = new Date('2026-09-16T12:00:00.000Z');
    try {
      const state = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => current });
      let sleeps = 0;
      const result = await waitForRecordedAcceptance({ stateFile, decisionFile, state, pollMs: 1,
        now: () => current, assertInvariants: async () => ({ verdict: 'PASS' }), sleep: async () => {
          sleeps += 1; current = new Date('2026-09-16T12:01:00.000Z');
          submitDecision({ stateFile, action: 'ACCEPT', cutoverId: state.cutoverId,
            challenge: state.challenge, now: () => current });
        } });
      assert.equal(sleeps, 1, 'Acceptance wait returned before polling for a decision');
      assert.equal(result.decision.action, 'ACCEPT');
      const receipt = createAcceptanceReceipt({ output: receiptFile, state, decision: result.decision,
        decisionSha256: result.decisionSha256, authorizationReference: 'authorization',
        authoritativeSha: candidate.commit, health: { verdict: 'PASS' }, smoke: { verdict: 'PASS' },
        tagTargets: { candidate: candidate.commit } });
      assert.equal(receipt.receipt.productOwnerAcceptance.explicit, true);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('66 explicit REJECT returns no acceptance receipt', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-reject-'));
    const stateFile = path.join(temporary, 'state.json'); const decisionFile = path.join(temporary, 'decision.json');
    try {
      const current = new Date('2026-09-16T12:01:00.000Z');
      const state = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => new Date('2026-09-16T12:00:00.000Z') });
      submitDecision({ stateFile, action: 'REJECT', cutoverId: state.cutoverId,
        challenge: state.challenge, now: () => current });
      const result = await waitForRecordedAcceptance({ stateFile, decisionFile, state,
        now: () => current, assertInvariants: async () => ({ verdict: 'PASS' }) });
      assert.equal(result.decision.action, 'REJECT');
      assert.equal(fs.existsSync(path.join(temporary, 'receipt.json')), false);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('67 actual original deadline produces TIMEOUT without a receipt', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-timeout-'));
    const stateFile = path.join(temporary, 'state.json'); const decisionFile = path.join(temporary, 'decision.json');
    try {
      const state = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => new Date('2026-09-16T12:00:00.000Z') });
      const result = await waitForRecordedAcceptance({ stateFile, decisionFile, state,
        now: () => new Date('2026-09-16T12:30:00.001Z'),
        assertInvariants: async () => ({ verdict: 'PASS' }) });
      assert.equal(result.decision.action, 'TIMEOUT');
      assert.equal(result.decisionSha256, null);
      assert.equal(fs.existsSync(path.join(temporary, 'receipt.json')), false);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('68 replacement controller preserves the original challenge and deadline', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-adopt-wait-'));
    const stateFile = path.join(temporary, 'state.json'); const decisionFile = path.join(temporary, 'decision.json');
    try {
      const original = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => new Date('2026-09-16T12:00:00.000Z') });
      const adoptedState = structuredClone(original);
      submitDecision({ stateFile, action: 'REJECT', cutoverId: original.cutoverId,
        challenge: original.challenge, now: () => new Date('2026-09-16T12:10:00.000Z') });
      const result = await waitForRecordedAcceptance({ stateFile, decisionFile, state: adoptedState,
        now: () => new Date('2026-09-16T12:10:00.000Z'),
        assertInvariants: async () => ({ verdict: 'PASS', adopted: true }) });
      assert.equal(result.state.challenge, original.challenge);
      assert.equal(result.state.expiresAt, original.expiresAt);
      assert.equal(result.decision.action, 'REJECT');
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('69 wrong acceptance identity fields and stale decisions fail closed', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-negative-decision-'));
    const stateFile = path.join(temporary, 'state.json'); const decisionFile = path.join(temporary, 'decision.json');
    try {
      const state = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => new Date('2026-09-16T12:00:00.000Z') });
      const now = new Date('2026-09-16T12:05:00.000Z');
      assert.throws(() => validateDecision(state, decisionFor(state, { cutoverId: 'other' }), now), /cutover ID differs/);
      assert.throws(() => validateDecision(state, decisionFor(state, { challenge: '0'.repeat(64) }), now), /challenge differs/);
      assert.throws(() => validateDecision(state, decisionFor(state, { candidateSha: 'f'.repeat(40) }), now), /candidate differs/);
      assert.throws(() => validateDecision(state, decisionFor(state, { durableGeneration: 99 }), now), /generation differs/);
      assert.throws(() => validateDecision(state, decisionFor(state,
        { decidedAt: '2026-09-16T11:59:59.000Z' }), now), /predates/);
      assert.throws(() => validateDecision(state, decisionFor(state,
        { decidedAt: '2026-09-16T12:31:00.000Z' }), now), /after the deadline/);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('70 duplicate ACCEPT and ACCEPT after timeout are rejected', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-duplicate-accept-'));
    const stateFile = path.join(temporary, 'state.json'); const decisionFile = path.join(temporary, 'decision.json');
    try {
      const state = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => new Date('2026-09-16T12:00:00.000Z') });
      submitDecision({ stateFile, action: 'ACCEPT', cutoverId: state.cutoverId, challenge: state.challenge,
        now: () => new Date('2026-09-16T12:01:00.000Z') });
      assert.throws(() => submitDecision({ stateFile, action: 'ACCEPT', cutoverId: state.cutoverId,
        challenge: state.challenge, now: () => new Date('2026-09-16T12:02:00.000Z') }), /EEXIST/);
      fs.rmSync(decisionFile);
      assert.throws(() => submitDecision({ stateFile, action: 'ACCEPT', cutoverId: state.cutoverId,
        challenge: state.challenge, now: () => new Date('2026-09-16T12:31:00.000Z') }), /expired/);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('71 ACCEPT after rollback or wrong adoption context is rejected', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-rollback-accept-'));
    const stateFile = path.join(temporary, 'state.json'); const decisionFile = path.join(temporary, 'decision.json');
    try {
      const state = createAcceptanceState({ stateFile, decisionFile, binding: acceptanceBinding(),
        now: () => new Date('2026-09-16T12:00:00.000Z') });
      submitDecision({ stateFile, action: 'ACCEPT', cutoverId: state.cutoverId, challenge: state.challenge,
        now: () => new Date('2026-09-16T12:01:00.000Z') });
      await assert.rejects(waitForRecordedAcceptance({ stateFile, decisionFile, state,
        now: () => new Date('2026-09-16T12:01:00.000Z'),
        assertInvariants: async () => { throw new Error('Durable journal is not waiting after rollback started'); } }),
      /not waiting after rollback started/);
      await assert.rejects(waitForRecordedAcceptance({ stateFile, decisionFile, state,
        now: () => new Date('2026-09-16T12:01:00.000Z'),
        assertInvariants: async () => { throw new Error('Wrong controller adoption context'); } }),
      /Wrong controller adoption context/);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('72 live orchestrator adapter reaches WAITING and consumes explicit ACCEPT', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-adapter-'));
    fs.mkdirSync(path.join(temporary, 'prisma'));
    fs.writeFileSync(path.join(temporary, 'prisma', 'active-migration-manifest.json'), JSON.stringify({ entries: [
      { name: 'baseline', sha256: 'a'.repeat(64), bytes: 1 },
      { name: 'reconciliation', sha256: 'b'.repeat(64), bytes: 1 },
    ] }));
    let current = new Date('2026-09-16T12:00:00.000Z'); let journal; let adapter;
    const binding = { candidateSha: candidate.commit, candidateArtifactSha256: packageHash,
      migrationArtifactSha256: 'c'.repeat(64), releaseReceiptSha256: 'd'.repeat(64),
      parityManifestSha256: '6'.repeat(64), appServiceResourceId: '/subscriptions/test/app',
      candidateRuntime: candidate, acceptanceWindowMinutes: 30 };
    try {
      adapter = createAcceptanceAdapter({ root: temporary, environment: 'live', binding,
        operationId: 'v2-acceptance-test', authorizationSha256: 'e'.repeat(64),
        durableFreeze: { currentJournal: async () => structuredClone(journal) },
        app: { verifyAcceptanceMode: async () => ({ verdict: 'PASS' }) },
        runtime: { verifyCandidate: async () => ({ verdict: 'PASS' }) },
        simulation: null, now: () => current, pollMs: 1, sleep: async () => {
          current = new Date('2026-09-16T12:01:00.000Z');
          submitDecision({ stateFile: adapter.paths.stateFile, action: 'ACCEPT', cutoverId: journal.acceptance.cutoverId,
            challenge: journal.acceptance.challenge, now: () => current });
        } });
      const beforeWaiting = { generation: 7, packageState: { candidate: {
        referenceSha256: sha256(candidate.reference) } }, currentDatabase: {
        structuralSha256: '1'.repeat(64), ledgerSha256: '2'.repeat(64), protectedDataSha256: '3'.repeat(64) },
      quiescenceSnapshot: { snapshotSha256: '4'.repeat(64) } };
      const state = await adapter.prepare({}, beforeWaiting);
      journal = { ...beforeWaiting, state: 'FROZEN', phase: 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE',
        generation: 8, cutoverId: state.cutoverId, candidateSha: candidate.commit, acceptance: state };
      const decision = await adapter.wait({}, state);
      assert.equal(decision.action, 'ACCEPT');
      assert.equal(state.binding.durableGeneration, 8);
      const receipt = await adapter.createReceipt(decision, {}, state);
      assert.equal(receipt.receipt.productOwnerAcceptance.explicit, true);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('73 resumed acceptance adapter keeps the original deadline after adoption', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-adapter-resume-'));
    fs.mkdirSync(path.join(temporary, 'prisma'));
    fs.writeFileSync(path.join(temporary, 'prisma', 'active-migration-manifest.json'), JSON.stringify({ entries: [
      { name: 'baseline' }, { name: 'reconciliation' },
    ] }));
    let current = new Date('2026-09-16T12:00:00.000Z'); let journal; let replacement;
    const binding = { candidateSha: candidate.commit, candidateArtifactSha256: packageHash,
      migrationArtifactSha256: 'c'.repeat(64), releaseReceiptSha256: 'd'.repeat(64),
      parityManifestSha256: '6'.repeat(64), appServiceResourceId: '/subscriptions/test/app',
      candidateRuntime: candidate, acceptanceWindowMinutes: 30 };
    const common = { root: temporary, environment: 'live', binding, operationId: 'v2-acceptance-test',
      authorizationSha256: 'e'.repeat(64),
      durableFreeze: { currentJournal: async () => structuredClone(journal) },
      app: { verifyAcceptanceMode: async () => ({ verdict: 'PASS' }) },
      runtime: { verifyCandidate: async () => ({ verdict: 'PASS' }) }, simulation: null, pollMs: 1 };
    try {
      const original = createAcceptanceAdapter({ ...common, now: () => current });
      const beforeWaiting = { generation: 7, packageState: { candidate: {
        referenceSha256: sha256(candidate.reference) } }, currentDatabase: {
        structuralSha256: '1'.repeat(64), ledgerSha256: '2'.repeat(64), protectedDataSha256: '3'.repeat(64) },
      quiescenceSnapshot: { snapshotSha256: '4'.repeat(64) } };
      const state = await original.prepare({}, beforeWaiting);
      journal = { ...beforeWaiting, state: 'FROZEN', phase: 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE',
        generation: 9, cutoverId: state.cutoverId, candidateSha: candidate.commit, acceptance: state };
      current = new Date('2026-09-16T12:10:00.000Z');
      replacement = createAcceptanceAdapter({ ...common, now: () => current, sleep: async () => {
        submitDecision({ stateFile: replacement.paths.stateFile, action: 'REJECT', cutoverId: state.cutoverId,
          challenge: state.challenge, now: () => current });
      } });
      const decision = await replacement.wait({}, state);
      assert.equal(decision.action, 'REJECT');
      assert.equal(state.expiresAt, '2026-09-16T12:30:00.000Z');
      assert.equal(state.challenge, journal.acceptance.challenge);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });

  await test('74 live preflight reports the reviewed acceptance controller as connected', async () => {
    assert.deepEqual(verifyAcceptanceControllerWiring(), {
      verdict: 'PASS', controller: 'CONNECTED', immediateTimeoutBug: 'ABSENT',
      waitingState: 'REACHABLE', accept: 'SUPPORTED', reject: 'SUPPORTED', timeout: 'SUPPORTED',
      resumeDuringAcceptance: 'SUPPORTED', originalDeadlinePreserved: 'PASS',
    });
  });

  await test('75 live preflight rejects the legacy immediate-timeout acceptance path', async () => {
    assert.throws(() => verifyAcceptanceControllerWiring({
      adapterSource: "async function wait() { waitForRecordedAcceptance(); return { action: environment === 'disposable' ? 'REJECT' : 'TIMEOUT' }; }",
      controllerSource: "class Controller { async run() { case 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE': return this.dependencies.acceptance.wait(); } }",
      waiterSource: waitForRecordedAcceptance.toString(),
    }), /Legacy immediate-timeout acceptance path is present/);
  });

  const failures = results.filter((result) => result.verdict === 'FAIL');
  process.stdout.write(`${JSON.stringify({ verdict: failures.length ? 'FAIL' : 'PASS', tests: results.length, failures, results }, null, 2)}\n`);
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => { process.stderr.write(`CUTOVER_V2_TEST_FAILED: ${error.stack}\n`); process.exitCode = 2; });
