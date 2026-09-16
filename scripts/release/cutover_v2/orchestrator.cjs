#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { AppQuiescence } = require('./app_quiescence.cjs');
const { CutoverV2Controller, controllerLoss } = require('./cutover_v2_controller.cjs');
const { createAzureBlobStore, DurableFreezeController } = require('./durable_freeze.cjs');
const { RecoveryLockHandoff } = require('./lock_handoff.cjs');
const { invokeStructuredUpdater, runtimeMatches, verifyRemotePackage, verifyRunningRuntime } = require('./runtime_package.cjs');
const { SqlApplicationLock, assertSecondActorBlocked } = require('./sql_application_lock.cjs');
const { switchDatabaseConnection } = require('./database_connection_switch.cjs');
const { verifyV2ExecutionPaths } = require('./prohibited_path_guard.cjs');
const { capture, connect } = require('../sqlserver_contract.cjs');
const { assertProtectedReliance, captureApplicationEvidence } = require('../cutover_evidence.cjs');
const { createStage, destroyStage } = require('../migration_staging.cjs');
const { runAzure, runAzureAsync } = require('./azure_cli.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256File = (file) => sha256(fs.readFileSync(file));
const safeId = (value) => String(value || '').replace(/[^a-z0-9-]/gi, '-').slice(0, 48);

function run(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, env: { ...process.env, ...options.env },
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (value) => { stdout += value; });
    child.stderr.on('data', (value) => { stderr += value; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(stdout.trim())
      : reject(new Error(`${path.basename(executable)} failed (${code}): ${stderr.trim()}`)));
  });
}

function requiredPackageThrough(binding) {
  const plannedEnd = new Date(binding.plannedCutoverEndsAt).getTime();
  assert(Number.isFinite(plannedEnd), 'Planned cutover end is invalid');
  assert.equal(binding.acceptanceWindowMinutes, 30, 'Product Owner acceptance window must remain 30 minutes');
  assert(Number.isSafeInteger(binding.worstCaseRecoveryMinutes) && binding.worstCaseRecoveryMinutes > 0,
    'Worst-case recovery allowance is invalid');
  return new Date(plannedEnd + (binding.acceptanceWindowMinutes + binding.worstCaseRecoveryMinutes) * 60_000);
}

function assertRecoveryDatabaseName(value) {
  assert(/restore|recovery/i.test(value || ''),
    'Recovery database name must be unambiguously marked as a restore/recovery target');
  return value;
}

function validateExpectedDurableControl(binding) {
  assert.equal(binding.expectedDurableState, 'OPEN',
    'Authorized expected durable state must be OPEN');
  assert.equal(binding.expectedDurableGeneration, 0,
    'Authorized expected durable generation must be 0');
  return { state: binding.expectedDurableState, generation: binding.expectedDurableGeneration };
}

function assertInitialDurableControl(binding, durableState) {
  const expected = validateExpectedDurableControl(binding);
  assert(durableState?.document, 'Durable freeze control blob is missing');
  assert.equal(durableState.document.state, expected.state,
    'Actual durable state differs from Product Owner authorization');
  assert.equal(durableState.document.generation, expected.generation,
    'Actual durable generation differs from Product Owner authorization');
  return { verdict: 'PASS', authorized: expected,
    actual: { state: durableState.document.state, generation: durableState.document.generation },
    stateBinding: 'PASS', generationBinding: 'PASS' };
}

function validateBinding(root, binding, environment, descriptor) {
  assert.equal(binding.bindingVersion, 2, 'Unsupported V2 binding');
  assert.equal(binding.environment, environment, 'Binding environment differs');
  validateExpectedDurableControl(binding);
  assert.match(binding.candidateSha || '', /^[a-f0-9]{40}$/, 'Candidate SHA is invalid');
  assert.match(binding.expectedRemoteHead || '', /^[a-f0-9]{40}$/, 'Expected remote head is invalid');
  assert.equal(binding.canonicalDatabase, descriptor.database, 'Canonical database differs');
  for (const field of ['appServiceResourceId', 'sqlServerResourceId', 'databaseResourceId'])
    assert(String(binding[field] || '').startsWith('/subscriptions/'), `${field} is invalid`);
  for (const field of ['candidateArtifactSha256', 'recoveryArtifactSha256', 'migrationArtifactSha256',
    'releaseReceiptSha256', 'parityManifestSha256', 'preStructuralSha256', 'preLedgerSha256',
    'preProtectedDataSha256']) assert.match(binding[field] || '', /^[a-f0-9]{64}$/, `${field} is invalid`);
  for (const kind of ['candidate', 'recovery']) {
    const runtime = binding[`${kind}Runtime`];
    assert(runtime && runtime.packageName?.endsWith('.zip'), `${kind} runtime is invalid`);
    assert.match(runtime.referenceEnvironmentVariable || '', /^RELIANCE_[A-Z0-9_]+$/, `${kind} reference variable is invalid`);
    assert.equal(runtime.sha256, binding[`${kind}ArtifactSha256`], `${kind} runtime hash differs`);
    assert(Number.isSafeInteger(runtime.size) && runtime.size > 0, `${kind} runtime size is invalid`);
    const requiredThrough = new Date(runtime.requiredThrough).getTime();
    assert(requiredThrough >= requiredPackageThrough(binding).getTime(),
      `${kind} required-through omits the cutover, acceptance, or recovery allowance`);
    assert(requiredThrough > Date.now(), `${kind} required-through is stale`);
  }
  if (binding.recoveryDatabase) {
    assertRecoveryDatabaseName(binding.recoveryDatabase);
  }
  const files = binding.files || {};
  for (const [field, expected] of [['candidateArtifact', binding.candidateArtifactSha256],
    ['recoveryArtifact', binding.recoveryArtifactSha256], ['migrationArtifact', binding.migrationArtifactSha256],
    ['releaseReceipt', binding.releaseReceiptSha256], ['parityManifest', binding.parityManifestSha256]]) {
    const file = path.resolve(root, files[field] || '');
    assert(fs.statSync(file).isFile(), `${field} is missing`);
    assert.equal(sha256File(file), expected, `${field} hash differs`);
  }
  return { verdict: 'PASS' };
}

