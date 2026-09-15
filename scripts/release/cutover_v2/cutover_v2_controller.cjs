#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { activateRuntime, rollbackRuntime } = require('./runtime_package.cjs');

const PHASES = Object.freeze([
  'PREPARATION',
  'PARITY_VALIDATION',
  'PACKAGE_PRESTAGE_VERIFICATION',
  'TARGET_VALIDATION',
  'ACTOR_FREEZE',
  'DURABLE_ENVIRONMENT_FREEZE',
  'ORIGINAL_DATABASE_LOCK',
  'DATABASE_MUTATION',
  'RUNTIME_POINTER_SWITCH',
  'TECHNICAL_VERIFICATION',
  'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE',
  'ACCEPTED',
  'ROLLBACK',
  'RECOVERED',
  'CLEANUP',
]);

class CutoverV2Controller {
  constructor({ dependencies, context }) {
    this.dependencies = dependencies;
    this.context = context;
    this.events = [];
    this.state = {
      phase: 'PREPARATION',
      databaseMutationStarted: false,
      runtimeActivationStarted: false,
      runtimeActivated: false,
      gitPromoted: false,
      durableFrozen: false,
      originalDatabaseAbandoned: false,
    };
  }

  record(phase, result = {}) {
    assert(PHASES.includes(phase), `Unknown Cutover V2 phase: ${phase}`);
    this.state.phase = phase;
    const event = { phase, at: new Date().toISOString(), result };
    this.events.push(event);
    return event;
  }

  async preflight() {
    this.record('PREPARATION', await this.dependencies.verifySource(this.context));
    const parity = await this.dependencies.verifyParity(this.context);
    assert.equal(parity.verdict, 'PASS', 'Live/disposable parity failed');
    assert.equal(parity.liveAndDisposableDeploymentImplementationPath, 'MATCH',
      'Live and disposable activation implementations differ');
    this.record('PARITY_VALIDATION', parity);
    const packages = await this.dependencies.verifyPackages(this.context);
    assert.equal(packages.candidate.verdict, 'PASS');
    assert.equal(packages.recovery.verdict, 'PASS');
    this.record('PACKAGE_PRESTAGE_VERIFICATION', packages);
    this.record('TARGET_VALIDATION', await this.dependencies.verifyTarget(this.context));
    return { verdict: 'PASS', phases: this.events };
  }

  async execute() {
    try {
      await this.preflight();
      this.record('ACTOR_FREEZE', await this.dependencies.app.freeze());
      const durable = await this.dependencies.durableFreeze.freeze({
        operationId: this.context.operationId,
        targetResourceId: this.context.targetResourceId,
      });
      this.state.durableFrozen = true;
      this.record('DURABLE_ENVIRONMENT_FREEZE', durable);
      this.record('ORIGINAL_DATABASE_LOCK', await this.dependencies.lockHandoff.acquireForMutation());
      this.state.recoveryPoint = await this.dependencies.database.captureRecoveryPoint();
      this.state.gitPromoted = true;
      await this.dependencies.git.promoteCandidate();
      this.state.databaseMutationStarted = true;
      const migration = await this.dependencies.database.migrate();
      await this.dependencies.lockHandoff.assertMutationOwnership();
      this.record('DATABASE_MUTATION', migration);

      this.state.runtimeActivationStarted = true;
      const activation = await activateRuntime({
        runtime: this.context.candidateRuntime,
        ...this.dependencies.runtime,
      });
      this.state.runtimeActivated = true;
      this.record('RUNTIME_POINTER_SWITCH', activation);
      this.record('TECHNICAL_VERIFICATION', await this.dependencies.verifyTechnical(this.context));

      await this.dependencies.database.releaseOriginalMutationLock?.();
      await this.dependencies.app.enableAcceptanceReadOnly();
      this.record('WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE', { timeoutMinutes: 30 });
      const acceptance = await this.dependencies.acceptance.wait(this.context);
      if (acceptance.action !== 'ACCEPT') return this.rollback(acceptance.action);

      const receipt = await this.dependencies.acceptance.createReceipt(acceptance, this.context);
      this.record('CLEANUP', await this.dependencies.cleanup({ whileFrozen: true }));
      await this.dependencies.durableFreeze.reopen({ acceptanceReceiptSha256: receipt.sha256 });
      await this.dependencies.app.disableAcceptanceReadOnly();
      await this.dependencies.app.restoreNormalAccess();
      this.record('ACCEPTED', { receiptSha256: receipt.sha256 });
      return { verdict: 'ACCEPTED', state: this.state, events: this.events, receipt };
    } catch (error) {
      if (!this.state.durableFrozen) throw error;
      return this.rollback('TECHNICAL_FAILURE', error);
    }
  }

  async rollback(reason, cause = null) {
    this.record('ROLLBACK', { reason, cause: cause?.message || null });
    await this.dependencies.app.freeze();
    let databaseRecovery = { verdict: 'NOT_REQUIRED' };
    if (this.state.databaseMutationStarted) {
      await this.dependencies.lockHandoff.abandonOriginalForPitr();
      this.state.originalDatabaseAbandoned = true;
      const restored = await this.dependencies.database.restore(this.state.recoveryPoint);
      await this.dependencies.database.verifyRecovery(restored);
      await this.dependencies.lockHandoff.acquireRecovery(restored);
      await this.dependencies.lockHandoff.assertCanSwitchConnection();
      await this.dependencies.database.switchConnection(restored);
      databaseRecovery = { verdict: 'PASS', resourceId: restored.resourceId };
    }

    const runtimeRecovery = await rollbackRuntime({
      recoveryRuntime: this.context.recoveryRuntime,
      ...this.dependencies.runtime,
    });
    if (this.state.gitPromoted) await this.dependencies.git.forwardOnlyRecovery();
    await this.dependencies.app.enableAcceptanceReadOnly();
    await this.dependencies.app.restrictedStart();
    await this.dependencies.verifyRecovered(this.context);
    const receipt = await this.dependencies.createRecoveryReceipt({
      reason,
      databaseRecovery,
      runtimeRecovery,
      events: this.events,
    });
    this.record('CLEANUP', await this.dependencies.cleanup({ whileFrozen: true }));
    await this.dependencies.durableFreeze.reopen({ acceptanceReceiptSha256: receipt.sha256 });
    await this.dependencies.app.disableAcceptanceReadOnly();
    await this.dependencies.app.restoreNormalAccess();
    this.record('RECOVERED', { databaseRecovery, runtimeRecovery, receiptSha256: receipt.sha256 });
    return { verdict: 'RECOVERED', reason, state: this.state, events: this.events, receipt };
  }
}

module.exports = { CutoverV2Controller, PHASES };
