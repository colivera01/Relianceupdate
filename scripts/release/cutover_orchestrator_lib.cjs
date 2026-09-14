#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { CutoverLockSet } = require('./continuous_cutover_lock.cjs');
const { createAcceptanceReceipt, waitForAcceptance } = require('./cutover_acceptance.cjs');
const { assertSha256Control, assertSha256ControlMatch } = require('./sha256_controls.cjs');

const MUTATING_PHASES = new Set([
  'externalActorFreeze', 'gitPromotion', 'ledgerRotation', 'baselineRecognition',
  'reconciliationDeploy', 'applicationDeploy', 'acceptanceTags', 'externalActorUnfreeze',
]);
const PHASES = [
  'authorizationValidation', 'sourceValidation', 'artifactValidation', 'targetValidation',
  'actorFreezeValidation', 'preflight', 'recoveryPoint', 'externalActorFreeze',
  'gitPromotion', 'applicationQuiescence', 'ledgerRotation', 'baselineRecognition', 'baselineNoop',
  'reconciliationDeploy', 'structuralVerification', 'protectedDataVerification',
  'applicationDeploy', 'health', 'authenticatedSmoke', 'physicalAcceptance',
  'acceptanceTags', 'externalActorUnfreeze', 'finalReceipt',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function validateAuthorization({ file, expected }) {
  assert(file && fs.existsSync(file), 'Execute requires a Product Owner authorization artifact');
  const bytes = fs.readFileSync(file);
  const authorization = JSON.parse(bytes.toString('utf8'));
  assert.equal(authorization.authorizationVersion, 1, 'Unsupported authorization version');
  assert.equal(authorization.approval, 'PRODUCT_OWNER_AUTHORIZED_FORWARD_BASELINE_CUTOVER', 'Authorization approval text differs');
  assert.equal(authorization.environment, expected.environment, 'Authorization environment differs');
  assert.equal(authorization.resourceId, expected.resourceId, 'Authorization resource differs');
  assert.equal(authorization.candidateSha, expected.candidateSha, 'Authorization candidate differs');
  assertSha256Control(expected.receiptSha256, 'Expected release receipt SHA-256');
  assertSha256ControlMatch(authorization.receiptSha256, expected.receiptSha256, 'Authorization receipt differs');
  assert.equal(authorization.exclusiveOperatorCustodyConfirmed, true, 'Exclusive operator custody was not confirmed');
  assert.equal(authorization.proceduralResidualRiskAccepted, true, 'Procedural residual risk was not accepted');
  assert(String(authorization.operator || '').trim(), 'Authorized operator is missing');
  assert(new Date(authorization.expiresAt).getTime() > Date.now(), 'Authorization expired');
  assert(/^[a-f0-9-]{16,}$/i.test(authorization.nonce || ''), 'Authorization nonce missing');
  assertSha256ControlMatch(process.env.RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256, sha256(bytes),
    'Authorization digest environment value differs');
  return { verdict: 'PASS', authorizationSha256: sha256(bytes), expiresAt: authorization.expiresAt };
}

async function runCutover({ mode, context, driver, authorizationFile, injectFailureAfter = null, lockFactory }) {
  assert(mode === 'dry-run' || mode === 'execute', 'Mode must be dry-run or execute');
  assert(driver && typeof driver.runPhase === 'function', 'Cutover driver is required');
  assert(context.environment === 'beta' || context.environment === 'disposable', 'Unsupported cutover environment');
  const events = [];
  let mutationOccurred = false;
  let lock = null;
  let rollback = null;
  let acceptance = null;
  const priorLockToken = process.env.RELIANCE_MIGRATION_LOCK_TOKEN;
  const emit = (event) => { events.push({ at: new Date().toISOString(), ...event }); context.onEvent?.(event); };

  if (mode === 'execute') {
    if (context.environment === 'beta') {
      context.authorizationReference = validateAuthorization({ file: authorizationFile, expected: context });
      assert.equal(process.env.RELIANCE_CUTOVER_EXECUTE, 'YES', 'RELIANCE_CUTOVER_EXECUTE=YES is required');
      assert.equal(process.env.RELIANCE_MIGRATION_WRITE_APPROVED, 'YES', 'Protected migration approval is required');
    } else {
      assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY', 'Disposable rehearsal authorization is required');
    }
  }
  try {
    for (const phase of PHASES.slice(0, 5)) {
      const result = await driver.runPhase(phase, { mode, context, emit });
      emit({ phase, verdict: 'PASS', result });
    }

    if (mode === 'dry-run') {
      const result = await driver.runDryRun({ context, emit });
      emit({ phase: 'dryRun', verdict: 'PASS', result });
      return { verdict: 'PASS', mode, liveMutations: 0, cutoverWouldProceedIfAuthorized: true, events };
    }

    for (const [label, file] of [['acceptance state', context.acceptanceState],
      ['acceptance decision', context.acceptanceDecision], ['acceptance receipt', context.acceptanceReceipt]]) {
      assert(file, `${label} output is required`);
      assert(!fs.existsSync(file), `${label} output already exists`);
    }
    if (context.environment === 'beta') {
      assert(context.postSmokeReceipt, 'Post-cutover authenticated smoke output is required');
      assert(!fs.existsSync(context.postSmokeReceipt), 'Post-cutover authenticated smoke output already exists');
    }

    lock = lockFactory
      ? await lockFactory(context)
      : new CutoverLockSet({ databaseUrl: context.databaseUrl, resourceId: context.resourceId,
        heartbeatMs: context.heartbeatMs || 5000 });
    const acquired = await lock.acquire();
    process.env.RELIANCE_MIGRATION_LOCK_TOKEN = context.lockToken;
    emit({ phase: 'continuousLock', verdict: 'PASS', result: acquired });
    if (driver.assertSecondActorBlocked) await driver.assertSecondActorBlocked(context);

    const physicalAcceptanceIndex = PHASES.indexOf('physicalAcceptance');
    for (const phase of PHASES.slice(5, physicalAcceptanceIndex)) {
      await lock.assertOwned();
      if (MUTATING_PHASES.has(phase)) mutationOccurred = true;
      const result = await driver.runPhase(phase, { mode, context, emit, lock });
      emit({ phase, verdict: 'PASS', result });
      await lock.assertOwned();
      if (driver.assertSecondActorBlocked) await driver.assertSecondActorBlocked(context);
      if (injectFailureAfter === phase) throw new Error(`Injected failure after ${phase}`);
    }

    const binding = await driver.prepareAcceptance({ context });
    const databaseLockTransition = typeof lock.releaseDatabaseForAcceptance === 'function'
      ? await lock.releaseDatabaseForAcceptance()
      : { verdict: 'SIMULATED_DATABASE_LOCK_RELEASE' };
    emit({ phase: 'databaseLockTransition', verdict: 'PASS', result: databaseLockTransition });
    const assertAcceptanceInvariants = async (state) => {
      if (typeof lock.assertEnvironmentOwned === 'function') await lock.assertEnvironmentOwned();
      else await lock.assertOwned();
      return driver.verifyAcceptanceInvariants({ context, state, binding });
    };
    acceptance = await waitForAcceptance({
      stateFile: context.acceptanceState,
      decisionFile: context.acceptanceDecision,
      binding,
      timeoutMs: context.acceptanceTimeoutMs,
      pollMs: context.acceptancePollMs,
      assertInvariants: assertAcceptanceInvariants,
      simulation: context.acceptanceSimulation,
      onWaiting: (state) => emit({ phase: 'physicalAcceptance', verdict: 'PENDING', result: {
        status: state.status, cutoverId: state.cutoverId, challenge: state.challenge,
        expiresAt: state.expiresAt, checklistVersion: state.checklistVersion,
        environment: 'CONTROLLED', technicalCutover: 'PASS',
      } }),
    });
    if (acceptance.decision.action !== 'ACCEPT') {
      const error = new Error(acceptance.decision.action === 'REJECT'
        ? 'Product Owner rejected physical beta acceptance'
        : 'Product Owner physical acceptance timed out');
      error.acceptanceDecision = acceptance.decision.action;
      throw error;
    }
    await assertAcceptanceInvariants(acceptance.state);
    const acceptanceReceipt = createAcceptanceReceipt({
      output: context.acceptanceReceipt,
      state: acceptance.state,
      decision: acceptance.decision,
      decisionSha256: acceptance.decisionSha256,
      authorizationReference: context.authorizationReference,
      authoritativeSha: context.candidateSha,
      health: driver.state?.health,
      smoke: driver.state?.authenticatedSmoke,
      tagTargets: {
        previous: { name: context.tags.previous, sha: context.preCutoverSha },
        release: { name: context.tags.release, sha: context.candidateSha },
      },
    });
    context.acceptanceReceiptEvidence = acceptanceReceipt;
    emit({ phase: 'physicalAcceptance', verdict: 'PASS', result: {
      acceptedAt: acceptance.decision.decidedAt,
      cutoverId: acceptance.state.cutoverId,
      acceptanceReceiptSha256: acceptanceReceipt.sha256,
    } });

    for (const phase of PHASES.slice(physicalAcceptanceIndex + 1)) {
      if (typeof lock.assertEnvironmentOwned === 'function') await lock.assertEnvironmentOwned();
      else await lock.assertOwned();
      if (MUTATING_PHASES.has(phase)) mutationOccurred = true;
      const result = await driver.runPhase(phase, { mode, context, emit, lock });
      emit({ phase, verdict: 'PASS', result });
      if (typeof lock.assertEnvironmentOwned === 'function') await lock.assertEnvironmentOwned();
      else await lock.assertOwned();
      if (injectFailureAfter === phase) throw new Error(`Injected failure after ${phase}`);
    }
    emit({ phase: 'cutover', verdict: 'PASS' });
    return { verdict: 'PASS', mode, liveMutations: context.environment === 'beta' ? 'ALLOWLIST_ONLY' : 0, events };
  } catch (error) {
    emit({ phase: 'failure', verdict: 'FAIL', error: error.message });
    if (mode === 'execute' && mutationOccurred) {
      assert(lock, 'Rollback required but lock was never acquired');
      if (typeof lock.assertEnvironmentOwned === 'function') await lock.assertEnvironmentOwned();
      if (typeof lock.reacquireDatabaseForRollback === 'function') {
        const reacquired = await lock.reacquireDatabaseForRollback();
        emit({ phase: 'databaseLockReacquire', verdict: 'PASS', result: reacquired });
      }
      await lock.assertOwned();
      rollback = await driver.rollback({ context, emit, lock, cause: error });
      emit({ phase: 'rollback', verdict: 'PASS', result: rollback });
      await lock.assertOwned();
    }
    error.cutoverEvidence = { events, rollback, mutationOccurred,
      acceptance: acceptance ? {
        cutoverId: acceptance.state.cutoverId,
        status: acceptance.state.status,
        expiresAt: acceptance.state.expiresAt,
        decision: acceptance.decision.action,
        decisionSha256: acceptance.decisionSha256,
      } : null };
    throw error;
  } finally {
    if (lock) {
      const released = await lock.release();
      emit({ phase: 'unlock', verdict: 'PASS', result: released });
    }
    if (priorLockToken === undefined) delete process.env.RELIANCE_MIGRATION_LOCK_TOKEN;
    else process.env.RELIANCE_MIGRATION_LOCK_TOKEN = priorLockToken;
    await driver.cleanup?.({ context, emit });
  }
}

module.exports = { MUTATING_PHASES, PHASES, readJson, runCutover, sha256, validateAuthorization };