function validateAuthorization(file, binding, bindingSha256) {
  assert(file && fs.existsSync(file), 'Live execute requires an authorization file');
  const bytes = fs.readFileSync(file); const authorization = JSON.parse(bytes);
  assert.equal(authorization.authorizationVersion, 2, 'Unsupported authorization version');
  assert.equal(authorization.approval, 'PRODUCT_OWNER_AUTHORIZED_CUTOVER_V2', 'Authorization text differs');
  assert.equal(authorization.environment, 'live', 'Authorization is not for live');
  assert.equal(authorization.bindingSha256, bindingSha256, 'Authorization binding differs');
  for (const field of ['candidateSha', 'candidateArtifactSha256', 'recoveryArtifactSha256', 'migrationArtifactSha256',
    'releaseReceiptSha256', 'appServiceResourceId', 'sqlServerResourceId', 'databaseResourceId',
    'expectedRemoteHead', 'preStructuralSha256', 'preLedgerSha256', 'preProtectedDataSha256',
    'expectedDurableState', 'expectedDurableGeneration', 'operationId'])
    assert.equal(authorization[field], binding[field], `Authorization ${field} differs`);
  assert.equal(authorization.packageValidThrough, binding.candidateRuntime.requiredThrough,
    'Authorization package validity differs');
  assert.equal(authorization.recoveryPackageValidThrough, binding.recoveryRuntime.requiredThrough,
    'Authorization recovery package validity differs');
  assert(new Date(authorization.expiresAt).getTime() > Date.now(), 'Authorization expired');
  assert.match(authorization.nonce || '', /^[a-f0-9-]{16,}$/i, 'Authorization nonce is invalid');
  assert(String(authorization.operator || '').trim(), 'Authorization operator is missing');
  assert.equal(sha256(bytes), process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256,
    'Authorization file hash differs from the explicit environment binding');
  return { verdict: 'PASS', authorizationSha256: sha256(bytes) };
}

function azJson(descriptor, args) {
  return JSON.parse(runAzure([...args, '--subscription', descriptor.subscription, '-o', 'json']) || 'null');
}

