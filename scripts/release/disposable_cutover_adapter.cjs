#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runAzure, runAzureAsync, runAzureResult } = require('./azure_cli.cjs');
const { AppQuiescence } = require('./app_quiescence.cjs');
const { ContinuousCutoverLock } = require('./continuous_cutover_lock.cjs');
const { assertProtectedReliance, captureApplicationEvidence } = require('./cutover_evidence.cjs');
const { capture, connect } = require('./sqlserver_contract.cjs');

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${options.label || executable} failed: ${(result.stderr || result.error?.message || '').trim()}`);
  return result.stdout.trim();
}
const az = (args) => { const output = runAzure([...args, '-o', 'json']); return output ? JSON.parse(output) : null; };
const git = (root, args) => run('git', args, { cwd: root, label: `git ${args[0]}` });

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

async function captureRecovery(databaseUrl) {
  const pool = await connect(databaseUrl);
  try { return { contract: await capture(pool), application: await captureApplicationEvidence(pool) }; }
  finally { await pool.close(); }
}

async function assertSecondActorBlocked(databaseUrl, resourceId) {
  const resource = `RelianceRelease:${crypto.createHash('sha256').update(resourceId).digest('hex')}`;
  const pool = await connect(databaseUrl);
  try {
    const result = await pool.request().input('resource', resource).query(
      `DECLARE @result int;
       EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=0;
       SELECT @result AS result;`,
    );
    const code = Number(result.recordset[0].result);
    if (code >= 0) {
      await pool.request().input('resource', resource).query(
        `EXEC sys.sp_releaseapplock @Resource=@resource,@LockOwner='Session';`,
      );
      throw new Error('Second actor acquired the restored-database cutover lock');
    }
    return { verdict: 'BLOCKED', result: code };
  } finally { await pool.close(); }
}

async function waitDatabaseOnline(context, database, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const item = az(['sql', 'db', 'show', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-s', context.azure.sqlServer, '-n', database]);
      if (String(item.status).toLowerCase() === 'online') return item;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new Error(`Recovery database did not become Online: ${database}`);
}

async function waitHealth(url, attempts = 60) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      if (response.ok && body.ok) return { verdict: 'PASS', status: response.status, mode: body.mode };
      last = new Error(`HTTP ${response.status}`);
    } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Disposable health failed: ${last?.message}`);
}

