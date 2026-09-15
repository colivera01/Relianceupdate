#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { rollbackRuntimePointer, setRuntimePointer } = require('./runtime_package.cjs');

const CONTROLLER_LOSS_CODE = 'RELIANCE_CONTROLLER_LOSS';

function controllerLoss(message = 'Injected controller loss') {
  const error = new Error(message);
  error.code = CONTROLLER_LOSS_CODE;
  return error;
}

function isControllerLoss(error) {
  return error?.code === CONTROLLER_LOSS_CODE;
}

function expectedSnapshot(journal) {
  assert(journal.quiescenceSnapshot, 'Durable quiescence snapshot identity is missing');
  return journal.quiescenceSnapshot;
}

function durableRecoveryDatabase(value, status = value?.status) {
  assert(value?.database, 'Recovery database name is missing');
  assert(value?.resourceId, 'Recovery database resource ID is missing');
  return {
    database: value.database,
    resourceId: value.resourceId,
    providerRequestId: value.providerRequestId || null,
    status,
  };
}

class CutoverV2Controller {
  constructor({ dependencies, context }) {
    this.dependencies = dependencies;
    this.context = context;
    this.events = [];
    this.sourceLocksAcquired = false;
    this.recoveryLockAcquired = false;
    this.state = {
      databaseMutationStarted: false,
      runtimeActivationStarted: false,
      runtimeActivated: false,
      durableFrozen: false,
    };
  }

  record(phase, result = {}) {
    const event = { phase, at: new Date().toISOString(), result };
    this.events.push(event);
    return event;
  }

  async preflight({ resume = false } = {}) {
    this.record('PREPARING', await this.dependencies.verifySource(this.context));
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
    if (resume) this.record('RESUME_STATE_VALIDATION', await this.dependencies.verifyResumeState(this.context));
    return { verdict: 'PASS', phases: this.events };
  }

  async checkpoint(phase, options) {
    const result = await this.dependencies.durableFreeze.checkpoint(phase, options);
    this.record(phase, result);
    if (this.dependencies.afterCheckpoint) await this.dependencies.afterCheckpoint(phase, result.document);
    return result.document;
  }

  snapshotBinding(journal) {
    assert(journal.quiescenceSnapshot?.binding,
      'Durable quiescence snapshot binding is missing');
    return journal.quiescenceSnapshot.binding;
  }

  async ensureSourceLocks() {
    if (this.sourceLocksAcquired) {
      await this.dependencies.lockHandoff.assertMutationOwnership();
      return;
    }
    await this.dependencies.lockHandoff.acquireForMutation();
    this.sourceLocksAcquired = true;
  }

  async execute() {
    try {
      this.isResume = false;
      await this.preflight();
      const frozen = await this.dependencies.durableFreeze.freeze(
        this.context.journalContext,
        async ({ controlGeneration, leaseGeneration, controllerId, cutoverCreatedAt }) => {
          const snapshot = await this.dependencies.app.freeze({
            binding: {
              cutoverId: this.context.journalContext.cutoverId,
              controlGeneration,
              targetAppServiceResourceId: this.context.journalContext.targetAppServiceResourceId,
              candidateSha: this.context.journalContext.candidateSha,
              authorizationSha256: this.context.journalContext.authorizationSha256,
              cutoverCreatedAt,
              controllerId,
              leaseGeneration,
            },
          });
          return { quiescenceSnapshot: {
            snapshotId: snapshot.snapshotId,
            snapshotSha256: snapshot.snapshotSha256,
            binding: snapshot.snapshotBinding,
          } };
        },
      );
      this.state.durableFrozen = true;
      this.record('FROZEN', frozen);
      if (this.dependencies.afterCheckpoint) await this.dependencies.afterCheckpoint('FROZEN', frozen.document);
      return await this.run(frozen.document);
    } catch (error) {
      await this.closeLocalControllerResources();
      throw error;
    }
  }

  async resume() {
    try {
      this.isResume = true;
      await this.preflight({ resume: true });
      return await this.run(await this.dependencies.durableFreeze.currentJournal());
    } catch (error) {
      await this.closeLocalControllerResources();
      throw error;
    }
  }

  async closeLocalControllerResources() {
    try {
      await this.dependencies.lockHandoff?.closeLocalConnectionsForControllerExit?.();
    } catch {}
    try {
      this.dependencies.durableFreeze?.stopControllerHeartbeat?.();
    } catch {}
  }