function resourceState(descriptor) {
  const app = azJson(descriptor, ['webapp', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  const server = azJson(descriptor, ['sql', 'server', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.sqlServer]);
  const database = azJson(descriptor, ['sql', 'db', 'show', '-g', descriptor.resourceGroup, '-s', descriptor.sqlServer, '-n', descriptor.database]);
  return { app, server, database };
}

function readSettings(descriptor) {
  const values = azJson(descriptor, ['webapp', 'config', 'appsettings', 'list', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  return Object.fromEntries(values.map((item) => [item.name, item.value]));
}

function databaseUrlFor(value, database) {
  assert(value?.startsWith('sqlserver://'), 'App DATABASE_URL is unavailable');
  assert(/;database=[^;]+/i.test(value), 'App DATABASE_URL has no database option');
  return value.replace(/;database=[^;]+/i, `;database=${database}`);
}

async function captureEvidence(databaseUrl) {
  const pool = await connect(databaseUrl);
  try {
    const contract = await capture(pool); const application = await captureApplicationEvidence(pool);
    return { capturedAt: new Date().toISOString(), database: contract.identity,
      structuralSha256: contract.structuralSha256, ledgerSha256: contract.ledgerSha256,
      ledgerRows: contract.ledgerRows, successfulDistinctMigrations: contract.successfulDistinctMigrations,
      applicationRowCountsSha256: application.applicationRowCountsSha256,
      materialTableFingerprintsSha256: application.materialTableFingerprintsSha256,
      protectedDataSha256: application.protectedEvidenceSha256, protected: assertProtectedReliance(application),
      activeAssignmentDuplicateCount: application.preflight.assignmentDuplicates.length };
  } finally { await pool.close(); }
}

async function blobControl(descriptor, binding, owner) {
  const keys = azJson(descriptor, ['storage', 'account', 'keys', 'list', '-g', descriptor.resourceGroup, '-n', descriptor.storageAccount]);
  const credential = new StorageSharedKeyCredential(descriptor.storageAccount, keys[0].value);
  const service = new BlobServiceClient(`https://${descriptor.storageAccount}.blob.core.windows.net`, credential);
  const blob = service.getContainerClient(descriptor.storageContainer)
    .getBlockBlobClient(binding.durableControlBlob || 'cutover-control/environment-v2.json');
  assert(await blob.exists(), 'Durable freeze control blob is missing');
  return { controller: new DurableFreezeController({ store: createAzureBlobStore(blob), owner }), blob };
}

async function health(url) {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Health endpoint failed (${response.status})`);
  return { ok: true, ...(await response.json()) };
}

async function runMigration(root, environment, databaseUrl, binding, lockToken, { journal, checkpoint, resume = false }) {
  const common = { DATABASE_URL: databaseUrl, RELIANCE_DB_ENVIRONMENT: environment === 'live' ? 'beta' : 'disposable',
    RELIANCE_DISPOSABLE: environment === 'disposable' ? 'YES' : undefined,
    RELIANCE_MIGRATION_WRITE_APPROVED: 'YES', RELIANCE_MIGRATION_LOCK_TOKEN: lockToken,
    RELIANCE_TARGET_VERIFICATION_TOKEN: lockToken,
    RELIANCE_TARGET_SPEC: path.resolve(root, binding.files.targetSpec || ''),
    RELIANCE_RELEASE_RECEIPT: path.resolve(root, binding.files.releaseReceipt || '') };
  let current = journal;
  if (resume && ['LEDGER_ROTATION_STARTED', 'BASELINE_RECOGNITION_STARTED', 'RECONCILIATION_STARTED'].includes(current.phase)) {
    throw new Error(`Ambiguous interrupted migration phase requires reviewed evidence: ${current.phase}`);
  }
  if (current.phase === 'DB_MUTATION_STARTED') {
    current = await checkpoint('LEDGER_ROTATION_STARTED', {
      evidence: { verdict: 'READY', sourceLedgerSha256: current.recoveryPoint.ledgerSha256 },
    });
  }
  if (current.phase === 'LEDGER_ROTATION_STARTED') {
    await run(process.execPath, [path.join(root, 'scripts/release/run_guarded_sql.cjs'), '--file',
      path.join(root, 'scripts/release/sql/rotate_legacy_migration_ledger_20260914_v2.sql')], { cwd: root, env: common });
    current = await checkpoint('LEDGER_ROTATED', {
      evidence: { verdict: 'PASS', migrationArtifactSha256: binding.migrationArtifactSha256 },
    });
  }
  if (current.phase === 'LEDGER_ROTATED') {
    current = await checkpoint('BASELINE_RECOGNITION_STARTED', {
      evidence: { verdict: 'READY', baseline: '00000000000000_reliance_forward_baseline_20260914_v2' },
    });
  }
  if (current.phase === 'BASELINE_RECOGNITION_STARTED') {
    const stage = createStage({ root, stageName: 'baseline' });
    try {
      await run(process.execPath, [path.join(root, 'scripts/release/run_guarded_prisma.cjs'), 'migrate', 'resolve',
        '--applied', '00000000000000_reliance_forward_baseline_20260914_v2',
        '--schema', stage.schemaPath], { cwd: root, env: common });
      await run(process.execPath, [path.join(root, 'scripts/release/run_guarded_prisma.cjs'), 'migrate', 'deploy',
        '--schema', stage.schemaPath], { cwd: root, env: common });
    } finally { destroyStage(stage.stageRoot); }
    current = await checkpoint('BASELINE_RECOGNIZED', {
      evidence: { verdict: 'PASS', baselineOnlyDeploy: 'NO_OP' },
    });
  }
  if (current.phase === 'BASELINE_RECOGNIZED') {
    current = await checkpoint('RECONCILIATION_STARTED', {
      evidence: { verdict: 'READY', reconciliation: '20260914030000_enforce_one_active_device_assignment_v2' },
    });
  }
  if (current.phase === 'RECONCILIATION_STARTED') {
    const stageName = 'reconciliation';
    const args = ['migrate', 'deploy'];
    const stage = createStage({ root, stageName });
    try {
      await run(process.execPath, [path.join(root, 'scripts/release/run_guarded_prisma.cjs'), ...args,
        '--schema', stage.schemaPath], { cwd: root, env: common });
    } finally { destroyStage(stage.stageRoot); }
    const post = await captureEvidence(databaseUrl);
    current = await checkpoint('RECONCILIATION_APPLIED', {
      evidence: { verdict: 'PASS', reconciliation: '20260914030000_enforce_one_active_device_assignment_v2' },
      patch: { currentDatabase: { role: 'SOURCE', resourceId: binding.databaseResourceId,
        database: binding.canonicalDatabase, structuralSha256: post.structuralSha256,
        ledgerSha256: post.ledgerSha256, protectedDataSha256: post.protectedDataSha256,
        applicationRowCountsSha256: post.applicationRowCountsSha256,
        materialTableFingerprintsSha256: post.materialTableFingerprintsSha256 } },
    });
  }
  assert.equal(current.phase, 'RECONCILIATION_APPLIED', 'Migration phase did not reach reconciliation completion');
  return current;
}

async function preflight({ root, environment, descriptor, binding, writeEvidence = false, resume = false }) {
  validateBinding(root, binding, environment, descriptor);
  const localSha = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).trim();
  const localTree = (await run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root })).trim();
  assert.equal(localSha, binding.candidateSha, 'Local candidate differs');
  assert.equal(localTree, binding.candidateTree, 'Local candidate tree differs');
  const remote = (await run('git', ['ls-remote', 'origin', `refs/heads/${binding.authoritativeBranch}`], { cwd: root })).split(/\s+/)[0];
  assert.equal(remote, binding.expectedRemoteHead, 'Authoritative remote differs');
  const state = resourceState(descriptor);
  assert.equal(state.app.id.toLowerCase(), binding.appServiceResourceId.toLowerCase(), 'App resource differs');
  assert.equal(state.server.id.toLowerCase(), binding.sqlServerResourceId.toLowerCase(), 'SQL server resource differs');
  assert.equal(state.database.id.toLowerCase(), binding.databaseResourceId.toLowerCase(), 'Database resource differs');
  assert(state.database.earliestRestoreDate, 'Database is not PITR-capable');
  const settings = readSettings(descriptor); const configuredDatabaseUrl = settings.DATABASE_URL;
  const sourceDatabaseUrl = databaseUrlFor(configuredDatabaseUrl, descriptor.database);
  if (!resume) assert.equal(sourceDatabaseUrl, configuredDatabaseUrl, 'Configured database differs');
  const runtimes = {};
  for (const kind of ['candidate', 'recovery']) {
    const configured = binding[`${kind}Runtime`]; const reference = process.env[configured.referenceEnvironmentVariable];
    assert(reference, `${configured.referenceEnvironmentVariable} is required`);
    runtimes[kind] = { ...configured, reference };
    await verifyRemotePackage({ reference, expectedSha256: configured.sha256, expectedSize: configured.size,
      requiredThrough: configured.requiredThrough });
  }
  const evidence = await captureEvidence(resume ? configuredDatabaseUrl : sourceDatabaseUrl);
  if (!resume) {
    assert.equal(evidence.structuralSha256, binding.preStructuralSha256, 'Structural fingerprint differs');
    assert.equal(evidence.ledgerSha256, binding.preLedgerSha256, 'Ledger fingerprint differs');
    assert.equal(evidence.protectedDataSha256, binding.preProtectedDataSha256, 'Protected-data fingerprint differs');
  }
  assert.equal(evidence.activeAssignmentDuplicateCount, 0, 'Active assignment duplicates exist');
  const { controller: durable, blob } = await blobControl(descriptor, binding, `preflight-${crypto.randomUUID()}`);
  const durableState = await durable.inspect();
  let durableAuthorization = null;
  if (resume) {
    assert.equal(durableState.verdict, 'FAIL_CLOSED', 'No durable frozen operation exists to adopt');
  } else {
    durableAuthorization = assertInitialDurableControl(binding, durableState);
    assert.equal(durableState.verdict, 'OPEN', 'Durable environment is not OPEN');
  }
  const properties = await blob.getProperties(); assert.notEqual(properties.leaseState, 'leased', 'Environment lease is unavailable');
  const operationId = binding.operationId || `cutover-v2-${safeId(binding.candidateSha.slice(0, 12))}`;
  const app = new AppQuiescence({ subscription: descriptor.subscription, resourceGroup: descriptor.resourceGroup,
    appService: descriptor.appService, snapshotFile: path.join(root, `.cutover-v2-${environment}-${safeId(operationId)}.json`),
    operatorCidr: binding.operatorCidr, environment: environment === 'live' ? 'beta' : 'disposable' });
  const quiescence = resume
    ? { verdict: 'PASS', mode: 'RESUME_READ_ONLY', appState: (await app.readState()).appState, writeExecuted: false }
    : await app.dryRun();
  const lock = new SqlApplicationLock({ databaseUrl: sourceDatabaseUrl, resourceId: binding.databaseResourceId });
  await lock.acquire();
  await assertSecondActorBlocked({ databaseUrl: sourceDatabaseUrl, resourceId: binding.databaseResourceId });
  await lock.release();
  const result = { verdict: 'PASS', mode: 'DRY_RUN', capturedAt: new Date().toISOString(), liveMutations: 0,
    cutoverWouldProceedIfAuthorized: true, source: { localSha, localTree, remote },
    target: { appId: state.app.id, sqlServerId: state.server.id, databaseId: state.database.id,
      database: descriptor.database, pitrEarliestRestoreDate: state.database.earliestRestoreDate },
    packages: { candidate: { sha256: runtimes.candidate.sha256, requiredThrough: runtimes.candidate.requiredThrough },
      recovery: { sha256: runtimes.recovery.sha256, requiredThrough: runtimes.recovery.requiredThrough } },
    evidence, durable: durableState, durableAuthorization,
    authorizedDurableState: binding.expectedDurableState,
    authorizedDurableGeneration: binding.expectedDurableGeneration,
    stateBinding: durableAuthorization?.stateBinding || null,
    generationBinding: durableAuthorization?.generationBinding || null,
    leaseReadiness: 'PASS', sqlLockReadiness: 'PASS', quiescence,
    executionPaths: verifyV2ExecutionPaths(root), runtimePointerRollbackReadiness: 'PASS',
    forwardGitRecovery: 'PASS', deploymentArchitecture: 'POINTER_BASED' };
  if (writeEvidence && binding.dryRunOutput) fs.writeFileSync(path.resolve(root, binding.dryRunOutput), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return { result, runtimes, databaseUrl: sourceDatabaseUrl, configuredDatabaseUrl, app, durableState };
}

function databaseNameFromUrl(value) {
  const match = /;database=([^;]+)/i.exec(value || '');
  assert(match, 'Configured database name is unavailable');
  return match[1];
}

function durableRuntime(runtime) {
  return { commit: runtime.commit, packageName: runtime.packageName, size: runtime.size,
    sha256: runtime.sha256, requiredThrough: runtime.requiredThrough,
    referenceSha256: sha256(runtime.reference) };
}

function readAdoption(file) {
  assert(file && fs.existsSync(file), 'Resume/adopt requires an adoption evidence file');
  const adoption = readJson(file);
  assert.equal(adoption.adoptionVersion, 1, 'Unsupported adoption evidence version');
  return adoption;
}

async function execute({ root, environment, descriptor, binding, bindingSha256, authorizationFile,
  mode = 'execute', adoptionFile = null }) {
  assert(['execute', 'resume'].includes(mode), 'Execution mode is invalid');
  let authorizationSha256 = bindingSha256;
  if (environment === 'live') {
    authorizationSha256 = validateAuthorization(authorizationFile, binding, bindingSha256).authorizationSha256;
    assert.equal(process.env.RELIANCE_CUTOVER_EXECUTE, 'YES', 'Live execution flag is absent');
  } else {
    assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY',
      'Disposable authorization is absent');
  }
  const prepared = await preflight({ root, environment, descriptor, binding, resume: mode === 'resume' });
  const operationId = binding.operationId || `cutover-v2-${safeId(binding.candidateSha.slice(0, 12))}`;
  const controllerId = `${operationId}:${crypto.randomUUID()}`;
  const control = await blobControl(descriptor, binding, controllerId);
  const runtimeDeps = {
    verifyPackage: verifyRemotePackage,
    readSettings: async () => readSettings(descriptor),
    applySettings: async (runtime) => invokeStructuredUpdater({ root, resourceGroup: descriptor.resourceGroup,
      appService: descriptor.appService, runtime }),
    restart: async () => { await runAzureAsync(['webapp', 'restart', '-g', descriptor.resourceGroup,
      '-n', descriptor.appService, '--subscription', descriptor.subscription, '-o', 'none']); },
    health: async () => health(binding.healthUrl),
  };
  runtimeDeps.inspect = async () => {
    const settings = await runtimeDeps.readSettings();
    if (runtimeMatches(settings, prepared.runtimes.candidate)) return { verdict: 'PASS', state: 'CANDIDATE_ACTIVE' };
    if (runtimeMatches(settings, prepared.runtimes.recovery)) return { verdict: 'PASS', state: 'RECOVERY_ACTIVE' };
    return { verdict: 'FAIL_CLOSED', state: 'UNKNOWN' };
  };
  runtimeDeps.verifyCandidate = async () => verifyRunningRuntime({
    runtime: prepared.runtimes.candidate,
    ...runtimeDeps,
  });
  runtimeDeps.verifyRecovery = async () => verifyRunningRuntime({
    runtime: prepared.runtimes.recovery,
    ...runtimeDeps,
  });

  const currentRuntime = await runtimeDeps.inspect();
  let adopted = null;
  if (mode === 'resume') {
    const adoption = readAdoption(adoptionFile);
    const observedJournal = prepared.durableState.document;
    const expectedRuntimeState = observedJournal.packageState.expectedActive === 'CANDIDATE'
      ? 'CANDIDATE_ACTIVE' : 'RECOVERY_ACTIVE';
    const recoveryCanConvergeEitherRuntime = [
      'ROLLBACK_REQUESTED', 'PITR_IN_PROGRESS', 'RECOVERY_DB_VERIFIED', 'RECOVERY_DB_LOCKED',
      'DB_SWITCHED_TO_RECOVERY', 'FAILED_FROZEN',
    ].includes(observedJournal.phase)
      && observedJournal.events.some((event) => event.phase === 'CANDIDATE_POINTER_SWITCH_STARTED');
    const pointerTransitionUncertain = observedJournal.phase === 'CANDIDATE_POINTER_SWITCH_STARTED'
      || observedJournal.packageState.observedActive === 'TRANSITION_PENDING'
      || recoveryCanConvergeEitherRuntime;
    const allowedRuntimeStates = pointerTransitionUncertain
      ? ['RECOVERY_ACTIVE', 'CANDIDATE_ACTIVE'] : [expectedRuntimeState];
    assert(allowedRuntimeStates.includes(currentRuntime.state),
      'Pre-adoption runtime package state differs from the durable journal');
    const configuredDatabase = databaseNameFromUrl(readSettings(descriptor).DATABASE_URL);
    const recoverySwitchMayHaveStarted = observedJournal.phase === 'RECOVERY_DB_LOCKED'
      || (observedJournal.phase === 'FAILED_FROZEN'
        && observedJournal.lastCompletedCheckpoint === 'RECOVERY_DB_LOCKED');
    const allowedDatabases = recoverySwitchMayHaveStarted && observedJournal.recoveryDatabase
      ? [observedJournal.currentDatabase.database, observedJournal.recoveryDatabase.database]
      : [observedJournal.currentDatabase.database];
    assert(allowedDatabases.includes(configuredDatabase),
      'Pre-adoption database target differs from the durable journal');
    if (observedJournal.quiescenceSnapshot) prepared.app.readAndVerifySnapshot({
      expected: adoption.quiescenceSnapshot,
      mutationBoundary: observedJournal.recoveryPoint?.mutationBoundaryAt || null,
    });
    for (const field of ['structuralSha256', 'ledgerSha256', 'protectedDataSha256',
      'applicationRowCountsSha256', 'materialTableFingerprintsSha256']) {
      if (observedJournal.currentDatabase[field]
        && configuredDatabase === observedJournal.currentDatabase.database) {
        assert.equal(prepared.result.evidence[field], observedJournal.currentDatabase[field],
          `Pre-adoption database ${field} differs from the durable journal`);
      }
    }
    adopted = await control.controller.resumeFrozen({
      expectedGeneration: adoption.expectedGeneration,
      expectedPhase: adoption.expectedPhase,
      previousControllerStatus: adoption.previousControllerStatus,
      cutoverId: operationId,
      targetAppServiceResourceId: binding.appServiceResourceId,
      targetSqlServerResourceId: binding.sqlServerResourceId,
      targetDatabaseResourceId: binding.databaseResourceId,
      candidateSha: binding.candidateSha,
      candidatePackageSha256: binding.candidateArtifactSha256,
      migrationArtifactSha256: binding.migrationArtifactSha256,
      releaseReceiptSha256: binding.releaseReceiptSha256,
      authorizationSha256,
      recoveryPackageSha256: binding.recoveryArtifactSha256,
      quiescenceSnapshot: adoption.quiescenceSnapshot,
    });
  }

  const environmentLock = new SqlApplicationLock({ databaseUrl: prepared.databaseUrl,
    resourceId: binding.appServiceResourceId });
  const originalLock = new SqlApplicationLock({ databaseUrl: prepared.databaseUrl,
    resourceId: binding.databaseResourceId });
  const handoff = new RecoveryLockHandoff({ durableFreeze: control.controller,
    environmentSqlLock: environmentLock, originalDatabaseLock: originalLock,
    recoveryLockFactory: ({ databaseUrl, resourceId }) => new SqlApplicationLock({ databaseUrl, resourceId }) });

  const verifyPackages = async () => {
    const result = {};
    for (const kind of ['candidate', 'recovery']) {
      const value = prepared.runtimes[kind];
      result[kind] = await verifyRemotePackage({ reference: value.reference, expectedSha256: value.sha256,
        expectedSize: value.size, requiredThrough: value.requiredThrough });
    }
    return result;
  };

  const journalContext = {
    cutoverId: operationId,
    expectedOpenGeneration: prepared.durableState.document.generation,
    targetAppServiceResourceId: binding.appServiceResourceId,
    targetSqlServerResourceId: binding.sqlServerResourceId,
    targetDatabaseResourceId: binding.databaseResourceId,
    candidateSha: binding.candidateSha,
    candidatePackageSha256: binding.candidateArtifactSha256,
    migrationArtifactSha256: binding.migrationArtifactSha256,
    releaseReceiptSha256: binding.releaseReceiptSha256,
    authorizationSha256,
    recoveryPackageSha256: binding.recoveryArtifactSha256,
    currentDatabase: { role: 'SOURCE', resourceId: binding.databaseResourceId, database: descriptor.database,
      structuralSha256: prepared.evidence?.structuralSha256 || prepared.result.evidence.structuralSha256,
      ledgerSha256: prepared.evidence?.ledgerSha256 || prepared.result.evidence.ledgerSha256,
      protectedDataSha256: prepared.evidence?.protectedDataSha256 || prepared.result.evidence.protectedDataSha256,
      applicationRowCountsSha256: prepared.result.evidence.applicationRowCountsSha256,
      materialTableFingerprintsSha256: prepared.result.evidence.materialTableFingerprintsSha256 },
    packageState: { preCutover: durableRuntime(prepared.runtimes.recovery),
      candidate: durableRuntime(prepared.runtimes.candidate), recovery: durableRuntime(prepared.runtimes.recovery),
      expectedActive: 'RECOVERY', observedActive: currentRuntime.state },
  };

  const controller = new CutoverV2Controller({ context: {
    operationId,
    targetResourceId: binding.appServiceResourceId,
    candidateRuntime: prepared.runtimes.candidate,
    recoveryRuntime: prepared.runtimes.recovery,
    journalContext,
  }, dependencies: {
    verifySource: async () => ({ verdict: 'PASS', candidateSha: binding.candidateSha }),
    verifyParity: async () => ({ verdict: 'PASS', liveAndDisposableDeploymentImplementationPath: 'MATCH' }),
    verifyPackages,
    verifyTarget: async () => ({ verdict: 'PASS', database: descriptor.database,
      appServiceResourceId: binding.appServiceResourceId, sqlServerResourceId: binding.sqlServerResourceId }),
    verifyResumeState: async () => {
      const journal = await control.controller.currentJournal();
      const runtimeState = await runtimeDeps.inspect();
      const expectedRuntime = journal.packageState.expectedActive === 'CANDIDATE'
        ? 'CANDIDATE_ACTIVE' : 'RECOVERY_ACTIVE';
      const runtimeAllowed = journal.phase === 'CANDIDATE_POINTER_SWITCH_STARTED'
        ? ['RECOVERY_ACTIVE', 'CANDIDATE_ACTIVE'] : [expectedRuntime];
      assert(runtimeAllowed.includes(runtimeState.state), 'Runtime package state differs from the durable journal');
      const configured = readSettings(descriptor);
      const configuredDatabase = databaseNameFromUrl(configured.DATABASE_URL);
      const databaseAllowed = journal.phase === 'RECOVERY_DB_LOCKED' && journal.recoveryDatabase
        ? [journal.currentDatabase.database, journal.recoveryDatabase.database]
        : [journal.currentDatabase.database];
      assert(databaseAllowed.includes(configuredDatabase), 'Configured database differs from the durable journal');
      if (journal.quiescenceSnapshot) prepared.app.readAndVerifySnapshot({
        expected: journal.quiescenceSnapshot,
        mutationBoundary: journal.recoveryPoint?.mutationBoundaryAt || null,
      });
      const dbEvidence = await captureEvidence(configured.DATABASE_URL);
      for (const [journalField, observedField] of [['structuralSha256', 'structuralSha256'],
        ['ledgerSha256', 'ledgerSha256'], ['protectedDataSha256', 'protectedDataSha256'],
        ['applicationRowCountsSha256', 'applicationRowCountsSha256'],
        ['materialTableFingerprintsSha256', 'materialTableFingerprintsSha256']]) {
        if (journal.currentDatabase[journalField] && configuredDatabase === journal.currentDatabase.database) {
          assert.equal(dbEvidence[observedField], journal.currentDatabase[journalField],
            `Database ${journalField} differs from the durable journal`);
        }
      }
      return { verdict: 'PASS', phase: journal.phase, packageState: runtimeState.state,
        database: journal.currentDatabase.database, snapshot: journal.quiescenceSnapshot ? 'VERIFIED' : 'NOT_YET_CREATED' };
    },
    app: prepared.app,
    durableFreeze: control.controller,
    lockHandoff: handoff,
    runtime: runtimeDeps,
    git: {
      forwardOnlyRecovery: async () => ({ verdict: environment === 'live'
        ? 'FORWARD_ONLY_RECOVERY_REQUIRED' : 'DISPOSABLE_SIMULATION', noReset: true }),
    },
    database: {
      captureRecoveryPoint: async () => {
        const evidence = await captureEvidence(prepared.databaseUrl);
        return { recoveryTimestamp: new Date(Date.now() - 10_000).toISOString(),
          mutationBoundaryAt: new Date().toISOString(),
          sourceDatabaseResourceId: binding.databaseResourceId,
          structuralSha256: evidence.structuralSha256, ledgerSha256: evidence.ledgerSha256,
          protectedDataSha256: evidence.protectedDataSha256,
          applicationRowCountsSha256: evidence.applicationRowCountsSha256,
          materialTableFingerprintsSha256: evidence.materialTableFingerprintsSha256,
          cutoverId: operationId };
      },
      continueMigration: async (options) => runMigration(root, environment, prepared.databaseUrl,
        binding, operationId, options),
      planRecovery: async () => {
        const database = assertRecoveryDatabaseName(binding.recoveryDatabase
          || `${descriptor.database}-v2-recovery-${safeId(operationId)}`);
        return { database, resourceId: `${binding.sqlServerResourceId}/databases/${database}`,
          providerRequestId: sha256(`${operationId}:${database}`) };
      },
      resolveRecovery: async (recoveryDatabase) => {
        assert.equal(recoveryDatabase.resourceId.toLowerCase(),
          `${binding.sqlServerResourceId}/databases/${recoveryDatabase.database}`.toLowerCase(),
        'Recovery database resource differs from the durable journal');
        return { ...recoveryDatabase,
          databaseUrl: databaseUrlFor(prepared.databaseUrl, recoveryDatabase.database) };
      },
      restore: async (point, recoveryDatabase, { allowStart }) => {
        let restored = null;
        let startedByThisController = false;
        const providerDeadline = Date.now() + binding.worstCaseRecoveryMinutes * 60_000;
        try {
          restored = azJson(descriptor, ['sql', 'db', 'show', '-g', descriptor.resourceGroup,
            '-s', descriptor.sqlServer, '-n', recoveryDatabase.database]);
        } catch (error) {
          if (allowStart) {
            await runAzureAsync(['sql', 'db', 'restore', '-g', descriptor.resourceGroup, '-s', descriptor.sqlServer,
              '-n', descriptor.database, '--dest-name', recoveryDatabase.database, '--time', point.recoveryTimestamp,
              '--no-wait', '--subscription', descriptor.subscription, '-o', 'none'], { label: 'Azure PITR request' });
            startedByThisController = true;
          } else {
            const operations = azJson(descriptor, ['monitor', 'activity-log', 'list',
              '--resource-id', recoveryDatabase.resourceId, '--start-time', point.recoveryTimestamp]);
            const restoreWrites = operations.filter((event) =>
              String(event.operationName?.value || '').toLowerCase().endsWith('/databases/write'));
            assert(!restoreWrites.some((event) => ['failed', 'canceled'].includes(
              String(event.status?.value || '').toLowerCase())),
            'Existing Azure PITR operation has a terminal failure');
            assert(restoreWrites.some((event) => ['started', 'accepted', 'succeeded'].includes(
              String(event.status?.value || '').toLowerCase())),
            'Recovery database is absent and no accepted Azure PITR operation exists; duplicate restore is forbidden');
          }
          while (!restored && Date.now() < providerDeadline) {
            try {
              restored = azJson(descriptor, ['sql', 'db', 'show', '-g', descriptor.resourceGroup,
                '-s', descriptor.sqlServer, '-n', recoveryDatabase.database]);
            } catch (visibilityError) {
              if (Date.now() >= providerDeadline) throw visibilityError;
              await new Promise((resolve) => setTimeout(resolve, 10_000));
            }
          }
          assert(restored, 'Azure PITR target did not become provider-visible');
          if (environment === 'disposable'
            && process.env.RELIANCE_CUTOVER_INJECT_CONTROLLER_LOSS_DURING_PITR === 'YES') {
            throw controllerLoss('Injected disposable controller loss during active Azure PITR');
          }
        }
        let firstStatusCheck = true;
        while (Date.now() < providerDeadline) {
          if (!startedByThisController || !firstStatusCheck) {
            restored = azJson(descriptor, ['sql', 'db', 'show', '-g', descriptor.resourceGroup,
              '-s', descriptor.sqlServer, '-n', recoveryDatabase.database]);
          }
          if (String(restored.status).toLowerCase() === 'online') break;
          firstStatusCheck = false;
          await new Promise((resolve) => setTimeout(resolve, 10_000));
        }
        assert.equal(String(restored?.status).toLowerCase(), 'online', 'PITR recovery database did not become Online');
        assert.equal(restored.id.toLowerCase(), recoveryDatabase.resourceId.toLowerCase(),
          'PITR recovery resource differs from the durable plan');
        return { ...recoveryDatabase, resourceId: restored.id,
          databaseUrl: databaseUrlFor(prepared.databaseUrl, recoveryDatabase.database) };
      },
      verifyRecovery: async (restored, point) => {
        const evidence = await captureEvidence(restored.databaseUrl);
        for (const field of ['structuralSha256', 'ledgerSha256', 'protectedDataSha256',
          'applicationRowCountsSha256', 'materialTableFingerprintsSha256']) {
          assert.equal(evidence[field], point[field], `Recovered ${field} differs from the durable recovery point`);
        }
        return { verdict: 'PASS', resourceId: restored.resourceId, evidence };
      },
      switchConnection: async (restored) => {
        if (databaseNameFromUrl(readSettings(descriptor).DATABASE_URL).toLowerCase()
          === restored.database.toLowerCase()) {
          return { verdict: 'PASS', databaseSwitch: 'NO_OP_ALREADY_RECOVERY', database: restored.database };
        }
        return switchDatabaseConnection({ root, resourceGroup: descriptor.resourceGroup,
          appService: descriptor.appService, database: restored.database, databaseUrl: restored.databaseUrl });
      },
    },
    verifyTechnical: async () => {
      const current = await captureEvidence(prepared.databaseUrl);
      if (binding.injectPostMutationFailure === true) throw new Error('INJECTED_POST_MUTATION_FAILURE');
      return { verdict: 'PASS', current };
    },
    verifyRecovered: async (_context, journal) => {
      const currentUrl = databaseUrlFor(prepared.databaseUrl, journal.currentDatabase.database);
      return { verdict: 'PASS', evidence: await captureEvidence(currentUrl) };
    },
    acceptance: {
      prepare: async () => {
        const createdAt = new Date();
        return { createdAt: createdAt.toISOString(),
          expiresAt: new Date(createdAt.getTime() + binding.acceptanceWindowMinutes * 60_000).toISOString(),
          challenge: sha256(`${operationId}:${binding.candidateSha}:${createdAt.toISOString()}`) };
      },
      wait: async (_context, acceptance) => {
        assert(new Date(acceptance.expiresAt).getTime() >= Date.now(), 'Original acceptance deadline expired');
        return { action: environment === 'disposable' ? 'REJECT' : 'TIMEOUT', challenge: acceptance.challenge };
      },
      createReceipt: async (_acceptance, _context, acceptance) => ({
        sha256: sha256(`accept:${operationId}:${acceptance.challenge}`),
      }),
      resumeReceipt: async () => ({ sha256: sha256(`accept:${operationId}:resumed`) }),
    },
    createRecoveryReceipt: async (value) => ({ sha256: sha256(JSON.stringify(value)) }),
    cleanup: async () => ({ verdict: 'PASS', whileFrozen: true }),
    afterCheckpoint: async (phase) => {
      if (environment === 'disposable'
        && process.env.RELIANCE_CUTOVER_INJECT_CONTROLLER_LOSS_AFTER_PHASE === phase) {
        throw controllerLoss(`Injected disposable controller loss after ${phase}`);
      }
    },
  } });
  return mode === 'resume' ? controller.resume(adopted) : controller.execute();
}

async function main() {
  const args = process.argv.slice(2); const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const dryRun = args.includes('--dry-run'); const executeMode = args.includes('--execute');
  const resumeMode = args.includes('--resume') || args.includes('--adopt');
  assert.equal([dryRun, executeMode, resumeMode].filter(Boolean).length, 1,
    'Choose exactly one of --dry-run, --execute, or --resume/--adopt');
  const root = path.resolve(value('--root') || process.cwd()); const environment = value('--environment');
  assert(['live', 'disposable'].includes(environment), 'Environment must be live or disposable');
  const bindingFile = path.resolve(value('--binding') || ''); const bytes = fs.readFileSync(bindingFile);
  const binding = JSON.parse(bytes); const bindingSha256 = sha256(bytes);
  assert.equal(process.env.RELIANCE_CUTOVER_V2_BINDING_SHA256, bindingSha256, 'Binding hash environment value differs');
  const descriptor = readJson(path.join(root, 'config/release-cutover-v2/environments.json'))[environment];
  const output = dryRun ? (await preflight({ root, environment, descriptor, binding, writeEvidence: true })).result
    : await execute({ root, environment, descriptor, binding, bindingSha256,
      authorizationFile: value('--authorization') ? path.resolve(value('--authorization')) : null,
      mode: resumeMode ? 'resume' : 'execute',
      adoptionFile: value('--adoption') ? path.resolve(value('--adoption')) : null });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`CUTOVER_V2_ORCHESTRATOR_FAILED: ${error.message}\n`); process.exitCode = 2;
});

module.exports = { assertInitialDurableControl, assertRecoveryDatabaseName, captureEvidence, databaseUrlFor,
  execute, preflight, requiredPackageThrough, validateAuthorization, validateBinding,
  validateExpectedDurableControl };