async function attach(context) {
  assert.equal(context.environment, 'disposable');
  assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY');
  const gitRemote = process.env.RELIANCE_REHEARSAL_GIT_REMOTE;
  const previousArtifact = process.env.RELIANCE_REHEARSAL_PREVIOUS_ARTIFACT;
  const candidateArtifactUrl = process.env.RELIANCE_REHEARSAL_APPLICATION_ARTIFACT_URL;
  const previousArtifactUrl = process.env.RELIANCE_REHEARSAL_PREVIOUS_ARTIFACT_URL;
  const rollbackSha = process.env.RELIANCE_REHEARSAL_ROLLBACK_SHA;
  const restoreDatabase = process.env.RELIANCE_REHEARSAL_RESTORE_DATABASE;
  const evidenceDirectory = process.env.RELIANCE_REHEARSAL_EVIDENCE_DIR;
  for (const [name, item] of Object.entries({ gitRemote, previousArtifact, rollbackSha, restoreDatabase, evidenceDirectory })) assert(item, `${name} is required`);
  assert(/restore|recovery/i.test(restoreDatabase));
  assert(/checkpoint|rehearsal|disposable|test/i.test(context.azure.resourceGroup));
  assert(fs.statSync(previousArtifact).isFile());
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  if (!fs.existsSync(gitRemote)) {
    git(context.root, ['init', '--bare', gitRemote]);
    git(context.root, ['push', '--porcelain', gitRemote, `5b27df55e3e53409aa8b61979128d44d39541fba:refs/heads/authoritative`]);
  }
  const quiescence = new AppQuiescence({ subscription: context.azure.subscription, resourceGroup: context.azure.resourceGroup,
    appService: context.azure.appService, snapshotFile: context.quiescenceSnapshot,
    operatorCidr: context.operatorCidr, environment: 'disposable' });

  context.rehearsal = {
    gitPromote: () => {
      git(context.root, ['push', '--porcelain', '--atomic', gitRemote, `${context.candidateSha}:refs/heads/authoritative`]);
      const observed = git(context.root, ['--git-dir', gitRemote, 'rev-parse', 'refs/heads/authoritative']);
      assert.equal(observed, context.candidateSha);
      return { verdict: 'PASS', remote: gitRemote, head: observed, forcePush: false };
    },
    quiesce: () => quiescence.freeze(),
    deploy: (artifact) => {
      if (candidateArtifactUrl) {
        runAzure(['webapp', 'config', 'appsettings', 'set', '--subscription', context.azure.subscription,
          '-g', context.azure.resourceGroup, '-n', context.azure.appService, '--settings',
          `WEBSITE_RUN_FROM_PACKAGE=${candidateArtifactUrl}`, `DEPLOYED_COMMIT=${context.candidateSha}`,
          `DEPLOYED_PACKAGE=${path.basename(artifact)}`, '--output', 'none'], { label: 'disposable run-from-package switch' });
      } else {
        runAzure(['webapp', 'deploy', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
          '-n', context.azure.appService, '--src-path', artifact, '--type', 'zip', '--clean', 'true', '--restart', 'false', '--output', 'none'],
        { label: 'disposable app deployment' });
      }
      return { verdict: 'PASS', artifact: path.basename(artifact), remoteTransfer: Boolean(candidateArtifactUrl) };
    },
    health: async () => { quiescence.restrictedRestart(); return waitHealth(context.healthUrl); },
    tags: () => {
      git(context.root, ['push', '--porcelain', '--atomic', gitRemote,
        `5b27df55e3e53409aa8b61979128d44d39541fba:refs/tags/${context.tags.previous}`,
        `${context.candidateSha}:refs/tags/${context.tags.release}`]);
      return { verdict: 'PASS', simulatedRemoteTags: true };
    },
    unfreeze: () => quiescence.restore(),
  };

  context.rollback = {
    execute: async ({ state, originalLock }) => {
      if (!state.databaseMutated && !state.databaseMutationMayHaveOccurred) {
        if (state.gitPromoted) {
          git(context.root, ['push', '--porcelain', '--atomic', gitRemote, `${rollbackSha}:refs/heads/authoritative`]);
          assert.equal(git(context.root, ['--git-dir', gitRemote, 'rev-parse', 'refs/heads/authoritative']), rollbackSha);
        }
        if (fs.existsSync(context.quiescenceSnapshot)) quiescence.restore();
        return { verdict: 'PASS', databaseRestored: false, reason: 'NO_DATABASE_MUTATION',
          forwardGitRecoveryApplied: Boolean(state.gitPromoted), quiescenceRestored: true };
      }
      assert(state.recoveryPoint, 'Recovery point was not recorded after quiescence');
      assert(originalLock, 'Original-database lock is required for rollback');
      await originalLock.assertOwned();
      const source = az(['sql', 'db', 'show', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-s', context.azure.sqlServer, '-n', context.azure.database]);
      const existing = runAzureResult(['sql', 'db', 'show', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-s', context.azure.sqlServer, '-n', restoreDatabase, '-o', 'none']);
      assert.notEqual(existing.status, 0, 'Deterministic recovery database already exists');
      await runAzureAsync(['sql', 'db', 'restore', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
        '-s', context.azure.sqlServer, '-n', context.azure.database, '--dest-name', restoreDatabase,
        '--time', state.recoveryPoint, '--output', 'none'], { label: 'disposable PITR restore' });
      const recoveryResource = await waitDatabaseOnline(context, restoreDatabase);
      const recoveryUrl = replaceDatabase(context.databaseUrl, restoreDatabase);
      await originalLock.assertOwned();
      const restoredLock = new ContinuousCutoverLock({
        databaseUrl: recoveryUrl,
        resourceId: recoveryResource.id,
        heartbeatMs: context.heartbeatMs || 5000,
      });
      const restoredLockAcquired = await restoredLock.acquire();
      let restoredLockReleased;
      let result;
      try {
        await originalLock.assertOwned();
        await restoredLock.assertOwned();
        const restoredSecondActor = await assertSecondActorBlocked(recoveryUrl, recoveryResource.id);
        const recovered = await captureRecovery(recoveryUrl);
        assert.equal(recovered.contract.structuralSha256, state.before.contract.structuralSha256);
        assert.equal(recovered.contract.ledgerSha256, state.before.contract.ledgerSha256);
        assert.equal(recovered.application.applicationRowCountsSha256, state.before.application.applicationRowCountsSha256);
        assert.equal(recovered.application.materialTableFingerprintsSha256, state.before.application.materialTableFingerprintsSha256);
        assert.equal(recovered.application.protectedEvidenceSha256, state.before.application.protectedEvidenceSha256);
        assertProtectedReliance(recovered.application);
        runAzure(['webapp', 'config', 'appsettings', 'set', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
          '-n', context.azure.appService, '--settings', `DATABASE_URL=${recoveryUrl}`, '--output', 'none'], { label: 'disposable recovery connection switch' });
        if (previousArtifactUrl) {
          runAzure(['webapp', 'config', 'appsettings', 'set', '--subscription', context.azure.subscription,
            '-g', context.azure.resourceGroup, '-n', context.azure.appService, '--settings',
            `WEBSITE_RUN_FROM_PACKAGE=${previousArtifactUrl}`,
            'DEPLOYED_COMMIT=5b27df55e3e53409aa8b61979128d44d39541fba',
            `DEPLOYED_PACKAGE=${path.basename(previousArtifact)}`, '--output', 'none'],
          { label: 'restore previous disposable run-from-package' });
        } else {
          runAzure(['webapp', 'deploy', '--subscription', context.azure.subscription, '-g', context.azure.resourceGroup,
            '-n', context.azure.appService, '--src-path', previousArtifact, '--type', 'zip', '--clean', 'true', '--restart', 'false', '--output', 'none'],
          { label: 'restore previous disposable runtime' });
        }
        git(context.root, ['push', '--porcelain', '--atomic', gitRemote, `${rollbackSha}:refs/heads/authoritative`]);
        assert.equal(git(context.root, ['--git-dir', gitRemote, 'rev-parse', 'refs/heads/authoritative']), rollbackSha);
        await originalLock.assertOwned();
        await restoredLock.assertOwned();
        if (fs.existsSync(context.quiescenceSnapshot)) {
          try { quiescence.restrictedRestart(); } catch {}
        }
        const health = await waitHealth(context.healthUrl);
        await restoredLock.assertOwned();
        if (fs.existsSync(context.quiescenceSnapshot)) quiescence.restore();
        result = { verdict: 'PASS', sourceResourceId: source.id, recoveryResourceId: recoveryResource.id,
          pointInTime: state.recoveryPoint, structuralSha256: recovered.contract.structuralSha256,
          ledgerSha256: recovered.contract.ledgerSha256, applicationSha256: recovered.application.applicationRowCountsSha256,
          protectedSha256: recovered.application.protectedEvidenceSha256, connectionSwitched: true,
          previousRuntimeRestored: true, forwardGitRecoveryApplied: true, health,
          originalDatabaseLockHeldUntilRecoveryHandoff: true,
          restoredDatabaseLock: { acquired: restoredLockAcquired.verdict, secondActor: restoredSecondActor.verdict,
            heldThroughConnectionSwitchAndRestart: true } };
      } finally { restoredLockReleased = await restoredLock.release(); }
      result.restoredDatabaseLock.released = restoredLockReleased.verdict;
      fs.writeFileSync(path.join(evidenceDirectory, `rollback-${Date.now()}.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
      return result;
    },
  };
}

module.exports = { attach, replaceDatabase };