  async run(initialJournal) {
    let journal = initialJournal;
    try {
      while (true) {
        switch (journal.phase) {
          case 'FROZEN': {
            const snapshot = await this.dependencies.app.freeze({
              binding: this.snapshotBinding(journal),
              expectedSnapshot: journal.quiescenceSnapshot,
            });
            journal = await this.checkpoint('QUIESCED', { evidence: {
              verdict: snapshot.verdict, snapshotId: snapshot.snapshotId,
              snapshotSha256: snapshot.snapshotSha256, originalSnapshotPreserved: true,
            }, patch: { quiescenceSnapshot: { snapshotId: snapshot.snapshotId,
              snapshotSha256: snapshot.snapshotSha256, binding: snapshot.snapshotBinding } } });
            break;
          }
          case 'QUIESCED': {
            await this.ensureSourceLocks();
            const recoveryPoint = await this.dependencies.database.captureRecoveryPoint();
            assert(recoveryPoint && recoveryPoint.recoveryTimestamp, 'Durable recovery point evidence is incomplete');
            journal = await this.checkpoint('DB_MUTATION_STARTED', {
              evidence: { verdict: 'PASS', recoveryTimestamp: recoveryPoint.recoveryTimestamp,
                sourceDatabaseResourceId: recoveryPoint.sourceDatabaseResourceId },
              patch: { recoveryPoint },
            });
            this.state.databaseMutationStarted = true;
            break;
          }
          case 'DB_MUTATION_STARTED':
          case 'LEDGER_ROTATION_STARTED':
          case 'LEDGER_ROTATED':
          case 'BASELINE_RECOGNITION_STARTED':
          case 'BASELINE_RECOGNIZED':
          case 'RECONCILIATION_STARTED': {
            await this.ensureSourceLocks();
            journal = await this.dependencies.database.continueMigration({
              journal,
              resume: this.isResume,
              checkpoint: (phase, options) => this.checkpoint(phase, options),
            });
            break;
          }
          case 'RECONCILIATION_APPLIED': {
            const observed = await this.dependencies.runtime.inspect();
            assert(['RECOVERY_ACTIVE', 'CANDIDATE_ACTIVE'].includes(observed.state),
              'Current package state is unknown before candidate activation');
            journal = await this.checkpoint('CANDIDATE_POINTER_SWITCH_STARTED', {
              evidence: { verdict: 'PASS', observedPackageState: observed.state },
              patch: { packageState: { ...journal.packageState, expectedActive: 'CANDIDATE',
                observedActive: 'TRANSITION_PENDING', transitionFrom: observed.state,
                transitionTo: 'CANDIDATE' } },
            });
            break;
          }
          case 'CANDIDATE_POINTER_SWITCH_STARTED': {
            this.state.runtimeActivationStarted = true;
            const activation = await setRuntimePointer({
              runtime: this.context.candidateRuntime,
              ...this.dependencies.runtime,
            });
            journal = await this.checkpoint('CANDIDATE_POINTER_SET', {
              evidence: { verdict: activation.verdict, activation: activation.activation || 'ALREADY_ACTIVE' },
              patch: { packageState: { ...journal.packageState, expectedActive: 'CANDIDATE',
                observedActive: 'CANDIDATE', transitionFrom: null, transitionTo: null } },
            });
            this.state.runtimeActivated = true;
            break;
          }
          case 'CANDIDATE_POINTER_SET': {
            await this.dependencies.app.restrictedRestart({
              expectedSnapshot: expectedSnapshot(journal),
              mutationBoundary: journal.recoveryPoint?.mutationBoundaryAt || null,
            });
            const running = await this.dependencies.runtime.verifyCandidate();
            journal = await this.checkpoint('CANDIDATE_STARTED', {
              evidence: { verdict: running.verdict, candidateSha: journal.candidateSha },
            });
            break;
          }
          case 'CANDIDATE_STARTED': {
            const technical = await this.dependencies.verifyTechnical(this.context);
            journal = await this.checkpoint('POST_DEPLOY_VERIFIED', {
              evidence: technical,
            });
            break;
          }
          case 'POST_DEPLOY_VERIFIED': {
            const acceptance = await this.dependencies.acceptance.prepare(this.context, journal);
            assert(acceptance && acceptance.createdAt && acceptance.expiresAt && acceptance.challenge,
              'Durable Product Owner acceptance state is incomplete');
            journal = await this.checkpoint('WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE', {
              evidence: { verdict: 'PASS', challengeSha256: acceptance.challenge,
                expiresAt: acceptance.expiresAt },
              patch: { acceptance },
            });
            break;
          }
          case 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE': {
            await this.dependencies.app.verifyAcceptanceMode();
            const acceptance = await this.dependencies.acceptance.wait(this.context, journal.acceptance);
            if (acceptance.action !== 'ACCEPT') return this.rollback(acceptance.action, journal);
            const receipt = await this.dependencies.acceptance.createReceipt(acceptance, this.context, journal.acceptance);
            journal = await this.checkpoint('ACCEPTED', {
              evidence: { verdict: 'PASS', receiptSha256: receipt.sha256 },
            });
            return this.finishOpen(journal, receipt, 'ACCEPTED');
          }
          case 'ACCEPTED': {
            const receipt = await this.dependencies.acceptance.resumeReceipt(this.context, journal);
            return this.finishOpen(journal, receipt, 'ACCEPTED');
          }
          case 'ROLLBACK_REQUESTED':
          case 'PITR_IN_PROGRESS':
          case 'RECOVERY_DB_VERIFIED':
          case 'RECOVERY_DB_LOCKED':
          case 'DB_SWITCHED_TO_RECOVERY':
          case 'RUNTIME_RECOVERY_COMPLETE':
          case 'GIT_RECOVERY_COMPLETE':
          case 'RECOVERY_VERIFIED':
          case 'FAILED_FROZEN':
            return this.rollback(journal.lastError?.reason || 'RESUMED_RECOVERY', journal);
          default:
            throw new Error(`Unsupported durable resume phase: ${journal.phase}`);
        }
      }
    } catch (error) {
      if (isControllerLoss(error)) throw error;
      try {
        const current = await this.dependencies.durableFreeze.currentJournal();
        if (current.phase !== 'FAILED_FROZEN') await this.dependencies.durableFreeze.markFailedFrozen(error, {
          failedPhase: current.phase,
        });
        const failed = await this.dependencies.durableFreeze.currentJournal();
        return this.rollback('TECHNICAL_FAILURE', failed, error);
      } catch (recoveryError) {
        if (isControllerLoss(recoveryError)) throw recoveryError;
        throw recoveryError;
      }
    }
  }

  async rollback(reason, initialJournal = null, cause = null) {
    let journal = initialJournal || await this.dependencies.durableFreeze.currentJournal();
    let pitrStartedByThisController = false;
    try {
      if (journal.phase === 'FAILED_FROZEN') {
        journal = await this.checkpoint('ROLLBACK_REQUESTED', {
          evidence: { verdict: 'RECOVERY_REQUESTED', reason, cause: cause?.message || null },
          patch: { lastError: { reason, cause: cause?.message || journal.lastError?.message || null } },
        });
      } else if (journal.phase !== 'ROLLBACK_REQUESTED' && ![
        'PITR_IN_PROGRESS', 'RECOVERY_DB_VERIFIED', 'RECOVERY_DB_LOCKED', 'DB_SWITCHED_TO_RECOVERY',
        'RUNTIME_RECOVERY_COMPLETE', 'GIT_RECOVERY_COMPLETE', 'RECOVERY_VERIFIED',
      ].includes(journal.phase)) {
        journal = await this.checkpoint('ROLLBACK_REQUESTED', {
          evidence: { verdict: 'RECOVERY_REQUESTED', reason, cause: cause?.message || null },
          patch: { lastError: { reason, cause: cause?.message || null } },
        });
      }

      if (journal.phase === 'ROLLBACK_REQUESTED' && journal.recoveryPoint) {
        const recoveryDatabase = journal.recoveryDatabase
          || await this.dependencies.database.planRecovery(journal.recoveryPoint, journal);
        journal = await this.checkpoint('PITR_IN_PROGRESS', {
          evidence: { verdict: 'PITR_REQUESTED', recoveryDatabase: recoveryDatabase.database,
            recoveryTimestamp: journal.recoveryPoint.recoveryTimestamp },
          patch: { recoveryDatabase: durableRecoveryDatabase(recoveryDatabase, 'PITR_IN_PROGRESS') },
        });
        pitrStartedByThisController = true;
      }
      if (journal.phase === 'PITR_IN_PROGRESS') {
        await this.dependencies.lockHandoff.abandonOriginalForPitr();
        const restored = await this.dependencies.database.restore(journal.recoveryPoint,
          journal.recoveryDatabase, { allowStart: pitrStartedByThisController });
        const verified = await this.dependencies.database.verifyRecovery(restored, journal.recoveryPoint);
        journal = await this.checkpoint('RECOVERY_DB_VERIFIED', {
          evidence: verified,
          patch: { recoveryDatabase: durableRecoveryDatabase({ ...journal.recoveryDatabase, ...restored }, 'VERIFIED') },
        });
      }
      if (journal.phase === 'RECOVERY_DB_VERIFIED') {
        await this.dependencies.lockHandoff.abandonOriginalForPitr();
        const resolvedRecovery = await this.dependencies.database.resolveRecovery(journal.recoveryDatabase);
        await this.dependencies.lockHandoff.acquireRecovery(resolvedRecovery);
        this.recoveryLockAcquired = true;
        journal = await this.checkpoint('RECOVERY_DB_LOCKED', {
          evidence: { verdict: 'RECOVERY_DATABASE_LOCK_ACQUIRED',
            resourceId: journal.recoveryDatabase.resourceId },
        });
      }
      if (journal.phase === 'RECOVERY_DB_LOCKED') {
        const resolvedRecovery = await this.dependencies.database.resolveRecovery(journal.recoveryDatabase);
        if (!this.recoveryLockAcquired) {
          await this.dependencies.lockHandoff.abandonOriginalForPitr();
          await this.dependencies.lockHandoff.acquireRecovery(resolvedRecovery);
          this.recoveryLockAcquired = true;
        }
        await this.dependencies.lockHandoff.assertCanSwitchConnection();
        await this.dependencies.database.switchConnection(resolvedRecovery);
        journal = await this.checkpoint('DB_SWITCHED_TO_RECOVERY', {
          evidence: { verdict: 'PASS', resourceId: journal.recoveryDatabase.resourceId },
          patch: { currentDatabase: { role: 'RECOVERY', resourceId: journal.recoveryDatabase.resourceId,
            database: journal.recoveryDatabase.database } },
        });
      }
      if (journal.phase === 'ROLLBACK_REQUESTED' || journal.phase === 'DB_SWITCHED_TO_RECOVERY') {
        const runtimeRecovery = await rollbackRuntimePointer({
          recoveryRuntime: this.context.recoveryRuntime,
          ...this.dependencies.runtime,
        });
        journal = await this.checkpoint('RUNTIME_RECOVERY_COMPLETE', {
          evidence: runtimeRecovery,
          patch: { packageState: { ...journal.packageState, expectedActive: 'RECOVERY',
            observedActive: 'RECOVERY' } },
        });
      }
      if (journal.phase === 'RUNTIME_RECOVERY_COMPLETE') {
        const git = await this.dependencies.git.forwardOnlyRecovery();
        journal = await this.checkpoint('GIT_RECOVERY_COMPLETE', { evidence: git || { verdict: 'PASS' } });
      }
      if (journal.phase === 'GIT_RECOVERY_COMPLETE') {
        await this.dependencies.app.restrictedRestart({
          expectedSnapshot: expectedSnapshot(journal),
          mutationBoundary: journal.recoveryPoint?.mutationBoundaryAt || null,
        });
        const runtime = await this.dependencies.runtime.verifyRecovery();
        const recovered = await this.dependencies.verifyRecovered(this.context, journal);
        journal = await this.checkpoint('RECOVERY_VERIFIED', {
          evidence: { verdict: 'PASS', runtime, recovered },
        });
      }
      if (journal.phase !== 'RECOVERY_VERIFIED') {
        throw new Error(`Recovery cannot continue from durable phase ${journal.phase}`);
      }
      const receipt = await this.dependencies.createRecoveryReceipt({ reason, journal, events: this.events });
      return this.finishOpen(journal, receipt, 'RECOVERED');
    } catch (error) {
      if (isControllerLoss(error)) throw error;
      await this.dependencies.durableFreeze.markFailedFrozen(error, { recoveryReason: reason }).catch(() => {});
      throw error;
    }
  }

  async finishOpen(initialJournal, receipt, verdict) {
    let journal = initialJournal;
    journal = await this.checkpoint('CLEANUP_IN_PROGRESS', {
      evidence: await this.dependencies.cleanup({ whileFrozen: true }),
    });
    await this.dependencies.app.restore({
      expectedSnapshot: expectedSnapshot(journal),
      mutationBoundary: journal.recoveryPoint?.mutationBoundaryAt || null,
    });
    const opened = await this.dependencies.durableFreeze.reopen({ acceptanceReceiptSha256: receipt.sha256 });
    await this.dependencies.lockHandoff.releaseAfterExplicitReopen?.();
    this.record('OPEN', opened);
    return { verdict, reason: journal.lastError?.reason || null, journal: opened.document,
      events: this.events, receipt };
  }
}

module.exports = { CONTROLLER_LOSS_CODE, CutoverV2Controller, controllerLoss,
  durableRecoveryDatabase, isControllerLoss };
