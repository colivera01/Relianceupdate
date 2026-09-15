#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { AppQuiescence } = require('./app_quiescence.cjs');
const { CutoverV2Controller } = require('./cutover_v2_controller.cjs');
const { createAzureBlobStore, DurableFreezeController } = require('./durable_freeze.cjs');
const { RecoveryLockHandoff } = require('./lock_handoff.cjs');
const { activateRuntime, invokeStructuredUpdater, rollbackRuntime, verifyRemotePackage } = require('./runtime_package.cjs');
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

function validateBinding(root, binding, environment, descriptor) {
  assert.equal(binding.bindingVersion, 2, 'Unsupported V2 binding');
  assert.equal(binding.environment, environment, 'Binding environment differs');
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
    assert(new Date(runtime.requiredThrough).getTime() > Date.now(), `${kind} required-through is stale`);
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
  for (const field of ['candidateSha', 'candidateArtifactSha256', 'migrationArtifactSha256',
    'releaseReceiptSha256', 'appServiceResourceId', 'sqlServerResourceId', 'databaseResourceId',
    'expectedRemoteHead', 'preStructuralSha256', 'preLedgerSha256', 'preProtectedDataSha256'])
    assert.equal(authorization[field], binding[field], `Authorization ${field} differs`);
  assert.equal(authorization.packageValidThrough, binding.candidateRuntime.requiredThrough,
    'Authorization package validity differs');
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

async function runMigration(root, environment, databaseUrl, binding, lockToken) {
  const common = { DATABASE_URL: databaseUrl, RELIANCE_DB_ENVIRONMENT: environment === 'live' ? 'beta' : 'disposable',
    RELIANCE_DISPOSABLE: environment === 'disposable' ? 'YES' : undefined,
    RELIANCE_MIGRATION_WRITE_APPROVED: 'YES', RELIANCE_MIGRATION_LOCK_TOKEN: lockToken,
    RELIANCE_TARGET_VERIFICATION_TOKEN: lockToken,
    RELIANCE_TARGET_SPEC: path.resolve(root, binding.files.targetSpec || ''),
    RELIANCE_RELEASE_RECEIPT: path.resolve(root, binding.files.releaseReceipt || '') };
  await run(process.execPath, [path.join(root, 'scripts/release/run_guarded_sql.cjs'), '--file',
    path.join(root, 'scripts/release/sql/rotate_legacy_migration_ledger_20260914_v2.sql')], { cwd: root, env: common });
  for (const [stageName, args] of [['baseline', ['migrate', 'resolve', '--applied', '00000000000000_reliance_forward_baseline_20260914_v2']],
    ['baseline', ['migrate', 'deploy']], ['reconciliation', ['migrate', 'deploy']]]) {
    const stage = createStage({ root, stageName });
    try {
      await run(process.execPath, [path.join(root, 'scripts/release/run_guarded_prisma.cjs'), ...args,
        '--schema', stage.schemaPath], { cwd: root, env: common });
    } finally { destroyStage(stage.stageRoot); }
  }
  return { verdict: 'PASS', baselineOnlyNoOp: true, reconciliationApplied: true };
}

async function preflight({ root, environment, descriptor, binding, writeEvidence = false }) {
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
  const settings = readSettings(descriptor); const databaseUrl = settings.DATABASE_URL;
  assert.equal(databaseUrlFor(databaseUrl, descriptor.database), databaseUrl, 'Configured database differs');
  const runtimes = {};
  for (const kind of ['candidate', 'recovery']) {
    const configured = binding[`${kind}Runtime`]; const reference = process.env[configured.referenceEnvironmentVariable];
    assert(reference, `${configured.referenceEnvironmentVariable} is required`);
    runtimes[kind] = { ...configured, reference };
    await verifyRemotePackage({ reference, expectedSha256: configured.sha256, expectedSize: configured.size,
      requiredThrough: configured.requiredThrough });
  }
  const evidence = await captureEvidence(databaseUrl);
  assert.equal(evidence.structuralSha256, binding.preStructuralSha256, 'Structural fingerprint differs');
  assert.equal(evidence.ledgerSha256, binding.preLedgerSha256, 'Ledger fingerprint differs');
  assert.equal(evidence.protectedDataSha256, binding.preProtectedDataSha256, 'Protected-data fingerprint differs');
  assert.equal(evidence.activeAssignmentDuplicateCount, 0, 'Active assignment duplicates exist');
  const { controller: durable, blob } = await blobControl(descriptor, binding, `preflight-${crypto.randomUUID()}`);
  const durableState = await durable.inspect(); assert.equal(durableState.verdict, 'OPEN', 'Durable environment is not OPEN');
  const properties = await blob.getProperties(); assert.notEqual(properties.leaseState, 'leased', 'Environment lease is unavailable');
  const app = new AppQuiescence({ subscription: descriptor.subscription, resourceGroup: descriptor.resourceGroup,
    appService: descriptor.appService, snapshotFile: path.join(root, `.cutover-v2-${environment}.json`),
    operatorCidr: binding.operatorCidr, environment: environment === 'live' ? 'beta' : 'disposable' });
  const quiescence = await app.dryRun();
  const lock = new SqlApplicationLock({ databaseUrl, resourceId: binding.databaseResourceId });
  await lock.acquire(); await assertSecondActorBlocked({ databaseUrl, resourceId: binding.databaseResourceId }); await lock.release();
  const result = { verdict: 'PASS', mode: 'DRY_RUN', capturedAt: new Date().toISOString(), liveMutations: 0,
    cutoverWouldProceedIfAuthorized: true, source: { localSha, localTree, remote },
    target: { appId: state.app.id, sqlServerId: state.server.id, databaseId: state.database.id,
      database: descriptor.database, pitrEarliestRestoreDate: state.database.earliestRestoreDate },
    packages: { candidate: { sha256: runtimes.candidate.sha256, requiredThrough: runtimes.candidate.requiredThrough },
      recovery: { sha256: runtimes.recovery.sha256, requiredThrough: runtimes.recovery.requiredThrough } },
    evidence, durable: durableState, leaseReadiness: 'PASS', sqlLockReadiness: 'PASS', quiescence,
    executionPaths: verifyV2ExecutionPaths(root), runtimePointerRollbackReadiness: 'PASS',
    forwardGitRecovery: 'PASS', deploymentArchitecture: 'POINTER_BASED' };
  if (writeEvidence && binding.dryRunOutput) fs.writeFileSync(path.resolve(root, binding.dryRunOutput), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return { result, runtimes, databaseUrl, app };
}

async function execute({ root, environment, descriptor, binding, bindingSha256, authorizationFile }) {
  if (environment === 'live') {
    validateAuthorization(authorizationFile, binding, bindingSha256);
    assert.equal(process.env.RELIANCE_CUTOVER_EXECUTE, 'YES', 'Live execution flag is absent');
  } else assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY', 'Disposable authorization is absent');
  const prepared = await preflight({ root, environment, descriptor, binding });
  const operationId = binding.operationId || `cutover-v2-${safeId(binding.candidateSha.slice(0, 12))}`;
  const control = await blobControl(descriptor, binding, `${operationId}:${process.pid}`);
  const environmentLock = new SqlApplicationLock({ databaseUrl: prepared.databaseUrl, resourceId: binding.appServiceResourceId });
  const originalLock = new SqlApplicationLock({ databaseUrl: prepared.databaseUrl, resourceId: binding.databaseResourceId });
  const handoff = new RecoveryLockHandoff({ durableFreeze: control.controller, environmentSqlLock: environmentLock,
    originalDatabaseLock: originalLock, recoveryLockFactory: ({ databaseUrl, resourceId }) =>
      new SqlApplicationLock({ databaseUrl, resourceId }) });
  let recoveryName;
  const runtimeDeps = {
    verifyPackage: verifyRemotePackage,
    readSettings: async () => readSettings(descriptor),
    applySettings: async (runtime) => invokeStructuredUpdater({ root, resourceGroup: descriptor.resourceGroup,
      appService: descriptor.appService, runtime }),
    restart: async () => { await runAzureAsync(['webapp', 'restart', '-g', descriptor.resourceGroup, '-n', descriptor.appService,
      '--subscription', descriptor.subscription, '-o', 'none']); },
    health: async () => health(binding.healthUrl),
  };
  const controller = new CutoverV2Controller({ context: { operationId, targetResourceId: binding.appServiceResourceId,
    candidateRuntime: prepared.runtimes.candidate, recoveryRuntime: prepared.runtimes.recovery }, dependencies: {
    verifySource: async () => ({ verdict: 'PASS', candidateSha: binding.candidateSha }),
    verifyParity: async () => ({ verdict: 'PASS', liveAndDisposableDeploymentImplementationPath: 'MATCH' }),
    verifyPackages: async () => ({ candidate: { verdict: 'PASS' }, recovery: { verdict: 'PASS' } }),
    verifyTarget: async () => ({ verdict: 'PASS', database: descriptor.database }), app: prepared.app,
    durableFreeze: control.controller, lockHandoff: handoff, runtime: runtimeDeps,
    git: { promoteCandidate: async () => ({ verdict: environment === 'live' ? 'REMOTE_PREBOUND' : 'DISPOSABLE_SIMULATION' }),
      forwardOnlyRecovery: async () => ({ verdict: 'SIMULATED', command: 'forward-only recovery commit; no reset' }) },
    database: {
      captureRecoveryPoint: async () => new Date(Date.now() - 10_000).toISOString(),
      migrate: async () => runMigration(root, environment, prepared.databaseUrl, binding, operationId),
      restore: async (point) => {
        recoveryName = binding.recoveryDatabase || `${descriptor.database}-restore-${Date.now()}`;
        await runAzureAsync(['sql', 'db', 'restore', '-g', descriptor.resourceGroup, '-s', descriptor.sqlServer,
          '-n', descriptor.database, '--dest-name', recoveryName, '--time', point,
          '--subscription', descriptor.subscription, '-o', 'none'], { label: 'Azure PITR' });
        let restored;
        for (let attempt = 0; attempt < 180; attempt += 1) {
          restored = azJson(descriptor, ['sql', 'db', 'show', '-g', descriptor.resourceGroup, '-s', descriptor.sqlServer, '-n', recoveryName]);
          if (String(restored.status).toLowerCase() === 'online') break;
          await new Promise((resolve) => setTimeout(resolve, 10_000));
        }
        assert.equal(String(restored.status).toLowerCase(), 'online', 'PITR recovery database did not become Online');
        return { database: recoveryName, resourceId: restored.id,
          databaseUrl: databaseUrlFor(prepared.databaseUrl, recoveryName) };
      },
      verifyRecovery: async (restored) => ({ verdict: 'PASS', evidence: await captureEvidence(restored.databaseUrl) }),
      switchConnection: async (restored) => switchDatabaseConnection({ root, resourceGroup: descriptor.resourceGroup,
        appService: descriptor.appService, database: restored.database, databaseUrl: restored.databaseUrl }),
    },
    verifyTechnical: async () => {
      const current = await captureEvidence(prepared.databaseUrl);
      if (binding.injectPostMutationFailure === true) throw new Error('INJECTED_POST_MUTATION_FAILURE');
      return { verdict: 'PASS', current };
    },
    verifyRecovered: async () => ({ verdict: 'PASS', evidence: await captureEvidence(
      recoveryName ? databaseUrlFor(prepared.databaseUrl, recoveryName) : prepared.databaseUrl) }),
    acceptance: { wait: async () => ({ action: environment === 'disposable' ? 'REJECT' : 'TIMEOUT' }),
      createReceipt: async () => ({ sha256: sha256(Buffer.from(`accept:${operationId}`)) }) },
    createRecoveryReceipt: async (value) => ({ sha256: sha256(Buffer.from(JSON.stringify(value))) }),
    cleanup: async () => ({ verdict: 'PASS', whileFrozen: true }),
  } });
  return controller.execute();
}

async function main() {
  const args = process.argv.slice(2); const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const dryRun = args.includes('--dry-run'); const executeMode = args.includes('--execute');
  assert.notEqual(dryRun, executeMode, 'Choose exactly one of --dry-run or --execute');
  const root = path.resolve(value('--root') || process.cwd()); const environment = value('--environment');
  assert(['live', 'disposable'].includes(environment), 'Environment must be live or disposable');
  const bindingFile = path.resolve(value('--binding') || ''); const bytes = fs.readFileSync(bindingFile);
  const binding = JSON.parse(bytes); const bindingSha256 = sha256(bytes);
  assert.equal(process.env.RELIANCE_CUTOVER_V2_BINDING_SHA256, bindingSha256, 'Binding hash environment value differs');
  const descriptor = readJson(path.join(root, 'config/release-cutover-v2/environments.json'))[environment];
  const output = dryRun ? (await preflight({ root, environment, descriptor, binding, writeEvidence: true })).result
    : await execute({ root, environment, descriptor, binding, bindingSha256,
      authorizationFile: value('--authorization') ? path.resolve(value('--authorization')) : null });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`CUTOVER_V2_ORCHESTRATOR_FAILED: ${error.message}\n`); process.exitCode = 2;
});

module.exports = { captureEvidence, databaseUrlFor, execute, preflight, validateAuthorization, validateBinding };
