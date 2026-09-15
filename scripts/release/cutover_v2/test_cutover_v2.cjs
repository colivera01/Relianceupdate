#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { activateRuntime, rollbackRuntime, runChild, verifyRemotePackage, verifyRunningRuntime } = require('./runtime_package.cjs');
const { DurableFreezeController } = require('./durable_freeze.cjs');
const { RecoveryLockHandoff } = require('./lock_handoff.cjs');
const { compareParity, REQUIRED_PROPERTIES } = require('./parity_manifest.cjs');
const { scanFiles, verifyV2ExecutionPaths } = require('./prohibited_path_guard.cjs');
const { CutoverV2Controller } = require('./cutover_v2_controller.cjs');
const { AppQuiescence } = require('./app_quiescence.cjs');
const { databaseUrlFor, validateAuthorization } = require('./orchestrator.cjs');

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
  async read({ leaseId } = {}) { if (leaseId && leaseId !== this.lease) throw new Error('lease lost'); return { ...this.document }; }
  async write(value, { leaseId }) { if (leaseId !== this.lease) throw new Error('lease lost'); this.document = { ...value }; }
  async acquireLease() { if (this.lease) throw new Error('lease already held'); this.lease = crypto.randomUUID(); return { id: this.lease }; }
  async renewLease(id) { if (id !== this.lease) throw new Error('lease lost'); }
  async releaseLease(id) { if (id !== this.lease) throw new Error('lease lost'); this.lease = null; }
  loseLease() { this.lease = null; }
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
  const runtimeState = runtimeHarness(recovery, { rejectPointer: options.rejectPointer,
    restartFailure: options.restartFailure, healthFailure: options.healthFailure });
  let frozen = false;
  const durableFreeze = {
    async freeze() { frozen = true; return { verdict: 'FROZEN' }; },
    async assertFrozen() { assert(frozen, 'not frozen'); return { verdict: 'FROZEN' }; },
    async reopen() { frozen = false; return { verdict: 'OPEN' }; },
    async inspect() { return { verdict: frozen ? 'FAIL_CLOSED' : 'OPEN' }; },
    isFrozen: () => frozen,
  };
  const lockHandoff = {
    async acquireForMutation() { return { verdict: 'PASS' }; },
    async assertMutationOwnership() { return { verdict: 'PASS' }; },
    async abandonOriginalForPitr() { return { verdict: 'PASS' }; },
    async acquireRecovery() { if (options.recoveryLockFails) throw new Error('recovery lock unavailable'); return { verdict: 'PASS' }; },
    async assertCanSwitchConnection() { return { verdict: 'PASS' }; },
  };
  const calls = { restore: 0, forwardRecovery: 0, cleanup: 0 };
  const dependencies = {
    verifySource: async () => ({ verdict: 'PASS' }),
    verifyParity: async () => ({ verdict: 'PASS', liveAndDisposableDeploymentImplementationPath: 'MATCH' }),
    verifyPackages: async () => ({ candidate: { verdict: 'PASS' }, recovery: { verdict: 'PASS' } }),
    verifyTarget: async () => ({ verdict: 'PASS' }),
    durableFreeze,
    lockHandoff,
    app: {
      freeze: async () => ({ verdict: 'PASS' }), restrictedRestart: async () => {}, restore: async () => {},
    },
    database: {
      captureRecoveryPoint: async () => '2026-09-14T00:00:00Z',
      migrate: async () => { if (options.migrationFails) throw new Error('migration failed'); return { verdict: 'PASS' }; },
      restore: async () => { calls.restore += 1; if (options.longPitr) await new Promise((resolve) => setTimeout(resolve, 20));
        return { databaseUrl: 'recovery', resourceId: '/recovery', database: 'recovery-db' }; },
      verifyRecovery: async () => ({ verdict: 'PASS' }), switchConnection: async () => ({ verdict: 'PASS' }),
    },
    runtime: runtimeState.dependencies,
    git: { promoteCandidate: async () => {}, forwardOnlyRecovery: async () => { calls.forwardRecovery += 1; } },
    verifyTechnical: async () => ({ verdict: 'PASS' }), verifyRecovered: async () => ({ verdict: 'PASS' }),
    acceptance: {
      wait: async () => ({ action: options.acceptance || 'ACCEPT' }),
      createReceipt: async () => ({ sha256: 'd'.repeat(64) }),
    },
    createRecoveryReceipt: async () => ({ sha256: 'e'.repeat(64) }),
    cleanup: async () => { calls.cleanup += 1; if (options.cleanupFails) throw new Error('cleanup failed'); return { verdict: 'PASS' }; },
  };
  const context = { operationId: 'v2-test', targetResourceId: '/target', candidateRuntime: candidate, recoveryRuntime: recovery };
  return { controller: new CutoverV2Controller({ dependencies, context }), durableFreeze, runtimeState, calls };
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
    assert.equal(result.events.at(-1).result.runtimeRecovery.runtimeRollback, 'NO-OP');
  });
  await test('08 Product Owner reject', async () => {
    const harness = controllerHarness({ acceptance: 'REJECT' });
    const result = await harness.controller.execute(); assert.equal(result.reason, 'REJECT');
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
    await freeze.freeze({ operationId: 'op', targetResourceId: '/db' });
    const original = fakeLock(); const handoff = new RecoveryLockHandoff({ durableFreeze: freeze,
      environmentSqlLock: fakeLock(), originalDatabaseLock: original, recoveryLockFactory: () => fakeLock() });
    await handoff.acquireForMutation(); original.lose(); await handoff.abandonOriginalForPitr();
    await handoff.acquireRecovery({ databaseUrl: 'x', resourceId: '/recovery' });
    assert.equal((await handoff.assertCanSwitchConnection()).verdict, 'RECOVERY_HANDOFF_VERIFIED');
  });
  await test('12 environment SQL-session loss remains fail closed', async () => {
    const store = new MemoryFreezeStore(); const freeze = new DurableFreezeController({ store, owner: 'one' });
    await freeze.freeze({ operationId: 'op', targetResourceId: '/db' });
    const environment = fakeLock(); const handoff = new RecoveryLockHandoff({ durableFreeze: freeze,
      environmentSqlLock: environment, originalDatabaseLock: fakeLock(), recoveryLockFactory: () => fakeLock() });
    await handoff.acquireForMutation(); environment.lose();
    assert.equal((await handoff.recordEnvironmentSqlLoss()).verdict, 'FAIL_CLOSED');
    assert.equal((await freeze.inspect()).verdict, 'FAIL_CLOSED');
  });
  await test('13 recovery DB lock acquisition failure', async () => {
    const store = new MemoryFreezeStore(); const freeze = new DurableFreezeController({ store, owner: 'one' });
    await freeze.freeze({ operationId: 'op', targetResourceId: '/db' });
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
    assert.equal(harness.durableFreeze.isFrozen(), true);
  });
  await test('19 second cutover actor blocked by lease', async () => {
    const store = new MemoryFreezeStore(); const one = new DurableFreezeController({ store, owner: 'one' });
    const two = new DurableFreezeController({ store, owner: 'two' });
    await one.freeze({ operationId: 'one', targetResourceId: '/db' });
    await assert.rejects(two.freeze({ operationId: 'two', targetResourceId: '/db' }), /lease already held/);
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
    await first.freeze({ operationId: 'op', targetResourceId: '/environment' });
    await first.abandonController();
    assert.equal((await first.inspect()).verdict, 'FAIL_CLOSED');
    const resumed = new DurableFreezeController({ store, owner: 'recovery' });
    const result = await resumed.resumeFrozen({
      operationId: 'op',
      targetResourceId: '/environment',
      recoveryAuthorizationSha256: '9'.repeat(64),
    });
    assert.equal(result.verdict, 'FROZEN_RESUMED');
    assert.equal((await resumed.inspect()).verdict, 'FAIL_CLOSED');
    await resumed.reopen({ acceptanceReceiptSha256: '8'.repeat(64) });
    assert.equal((await resumed.inspect()).verdict, 'OPEN');
  });
  await test('27 idempotent rollback freeze preserves original quiescence snapshot', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-quiescence-'));
    const snapshot = path.join(temporary, 'snapshot.json');
    fs.writeFileSync(snapshot, JSON.stringify({ snapshotVersion: 1, appState: 'Running' }));
    const calls = [];
    const runner = async (args) => {
      calls.push(args.join(' '));
      const command = args.join(' ');
      if (command.startsWith('webapp show ')) return JSON.stringify({ state: 'Stopped', id: '/app' });
      if (command.startsWith('webapp deployment source show ')) return JSON.stringify({ repoUrl: null, isGitHubAction: false });
      if (command.startsWith('webapp log deployment list ')) return JSON.stringify([]);
      if (command.startsWith('webapp config access-restriction show ')) return JSON.stringify({ ipSecurityRestrictions: [] });
      if (command.startsWith('webapp config appsettings list ')) return JSON.stringify([]);
      throw new Error(`Unexpected Azure fixture command: ${command}`);
    };
    try {
      process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
      const quiescence = new AppQuiescence({ subscription: 'test', resourceGroup: 'test', appService: 'test',
        snapshotFile: snapshot, operatorCidr: '127.0.0.1/32', environment: 'disposable', runner });
      const result = await quiescence.freeze();
      assert.equal(result.alreadyQuiesced, true);
      assert.equal(JSON.parse(fs.readFileSync(snapshot, 'utf8')).appState, 'Running');
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
      candidateSha: 'a'.repeat(40), candidateArtifactSha256: 'b'.repeat(64), migrationArtifactSha256: 'c'.repeat(64),
      releaseReceiptSha256: 'd'.repeat(64), appServiceResourceId: '/subscriptions/app',
      sqlServerResourceId: '/subscriptions/sql', databaseResourceId: '/subscriptions/db',
      expectedRemoteHead: 'e'.repeat(40), preStructuralSha256: 'f'.repeat(64),
      preLedgerSha256: '1'.repeat(64), preProtectedDataSha256: '2'.repeat(64),
      candidateRuntime: { requiredThrough: '2030-01-01T00:00:00.000Z' },
    };
    const authorization = { authorizationVersion: 2, approval: 'PRODUCT_OWNER_AUTHORIZED_CUTOVER_V2',
      environment: 'live', bindingSha256: '3'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z',
      nonce: '12345678-1234-1234', operator: 'Product Owner', packageValidThrough: binding.candidateRuntime.requiredThrough };
    for (const field of ['candidateSha', 'candidateArtifactSha256', 'migrationArtifactSha256', 'releaseReceiptSha256',
      'appServiceResourceId', 'sqlServerResourceId', 'databaseResourceId', 'expectedRemoteHead',
      'preStructuralSha256', 'preLedgerSha256', 'preProtectedDataSha256']) authorization[field] = binding[field];
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

  const failures = results.filter((result) => result.verdict === 'FAIL');
  process.stdout.write(`${JSON.stringify({ verdict: failures.length ? 'FAIL' : 'PASS', tests: results.length, failures, results }, null, 2)}\n`);
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => { process.stderr.write(`CUTOVER_V2_TEST_FAILED: ${error.stack}\n`); process.exitCode = 2; });
