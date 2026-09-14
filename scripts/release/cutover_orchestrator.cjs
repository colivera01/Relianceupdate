#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { FixedCutoverDriver } = require('./fixed_cutover_driver.cjs');
const { runCutover, sha256 } = require('./cutover_orchestrator_lib.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const resolveRequired = (flag) => {
  const supplied = value(flag);
  if (!supplied) throw new Error(`${flag} is required`);
  return path.resolve(supplied);
};

async function main() {
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  if (dryRun === execute) throw new Error('Choose exactly one of --dry-run or --execute');
  const root = path.resolve(value('--root') || process.cwd());
  const environment = value('--environment') || 'beta';
  const releaseReceipt = resolveRequired('--receipt');
  const receipt = JSON.parse(fs.readFileSync(releaseReceipt, 'utf8'));
  const applicationArtifact = resolveRequired('--application-artifact');
  const migrationArtifact = resolveRequired('--migration-artifact');
  const releaseTargetSpec = resolveRequired('--target-spec');
  const executionTargetSpec = value('--execution-target-spec') ? path.resolve(value('--execution-target-spec')) : releaseTargetSpec;
  const smokeBaseline = resolveRequired('--smoke-baseline');
  const candidateSha = receipt.sourceCommit;
  const context = {
    environment,
    root,
    buildRoot: value('--build-root') ? path.resolve(value('--build-root')) : null,
    databaseUrl: process.env.DATABASE_URL,
    resourceId: JSON.parse(fs.readFileSync(executionTargetSpec, 'utf8')).resourceId,
    targetSpec: executionTargetSpec,
    releaseTargetSpec,
    releaseReceipt,
    receiptSha256: sha256(fs.readFileSync(releaseReceipt)),
    applicationArtifact,
    migrationArtifact,
    protectedResults: resolveRequired('--protected-results'),
    linuxValidation: resolveRequired('--linux-validation'),
    previousApplicationArtifact: resolveRequired('--previous-application-artifact'),
    previousApplicationSha256: value('--previous-application-sha256'),
    rollbackSha: value('--rollback-sha'),
    recoveryDatabase: value('--recovery-database'),
    smokeBaseline,
    postSmokeReceipt: value('--post-smoke-receipt') ? path.resolve(value('--post-smoke-receipt')) : null,
    postSmokeTimeoutMs: Number(value('--post-smoke-timeout-minutes') || '10') * 60 * 1000,
    acceptanceState: value('--acceptance-state') ? path.resolve(value('--acceptance-state')) : null,
    acceptanceDecision: value('--acceptance-decision') ? path.resolve(value('--acceptance-decision')) : null,
    acceptanceReceipt: value('--acceptance-receipt') ? path.resolve(value('--acceptance-receipt')) : null,
    acceptanceTimeoutMs: Number(value('--acceptance-timeout-minutes') || '30') * 60 * 1000,
    acceptancePollMs: Number(value('--acceptance-poll-ms') || '30000'),
    acceptanceSimulation: value('--simulate-acceptance') ? String(value('--simulate-acceptance')).toUpperCase() : null,
    finalReceiptOutput: value('--final-receipt') ? path.resolve(value('--final-receipt')) : null,
    quiescencePlan: path.resolve(value('--quiescence-plan') || path.join(root, 'config', 'release-cutover', 'quiescence-plan.json')),
    quiescenceSnapshot: path.resolve(value('--quiescence-snapshot') || path.join(root, '.reliance-cutover-quiescence.json')),
    operatorCidr: value('--operator-cidr') || process.env.RELIANCE_CUTOVER_OPERATOR_CIDR,
    candidateSha,
    candidateParent: value('--candidate-parent') || '3c078165a9483f862ada39c8df8279e06f864d76',
    candidateTree: value('--candidate-tree') || commandGit(root, ['rev-parse', 'HEAD^{tree}']),
    authoritativeBranch: 'codex/rv8-package-visibility-part1-work',
    preCutoverSha: '5b27df55e3e53409aa8b61979128d44d39541fba',
    lockToken: crypto.randomUUID(),
    heartbeatMs: 1000,
    azure: {
      subscription: value('--subscription') || 'f50140d7-274d-4eec-b309-b109c6763615',
      resourceGroup: value('--resource-group') || 'rg-reliance-beta-eastus',
      sqlServer: value('--sql-server') || 'sql-reliance-beta-wcus',
      database: value('--database') || 'reliance-beta-db',
      appService: value('--app-service') || 'app-reliance-beta-wcus',
    },
    healthUrl: value('--health-url') || 'https://beta.relianceonline.org/api/health',
    tags: {
      previous: 'reliance-pre-forward-baseline-20260910',
      release: 'reliance-forward-baseline-20260910',
    },
    onEvent: (event) => {
      if (event.phase === 'physicalAcceptance' && event.verdict === 'PENDING') {
        console.log(JSON.stringify({ cutoverStatus: event.result.status, technicalCutover: event.result.technicalCutover,
          physicalAcceptance: 'PENDING', environment: event.result.environment,
          cutoverId: event.result.cutoverId, challenge: event.result.challenge,
          expiresAt: event.result.expiresAt, checklistVersion: event.result.checklistVersion }, null, 2));
      }
      if (event.phase === 'authenticatedSmoke' && event.verdict === 'PENDING') {
        console.log(JSON.stringify({ cutoverStatus: 'WAITING_FOR_POST_CUTOVER_AUTHENTICATED_SMOKE',
          receiptOutput: event.result.receiptOutput, expiresAt: event.result.expiresAt,
          environment: 'CONTROLLED_READ_ONLY' }, null, 2));
      }
    },
  };
  if (!context.databaseUrl) throw new Error('DATABASE_URL is required');
  if (environment === 'disposable') {
    const adapterPath = resolveRequired('--rehearsal-adapter');
    const adapter = require(adapterPath);
    if (typeof adapter.attach !== 'function') throw new Error('Rehearsal adapter must export attach(context)');
    await adapter.attach(context);
  } else if (value('--rehearsal-adapter')) {
    throw new Error('Custom adapters are permanently forbidden for beta');
  }
  if (context.acceptanceSimulation && environment !== 'disposable') {
    throw new Error('Acceptance simulation is permanently forbidden for beta');
  }
  const driver = new FixedCutoverDriver(context);
  const result = await runCutover({ mode: dryRun ? 'dry-run' : 'execute', context, driver,
    authorizationFile: value('--authorization') ? path.resolve(value('--authorization')) : null,
    injectFailureAfter: value('--inject-failure-after') });
  const output = value('--output') ? path.resolve(value('--output')) : null;
  if (output) fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ verdict: result.verdict, mode: result.mode, liveMutations: result.liveMutations,
    cutoverWouldProceedIfAuthorized: result.cutoverWouldProceedIfAuthorized ?? null, evidenceOutput: output }, null, 2));
}

function commandGit(root, gitArgs) {
  const result = require('node:child_process').spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.error?.message || '').trim());
  return result.stdout.trim();
}

main().catch((error) => {
  const outputValue = value('--output');
  if (error.cutoverEvidence && outputValue) {
    const output = path.resolve(outputValue);
    fs.writeFileSync(output, `${JSON.stringify(error.cutoverEvidence, null, 2)}\n`, { flag: 'wx' });
  }
  console.error(`CUTOVER_ORCHESTRATOR_FAILED: ${error.message}`);
  if (error.cutoverEvidence) console.error(JSON.stringify(error.cutoverEvidence, null, 2));
  process.exitCode = 2;
});
