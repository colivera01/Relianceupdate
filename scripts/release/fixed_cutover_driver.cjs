#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { AppQuiescence } = require('./app_quiescence.cjs');
const { runAzure, runAzureAsync, runAzureResult } = require('./azure_cli.cjs');
const { ContinuousCutoverLock } = require('./continuous_cutover_lock.cjs');
const { assertProtectedReliance, captureApplicationEvidence } = require('./cutover_evidence.cjs');
const { createStage, destroyStage, verifyStage } = require('./migration_staging.cjs');
const { capture, connect } = require('./sqlserver_contract.cjs');
const { readJson, sha256 } = require('./cutover_orchestrator_lib.cjs');
const {
  assertStructuralFingerprintMatch,
  fileEvidence,
  sourceEvidence,
  targetSpecEvidence,
  verifyReceipt,
} = require('./release_receipt_lib.cjs');

const OLD_SHA = '5b27df55e3e53409aa8b61979128d44d39541fba';
const BASELINE = '00000000000000_reliance_forward_baseline_20260910';
const RECONCILIATION = '20260910030000_enforce_one_active_device_assignment';

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${options.label || executable} failed: ${(result.stderr || result.stdout || result.error?.message || '').trim()}`);
  }
  return options.inherit ? '' : result.stdout.trim();
}

function git(root, args) { return command('git', args, { cwd: root, label: `git ${args[0]}` }); }
function az(args) { const output = runAzure([...args, '-o', 'json'], { label: `az ${args.slice(0, 3).join(' ')}` }); return output ? JSON.parse(output) : null; }
function replaceDatabase(databaseUrl, database) {
  const parts = databaseUrl.split(';');
  let found = false;
  const updated = parts.map((part) => {
    if (/^database=/i.test(part)) { found = true; return `database=${database}`; }
    return part;
  });
  assert(found, 'DATABASE_URL has no database option');
  return updated.join(';');
}

function onlyExpectedIndexAdded(before, after) {
  const normalize = (rows) => rows.map((row) => JSON.stringify(row));
  for (const key of Object.keys(before.structural)) {
    if (key === 'indexes') continue;
    assert.deepEqual(after.structural[key], before.structural[key], `Unexpected structural difference in ${key}`);
  }
  const beforeSet = new Set(normalize(before.structural.indexes));
  const afterSet = new Set(normalize(after.structural.indexes));
  const removals = before.structural.indexes.filter((row) => !afterSet.has(JSON.stringify(row)));
  assert.equal(removals.length, 0, 'Reconciliation removed or changed an existing index');
  const additions = after.structural.indexes.filter((row) => !beforeSet.has(JSON.stringify(row)));
  assert.equal(additions.length, 1, 'Reconciliation must add exactly one index row');
  const index = additions[0];
  assert.equal(index.tableName, 'device_assignments');
  assert.equal(index.objectName, 'device_assignments_one_active_per_device_key');
  assert.equal(index.columnName, 'deviceId');
  assert.equal(Boolean(index.is_unique), true);
  assert.equal(Boolean(index.has_filter), true);
  assert(/unassignedAt.+IS NULL/i.test(index.filter_definition || ''), 'Filtered index predicate differs');
  return { verdict: 'PASS', addedIndex: index.objectName };
}

class FixedCutoverDriver {
  constructor(context) {
    this.context = context;
    this.state = { stages: [], mutationPhases: [] };
  }

  async databaseEvidence() {
    const pool = await connect(this.context.databaseUrl);
    try {
      return { contract: await capture(pool), application: await captureApplicationEvidence(pool) };
    } finally { await pool.close(); }
  }

  async assertSecondActorBlocked(context) {
    const resource = `RelianceRelease:${crypto.createHash('sha256').update(context.resourceId).digest('hex')}`;
    const pool = await connect(context.databaseUrl);
    try {
      const request = pool.request();
      request.input('resource', resource);
      const result = await request.query(`DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=0; SELECT @result AS result;`);
      const code = Number(result.recordset[0].result);
      if (code >= 0) {
        await pool.request().input('resource', resource).query(`EXEC sys.sp_releaseapplock @Resource=@resource,@LockOwner='Session';`);
        throw new Error('Second actor acquired the cutover lock');
      }
      return { verdict: 'BLOCKED', result: code };
    } finally { await pool.close(); }
  }

  sourceValidation() {
    const { root, candidateSha, candidateParent, candidateTree, authoritativeBranch } = this.context;
    assert.equal(git(root, ['rev-parse', 'HEAD']), candidateSha, 'Review HEAD differs from candidate');
    assert.equal(git(root, ['rev-parse', 'HEAD^']), candidateParent, 'Candidate parent differs');
    assert.equal(git(root, ['rev-parse', 'HEAD^{tree}']), candidateTree, 'Candidate tree differs');
    assert.equal(git(root, ['status', '--porcelain']), '', 'Review worktree is dirty');
    git(root, ['merge-base', '--is-ancestor', OLD_SHA, candidateSha]);
    const remote = git(root, ['ls-remote', 'origin', `refs/heads/${authoritativeBranch}`]).split(/\s/)[0];
    assert.equal(remote, OLD_SHA, 'Authoritative remote changed');
    const rollbackSha = this.context.rollbackSha;
    assert(/^[a-f0-9]{40}$/.test(rollbackSha || ''), 'Exact forward rollback SHA is required');
    git(root, ['merge-base', '--is-ancestor', candidateSha, rollbackSha]);
    assert.equal(git(root, ['rev-parse', `${rollbackSha}^{tree}`]), git(root, ['rev-parse', `${OLD_SHA}^{tree}`]),
      'Forward rollback tree differs from the deployed source tree');
    return { candidateSha, candidateTree, authoritativeRemote: remote, rollbackSha, forwardOnly: true };
  }

  artifactValidation() {
    const c = this.context;
    for (const file of [c.applicationArtifact, c.migrationArtifact, c.releaseReceipt, c.protectedResults, c.linuxValidation]) {
      assert(file && fs.statSync(file).isFile(), `Artifact evidence missing: ${file || '(not supplied)'}`);
    }
    assert.equal(sha256(fs.readFileSync(c.releaseReceipt)), c.receiptSha256, 'Receipt SHA differs');
    const receipt = readJson(c.releaseReceipt);
    assert.equal(receipt.sourceCommit, c.candidateSha, 'Receipt source differs');
    assert.equal(receipt.applicationArtifact.sha256, sha256(fs.readFileSync(c.applicationArtifact)), 'Application artifact SHA differs');
    assert.equal(receipt.migrationArtifact.sha256, sha256(fs.readFileSync(c.migrationArtifact)), 'Migration artifact SHA differs');
    assert.deepEqual(receipt.testResults, { ...fileEvidence(c.protectedResults),
      verdict: readJson(c.protectedResults).verdict,
      files: readJson(c.protectedResults).files,
      tests: readJson(c.protectedResults).tests,
      failed: readJson(c.protectedResults).failed,
      skipped: readJson(c.protectedResults).skipped }, 'Protected-test evidence differs');
    assert.deepEqual(receipt.linuxValidation, { ...fileEvidence(c.linuxValidation),
      verdict: readJson(c.linuxValidation).verdict }, 'Linux validation evidence differs');
    assert.equal(readJson(c.protectedResults).verdict, 'PASS', 'Protected-test evidence is not PASS');
    const linux = readJson(c.linuxValidation);
    assert.equal(linux.verdict, 'PASS', 'Linux validation is not PASS');
    assert.equal(linux.platform, 'linux', 'Application artifact was not built on Linux');
    assert.equal(sha256(fs.readFileSync(c.previousApplicationArtifact)), c.previousApplicationSha256,
      'Previous runtime artifact SHA differs');
    if (c.buildRoot && fs.existsSync(path.join(c.buildRoot, '.next'))
      && fs.existsSync(path.join(c.buildRoot, 'node_modules', '.prisma', 'client'))) {
      verifyReceipt(receipt, {
        root: c.root, buildRoot: c.buildRoot, applicationArtifact: c.applicationArtifact,
        migrationArtifact: c.migrationArtifact, targetSpec: c.releaseTargetSpec || c.targetSpec,
      });
    } else {
      const source = sourceEvidence(c.root, c.releaseTargetSpec || c.targetSpec);
      for (const key of ['sourceCommit', 'branch', 'cleanStatus', 'schemaHash', 'baseline', 'reconciliation',
        'activeMigrationManifest', 'activeMigrationAggregateHash', 'legacyArchiveManifestHash', 'prismaVersions',
        'lockfileHash', 'structuralContractHash']) {
        assert.deepEqual(receipt[key], source[key], `Release receipt source mismatch: ${key}`);
      }
      assert.deepEqual(receipt.applicationArtifact, fileEvidence(c.applicationArtifact), 'Application artifact differs');
      assert.deepEqual(receipt.migrationArtifact, fileEvidence(c.migrationArtifact), 'Migration artifact differs');
      assert.equal(receipt.expectedDatabaseMigrationState.targetSpecSha256, source.target.sha256, 'Target spec differs');
    }
    return { receiptSha256: c.receiptSha256, applicationSha256: receipt.applicationArtifact.sha256,
      migrationSha256: receipt.migrationArtifact.sha256, platform: linux.platform };
  }

  targetValidation() {
    const { spec } = targetSpecEvidence(this.context.targetSpec);
    assert.equal(spec.resourceId.toLowerCase(), this.context.resourceId.toLowerCase(), 'Target resource ID differs');
    assert.equal(spec.environment, this.context.environment, 'Execution target environment differs');
    return { resourceId: spec.resourceId, server: spec.server, database: spec.database };
  }

  actorFreezeValidation() {
    const plan = readJson(this.context.quiescencePlan);
    assert.equal(plan.planVersion, 1);
    assert.equal(plan.primaryMechanism, 'STOP_APP_THEN_RESTRICTED_RESTART');
    assert(plan.actors.every((actor) => actor.freezeMechanism && actor.verification && actor.unfreezeMethod));
    const quiescence = this.quiescence().dryRun();
    return { verdict: 'PASS', actors: plan.actors.length, quiescence,
      proceduralResidualRisk: plan.actors.filter((actor) => actor.control === 'PROCEDURAL').map((actor) => actor.actor) };
  }

  quiescence() {
    return new AppQuiescence({ subscription: this.context.azure.subscription, resourceGroup: this.context.azure.resourceGroup,
      appService: this.context.azure.appService, snapshotFile: this.context.quiescenceSnapshot,
      operatorCidr: this.context.operatorCidr, environment: this.context.environment });
  }

  async runPhase(phase, { mode, context, lock }) {
    if (phase === 'authorizationValidation') return { writeEnabled: mode === 'execute' };
    if (phase === 'sourceValidation') return this.sourceValidation();
    if (phase === 'artifactValidation') return this.artifactValidation();
    if (phase === 'targetValidation') return this.targetValidation();
    if (phase === 'actorFreezeValidation') return this.actorFreezeValidation();
    if (phase === 'preflight') {
      this.state.before = await this.databaseEvidence();
      assert.equal(this.state.before.application.preflight.assignmentDuplicates.length, 0, 'Duplicate active assignments exist');
      assertProtectedReliance(this.state.before.application);
      return { structuralSha256: this.state.before.contract.structuralSha256,
        ledgerSha256: this.state.before.contract.ledgerSha256,
        applicationSha256: this.state.before.application.applicationRowCountsSha256,
        protectedSha256: this.state.before.application.protectedEvidenceSha256 };
    }
    if (phase === 'recoveryPoint') {
      const database = az(['sql', 'db', 'show', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-s', context.azure.sqlServer, '-n', context.azure.database]);
      assert.equal(database.id.toLowerCase(), context.resourceId.toLowerCase());
      assert(new Date(database.earliestRestoreDate).getTime() < Date.now(), 'PITR is unavailable');
      this.state.pitrValidated = true;
      return { sourceResourceId: database.id, pitrValidated: true, earliestRestoreDate: database.earliestRestoreDate,
        pointInTimeCapturedAfterQuiescence: true };
    }
    if (phase === 'externalActorFreeze') {
      const result = context.environment === 'disposable' && context.rehearsal?.quiesce
        ? context.rehearsal.quiesce() : this.quiescence().freeze();
      assert.equal(this.state.pitrValidated, true, 'PITR was not validated before quiescence');
      this.state.recoveryPoint = new Date().toISOString();
      this.state.mutationPhases.push(phase);
      this.state.quiesced = true;
      return { ...result, recoveryPoint: this.state.recoveryPoint };
    }
    if (phase === 'gitPromotion') {
      let result;
      if (context.environment === 'disposable') result = context.rehearsal.gitPromote();
      else {
        const output = git(context.root, ['push', '--porcelain', '--atomic', 'origin', `${context.candidateSha}:refs/heads/${context.authoritativeBranch}`]);
        this.state.gitPromoted = true;
        const remote = git(context.root, ['ls-remote', 'origin', `refs/heads/${context.authoritativeBranch}`]).split(/\s/)[0];
        assert.equal(remote, context.candidateSha, 'Remote did not reach candidate');
        result = { output, remote };
      }
      this.state.gitPromoted = true;
      this.state.mutationPhases.push(phase);
      return result;
    }
    if (phase === 'applicationQuiescence') {
      const app = az(['webapp', 'show', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup, '-n', context.azure.appService]);
      assert.equal(String(app.state).toLowerCase(), 'stopped', 'App Service did not stop');
      return { state: app.state, writeTrafficQuiesced: true };
    }
    if (phase === 'ledgerRotation') {
      this.state.databaseMutationMayHaveOccurred = true;
      this.runNode(['scripts/release/run_guarded_sql.cjs', '--file', 'scripts/release/sql/rotate_legacy_migration_ledger_20260910.sql'], lock);
      this.state.databaseMutated = true;
      this.state.mutationPhases.push(phase);
      return { legacyLedger: '_prisma_migrations_legacy_20260910' };
    }
    if (phase === 'baselineRecognition') {
      this.state.baselineStage = createStage({ root: context.root, stageName: 'baseline' });
      this.state.stages.push(this.state.baselineStage.stageRoot);
      verifyStage({ root: context.root, stageRoot: this.state.baselineStage.stageRoot, stageName: 'baseline' });
      this.state.databaseMutationMayHaveOccurred = true;
      this.runPrisma(['migrate', 'resolve', '--applied', BASELINE, `--schema=${this.state.baselineStage.schemaPath}`], lock);
      this.state.databaseMutated = true;
      this.state.mutationPhases.push(phase);
      return { baseline: BASELINE };
    }
    if (phase === 'baselineNoop') {
      const before = await this.databaseEvidence();
      this.runPrisma(['migrate', 'deploy', `--schema=${this.state.baselineStage.schemaPath}`], lock);
      const after = await this.databaseEvidence();
      assert.equal(after.contract.structuralSha256, before.contract.structuralSha256, 'Baseline no-op changed structure');
      assert.equal(after.application.applicationRowCountsSha256, before.application.applicationRowCountsSha256, 'Baseline no-op changed data counts');
      assert.equal(after.application.materialTableFingerprintsSha256, before.application.materialTableFingerprintsSha256, 'Baseline no-op changed application data');
      assert.equal(after.application.protectedEvidenceSha256, before.application.protectedEvidenceSha256, 'Baseline no-op changed protected evidence');
      this.state.afterBaseline = after;
      return { structuralBefore: before.contract.structuralSha256, structuralAfter: after.contract.structuralSha256,
        dataBefore: before.application.materialTableFingerprintsSha256, dataAfter: after.application.materialTableFingerprintsSha256 };
    }
    if (phase === 'reconciliationDeploy') {
      const before = await this.databaseEvidence();
      assert.equal(before.application.preflight.assignmentDuplicates.length, 0, 'Duplicate active assignments appeared');
      this.state.reconciliationStage = createStage({ root: context.root, stageName: 'reconciliation' });
      this.state.stages.push(this.state.reconciliationStage.stageRoot);
      verifyStage({ root: context.root, stageRoot: this.state.reconciliationStage.stageRoot, stageName: 'reconciliation' });
      this.state.databaseMutationMayHaveOccurred = true;
      this.runPrisma(['migrate', 'deploy', `--schema=${this.state.reconciliationStage.schemaPath}`], lock);
      const after = await this.databaseEvidence();
      onlyExpectedIndexAdded(before.contract, after.contract);
      assert.equal(after.application.applicationRowCountsSha256, before.application.applicationRowCountsSha256, 'Reconciliation changed row counts');
      assert.equal(after.application.materialTableFingerprintsSha256, before.application.materialTableFingerprintsSha256, 'Reconciliation changed application data');
      assert.equal(after.application.protectedEvidenceSha256, before.application.protectedEvidenceSha256, 'Reconciliation changed protected evidence');
      assert.deepEqual(after.contract.successfulMigrationNames, [BASELINE, RECONCILIATION]);
      this.state.afterReconciliation = after;
      this.state.mutationPhases.push(phase);
      return { migration: RECONCILIATION, expectedIndex: 'device_assignments_one_active_per_device_key' };
    }
    if (phase === 'structuralVerification') return onlyExpectedIndexAdded(this.state.afterBaseline.contract, this.state.afterReconciliation.contract);
    if (phase === 'protectedDataVerification') return assertProtectedReliance(this.state.afterReconciliation.application);
    if (phase === 'applicationDeploy') {
      let result;
      if (context.environment === 'disposable' && context.rehearsal?.deploy) result = context.rehearsal.deploy(context.applicationArtifact);
      else {
        runAzure(['webapp', 'deploy', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
          '-n', context.azure.appService, '--src-path', context.applicationArtifact, '--type', 'zip', '--clean', 'true', '--restart', 'false', '--output', 'none'],
        { label: 'deploy exact runtime artifact' });
        result = { artifactSha256: sha256(fs.readFileSync(context.applicationArtifact)) };
      }
      this.state.applicationDeployed = true;
      this.state.mutationPhases.push(phase);
      return result;
    }
    if (phase === 'health') {
      if (context.environment === 'disposable' && context.rehearsal?.health) return context.rehearsal.health();
      this.quiescence().restrictedRestart();
      return this.waitForHealth(context.healthUrl);
    }
    if (phase === 'authenticatedSmoke') {
      const baseline = readJson(context.smokeBaseline);
      assert.equal(baseline.employee.result, 'NOT_APPLICABLE_ACCOUNTLESS_WORK_ORDER_ONLY');
      assert(['PASS', 'UNPROVEN_NO_CURRENT_VALID_TOKEN'].includes(baseline.employeeAccountless.result));
      if (baseline.employeeAccountless.result === 'UNPROVEN_NO_CURRENT_VALID_TOKEN') {
        assert.equal(baseline.employeeAccountless.priorPhysicalAcceptance, 'PASS');
        assert.equal(baseline.employeeAccountless.releaseChangesEmployeeAccess, false);
        assert.equal(baseline.employeeAccountless.protectedRegression, 'PASS');
      }
      for (const role of ['customer', 'vendor', 'admin']) assert.equal(baseline[role].result, 'PASS', `${role} baseline is incomplete`);
      if (context.environment === 'disposable') return { verdict: 'PASS', boundary: 'DISPOSABLE_HEALTH_AND_AUTHORIZATION_TESTS' };
      assert(context.postSmokeReceipt && fs.existsSync(context.postSmokeReceipt), 'Post-cutover authenticated smoke receipt missing');
      const post = readJson(context.postSmokeReceipt);
      for (const role of ['customer', 'vendor', 'admin']) assert.equal(post[role].result, 'PASS', `${role} post-cutover smoke failed`);
      assert.equal(post.employee.result, 'NOT_APPLICABLE_ACCOUNTLESS_WORK_ORDER_ONLY');
      assert(['PASS', 'UNPROVEN_NO_CURRENT_VALID_TOKEN'].includes(post.employeeAccountless.result));
      return { verdict: 'PASS', roles: ['customer', 'vendor', 'admin'], employeeAccess: post.employeeAccountless.result };
    }
    if (phase === 'physicalAcceptance') {
      if (context.environment === 'disposable') return { verdict: 'PASS', simulated: true };
      assert(context.physicalAcceptance && fs.existsSync(context.physicalAcceptance), 'Physical acceptance receipt missing');
      const acceptance = readJson(context.physicalAcceptance);
      assert.equal(acceptance.candidateSha, context.candidateSha);
      assert.equal(acceptance.accepted, true);
      return { verdict: 'PASS', acceptedAt: acceptance.acceptedAt };
    }
    if (phase === 'acceptanceTags') {
      if (context.environment === 'disposable' && context.rehearsal?.tags) return context.rehearsal.tags();
      for (const [tag, sha] of [[context.tags.previous, OLD_SHA], [context.tags.release, context.candidateSha]]) {
        assert.equal(git(context.root, ['tag', '-l', tag]), '', `Tag already exists: ${tag}`);
        git(context.root, ['tag', '-a', tag, sha, '-m', `${tag} accepted by Product Owner`]);
      }
      git(context.root, ['push', '--porcelain', '--atomic', 'origin', `refs/tags/${context.tags.previous}`, `refs/tags/${context.tags.release}`]);
      this.state.mutationPhases.push(phase);
      return { tags: context.tags };
    }
    if (phase === 'externalActorUnfreeze') {
      const result = context.environment === 'disposable' && context.rehearsal?.unfreeze
        ? context.rehearsal.unfreeze() : this.quiescence().restore();
      this.state.quiesced = false;
      this.state.mutationPhases.push(phase);
      return result;
    }
    if (phase === 'finalReceipt') {
      const receipt = { receiptVersion: 1, candidateSha: context.candidateSha, completedAt: new Date().toISOString(),
        recoveryPoint: this.state.recoveryPoint, phases: this.state.mutationPhases, accepted: true };
      if (context.finalReceiptOutput) fs.writeFileSync(context.finalReceiptOutput, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
      return receipt;
    }
    throw new Error(`Unsupported cutover phase: ${phase}`);
  }

  runNode(args, lock) {
    const token = this.context.lockToken;
    command(process.execPath, args, { cwd: this.context.root, inherit: true, label: args[0], env: {
      DATABASE_URL: this.context.databaseUrl,
      RELIANCE_DB_ENVIRONMENT: this.context.environment,
      RELIANCE_DISPOSABLE: this.context.environment === 'disposable' ? 'YES' : process.env.RELIANCE_DISPOSABLE,
      RELIANCE_MIGRATION_LOCK_TOKEN: token,
      RELIANCE_TARGET_VERIFICATION_TOKEN: token,
      RELIANCE_MIGRATION_WRITE_APPROVED: this.context.environment === 'beta' ? 'YES' : process.env.RELIANCE_MIGRATION_WRITE_APPROVED,
      RELIANCE_TARGET_SPEC: this.context.targetSpec,
      RELIANCE_RELEASE_RECEIPT: this.context.releaseReceipt,
      RELIANCE_EXPECTED_RESOURCE_ID: this.context.resourceId,
    } });
  }

  runPrisma(args, lock) { this.runNode(['scripts/release/run_guarded_prisma.cjs', ...args], lock); }

  async waitForHealth(url) {
    let last;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const body = await response.json();
        if (response.ok && body.ok) return { verdict: 'PASS', status: response.status, mode: body.mode };
        last = new Error(`HTTP ${response.status}`);
      } catch (error) { last = error; }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(`Health did not pass: ${last?.message}`);
  }

  async runDryRun({ context }) {
    const stages = [];
    try {
      for (const stageName of ['baseline', 'reconciliation']) {
        const stage = createStage({ root: context.root, stageName });
        stages.push(stage.stageRoot);
        verifyStage({ root: context.root, stageRoot: stage.stageRoot, stageName });
      }
      const evidence = await this.databaseEvidence();
      const spec = readJson(context.targetSpec).expectedStates.preCutover;
      assertStructuralFingerprintMatch(evidence.contract.structuralSha256, spec.structuralSha256,
        'Live structural fingerprint differs');
      assert.equal(evidence.contract.ledgerSha256, spec.ledgerSha256, 'Live ledger fingerprint differs');
      assert.equal(evidence.contract.ledgerRows, spec.ledgerRows, 'Live ledger row count differs');
      assert.equal(evidence.application.preflight.assignmentDuplicates.length, 0, 'Duplicate active assignments exist');
      assertProtectedReliance(evidence.application);
      const smoke = readJson(context.smokeBaseline);
      for (const role of ['customer', 'vendor', 'admin']) assert.equal(smoke[role].result, 'PASS', `${role} authenticated baseline missing`);
      assert.equal(smoke.employee.result, 'NOT_APPLICABLE_ACCOUNTLESS_WORK_ORDER_ONLY');
      assert(['PASS', 'UNPROVEN_NO_CURRENT_VALID_TOKEN'].includes(smoke.employeeAccountless.result));
      if (smoke.employeeAccountless.result === 'UNPROVEN_NO_CURRENT_VALID_TOKEN') {
        assert.equal(smoke.employeeAccountless.priorPhysicalAcceptance, 'PASS');
        assert.equal(smoke.employeeAccountless.releaseChangesEmployeeAccess, false);
        assert.equal(smoke.employeeAccountless.protectedRegression, 'PASS');
      }
      const database = az(['sql', 'db', 'show', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-s', context.azure.sqlServer, '-n', context.azure.database]);
      assert(new Date(database.earliestRestoreDate).getTime() < Date.now(), 'PITR unavailable');
      assert(/restore|recovery/i.test(context.recoveryDatabase || ''), 'Deterministic recovery database name is missing');
      const existingRecovery = runAzureResult(['sql', 'db', 'show', '--subscription', context.azure.subscription,
        '-g', context.azure.resourceGroup, '-s', context.azure.sqlServer, '-n', context.recoveryDatabase, '-o', 'none'],
      { label: 'check deterministic recovery database' });
      assert.notEqual(existingRecovery.status, 0, 'Deterministic recovery database already exists');
      const probe = new ContinuousCutoverLock({ databaseUrl: context.databaseUrl, resourceId: context.resourceId, timeoutMs: 0, heartbeatMs: 1000 });
      try { await probe.acquire(); await probe.assertOwned(); } finally { await probe.release(); }
      return { writeDisabled: true, targetIdentity: evidence.contract.identity, stages: ['baseline', 'reconciliation'],
        structuralSha256: evidence.contract.structuralSha256, ledgerSha256: evidence.contract.ledgerSha256,
        protectedSha256: evidence.application.protectedEvidenceSha256, lockAvailable: true, pitrAvailable: true,
        authenticatedBaseline: 'PASS', artifactExistence: true };
    } finally { for (const stage of stages) destroyStage(stage); }
  }

  async rollback({ context, lock, cause }) {
    await lock.assertOwned();
    const result = context.rollback && typeof context.rollback.execute === 'function'
      ? await context.rollback.execute({ state: this.state, cause, originalLock: lock })
      : await this.rollbackBeta(context, lock);
    await lock.assertOwned();
    assert.equal(result.verdict, 'PASS', 'Rollback adapter did not pass');
    return result;
  }

  async waitForDatabase(database, attempts = 90) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const item = az(['sql', 'db', 'show', '--subscription', this.context.azure.subscription,
          '-g', this.context.azure.resourceGroup, '-s', this.context.azure.sqlServer, '-n', database]);
        if (String(item.status).toLowerCase() === 'online') return item;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    throw new Error(`Recovery database did not become Online: ${database}`);
  }

  async rollbackBeta(context, originalLock) {
    assert.equal(context.environment, 'beta', 'Built-in rollback is reserved for beta');
    if (!this.state.databaseMutated && !this.state.databaseMutationMayHaveOccurred) {
      if (this.state.gitPromoted) {
        git(context.root, ['push', '--porcelain', '--atomic', 'origin',
          `${context.rollbackSha}:refs/heads/${context.authoritativeBranch}`]);
      }
      if (fs.existsSync(context.quiescenceSnapshot)) this.quiescence().restore();
      return { verdict: 'PASS', databaseRestored: false, reason: 'NO_DATABASE_MUTATION',
        forwardGitRecoveryApplied: Boolean(this.state.gitPromoted), quiescenceRestored: true };
    }
    assert(this.state.recoveryPoint, 'Post-quiescence recovery point is missing');
    assert(originalLock, 'Original-database lock is required for rollback');
    assert(/restore|recovery/i.test(context.recoveryDatabase || ''), 'Recovery database marker is missing');
    const existing = runAzureResult(['sql', 'db', 'show', '--subscription', context.azure.subscription,
      '-g', context.azure.resourceGroup, '-s', context.azure.sqlServer, '-n', context.recoveryDatabase, '-o', 'none'],
    { label: 'check deterministic recovery database' });
    assert.notEqual(existing.status, 0, 'Deterministic recovery database already exists');
    await runAzureAsync(['sql', 'db', 'restore', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
      '-s', context.azure.sqlServer, '-n', context.azure.database, '--dest-name', context.recoveryDatabase,
      '--time', this.state.recoveryPoint, '--output', 'none'], { label: 'beta PITR restore' });
    const recoveryResource = await this.waitForDatabase(context.recoveryDatabase);
    const recoveryUrl = replaceDatabase(context.databaseUrl, context.recoveryDatabase);
    await originalLock.assertOwned();
    const restoredLock = new ContinuousCutoverLock({ databaseUrl: recoveryUrl, resourceId: recoveryResource.id,
      heartbeatMs: context.heartbeatMs || 5000 });
    const restoredLockAcquired = await restoredLock.acquire();
    let restoredLockReleased;
    let result;
    try {
      await originalLock.assertOwned();
      await restoredLock.assertOwned();
      const restoredSecondActor = await this.assertSecondActorBlocked({ databaseUrl: recoveryUrl, resourceId: recoveryResource.id });
      const originalUrl = context.databaseUrl;
      let recovered;
      try {
        context.databaseUrl = recoveryUrl;
        recovered = await this.databaseEvidence();
      } finally { context.databaseUrl = originalUrl; }
      assert.equal(recovered.contract.structuralSha256, this.state.before.contract.structuralSha256);
      assert.equal(recovered.contract.ledgerSha256, this.state.before.contract.ledgerSha256);
      assert.equal(recovered.application.materialTableFingerprintsSha256,
        this.state.before.application.materialTableFingerprintsSha256);
      assert.equal(recovered.application.protectedEvidenceSha256, this.state.before.application.protectedEvidenceSha256);
      assertProtectedReliance(recovered.application);
      runAzure(['webapp', 'config', 'appsettings', 'set', '--subscription', context.azure.subscription,
        '-g', context.azure.resourceGroup, '-n', context.azure.appService, '--settings', `DATABASE_URL=${recoveryUrl}`,
        '--output', 'none'], { label: 'beta recovery connection switch' });
      runAzure(['webapp', 'deploy', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-n', context.azure.appService, '--src-path', context.previousApplicationArtifact, '--type', 'zip', '--clean', 'true',
        '--restart', 'false', '--output', 'none'], { label: 'restore previous beta runtime' });
      git(context.root, ['push', '--porcelain', '--atomic', 'origin',
        `${context.rollbackSha}:refs/heads/${context.authoritativeBranch}`]);
      await originalLock.assertOwned();
      await restoredLock.assertOwned();
      this.quiescence().restrictedRestart();
      const health = await this.waitForHealth(context.healthUrl);
      await restoredLock.assertOwned();
      this.quiescence().restore();
      result = { verdict: 'PASS', databaseRestored: true, recoveryResourceId: recoveryResource.id,
        recoveryPoint: this.state.recoveryPoint, connectionSwitched: true, previousRuntimeRestored: true,
        forwardGitRecoveryApplied: true, protectedData: 'PASS', health,
        originalDatabaseLockHeldUntilRecoveryHandoff: true,
        restoredDatabaseLock: { acquired: restoredLockAcquired.verdict, secondActor: restoredSecondActor.verdict,
          heldThroughConnectionSwitchAndRestart: true } };
    } finally { restoredLockReleased = await restoredLock.release(); }
    result.restoredDatabaseLock.released = restoredLockReleased.verdict;
    return result;
  }

  async cleanup() {
    for (const stage of this.state.stages.splice(0)) {
      if (fs.existsSync(stage)) destroyStage(stage);
    }
  }
}

module.exports = { BASELINE, FixedCutoverDriver, OLD_SHA, RECONCILIATION, command, onlyExpectedIndexAdded, replaceDatabase };
