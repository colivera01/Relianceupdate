#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const STATE_OPEN = 'OPEN';
const STATE_FROZEN = 'FROZEN';
const DURABLE_PHASES = Object.freeze([
  'PREPARING',
  'FROZEN',
  'QUIESCED',
  'DB_MUTATION_STARTED',
  'LEDGER_ROTATION_STARTED',
  'LEDGER_ROTATED',
  'BASELINE_RECOGNITION_STARTED',
  'BASELINE_RECOGNIZED',
  'RECONCILIATION_STARTED',
  'RECONCILIATION_APPLIED',
  'CANDIDATE_POINTER_SWITCH_STARTED',
  'CANDIDATE_POINTER_SET',
  'CANDIDATE_STARTED',
  'POST_DEPLOY_VERIFIED',
  'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE',
  'ROLLBACK_REQUESTED',
  'PITR_IN_PROGRESS',
  'RECOVERY_DB_VERIFIED',
  'RECOVERY_DB_LOCKED',
  'DB_SWITCHED_TO_RECOVERY',
  'RUNTIME_RECOVERY_COMPLETE',
  'GIT_RECOVERY_COMPLETE',
  'RECOVERY_VERIFIED',
  'ACCEPTED',
  'CLEANUP_IN_PROGRESS',
  'FAILED_FROZEN',
  'OPEN',
]);

const NORMAL_TRANSITIONS = {
  FROZEN: ['QUIESCED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  QUIESCED: ['DB_MUTATION_STARTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  DB_MUTATION_STARTED: ['LEDGER_ROTATION_STARTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  LEDGER_ROTATION_STARTED: ['LEDGER_ROTATED', 'FAILED_FROZEN'],
  LEDGER_ROTATED: ['BASELINE_RECOGNITION_STARTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  BASELINE_RECOGNITION_STARTED: ['BASELINE_RECOGNIZED', 'FAILED_FROZEN'],
  BASELINE_RECOGNIZED: ['RECONCILIATION_STARTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  RECONCILIATION_STARTED: ['RECONCILIATION_APPLIED', 'FAILED_FROZEN'],
  RECONCILIATION_APPLIED: ['CANDIDATE_POINTER_SWITCH_STARTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  CANDIDATE_POINTER_SWITCH_STARTED: ['CANDIDATE_POINTER_SET', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  CANDIDATE_POINTER_SET: ['CANDIDATE_STARTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  CANDIDATE_STARTED: ['POST_DEPLOY_VERIFIED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  POST_DEPLOY_VERIFIED: ['WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE: ['ACCEPTED', 'ROLLBACK_REQUESTED', 'FAILED_FROZEN'],
  ACCEPTED: ['CLEANUP_IN_PROGRESS', 'FAILED_FROZEN'],
  ROLLBACK_REQUESTED: ['PITR_IN_PROGRESS', 'RUNTIME_RECOVERY_COMPLETE', 'FAILED_FROZEN'],
  PITR_IN_PROGRESS: ['RECOVERY_DB_VERIFIED', 'FAILED_FROZEN'],
  RECOVERY_DB_VERIFIED: ['RECOVERY_DB_LOCKED', 'FAILED_FROZEN'],
  RECOVERY_DB_LOCKED: ['DB_SWITCHED_TO_RECOVERY', 'FAILED_FROZEN'],
  DB_SWITCHED_TO_RECOVERY: ['RUNTIME_RECOVERY_COMPLETE', 'FAILED_FROZEN'],
  RUNTIME_RECOVERY_COMPLETE: ['GIT_RECOVERY_COMPLETE', 'FAILED_FROZEN'],
  GIT_RECOVERY_COMPLETE: ['RECOVERY_VERIFIED', 'FAILED_FROZEN'],
  RECOVERY_VERIFIED: ['CLEANUP_IN_PROGRESS', 'FAILED_FROZEN'],
  CLEANUP_IN_PROGRESS: ['OPEN', 'FAILED_FROZEN'],
  FAILED_FROZEN: ['ROLLBACK_REQUESTED', 'PITR_IN_PROGRESS', 'FAILED_FROZEN'],
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const isSha256 = (value) => /^[a-f0-9]{64}$/i.test(value || '');
const isCommit = (value) => /^[a-f0-9]{40}$/i.test(value || '');
const isResource = (value) => String(value || '').startsWith('/subscriptions/');

function ownerFingerprint(owner) {
  assert(owner, 'Cutover owner is required');
  return sha256(owner);
}

function validateOpenState(document) {
  assert.equal(document.state, STATE_OPEN, 'Durable cutover state is not OPEN');
  assert(Number.isSafeInteger(document.generation) && document.generation >= 0,
    'Durable cutover generation is invalid');
  return document;
}

function validateJournal(document) {
  assert.equal(document.version, 2, 'Unsupported durable cutover journal version');
  assert([STATE_OPEN, STATE_FROZEN].includes(document.state), 'Durable cutover state is invalid');
  assert(DURABLE_PHASES.includes(document.phase), 'Durable cutover phase is invalid');
  assert(Number.isSafeInteger(document.generation) && document.generation >= 1,
    'Durable cutover journal generation is invalid');
  assert(Number.isSafeInteger(document.controlGeneration) && document.controlGeneration >= 1,
    'Durable control generation is invalid');
  assert(Number.isSafeInteger(document.leaseGeneration) && document.leaseGeneration >= 1,
    'Durable lease generation is invalid');
  assert(String(document.cutoverId || '').trim(), 'Durable cutover ID is missing');
  for (const field of ['targetAppServiceResourceId', 'targetSqlServerResourceId', 'targetDatabaseResourceId']) {
    assert(isResource(document[field]), `Durable ${field} is invalid`);
  }
  assert(isCommit(document.candidateSha), 'Durable candidate SHA is invalid');
  for (const field of ['candidatePackageSha256', 'migrationArtifactSha256', 'releaseReceiptSha256',
    'authorizationSha256', 'recoveryPackageSha256']) {
    assert(isSha256(document[field]), `Durable ${field} is invalid`);
  }
  assert(document.controller && document.controller.id && isSha256(document.controller.idSha256),
    'Durable controller identity is invalid');
  assert(isSha256(document.controller.leaseIdSha256), 'Durable controller lease identity is invalid');
  assert(!Number.isNaN(new Date(document.createdAt).getTime()), 'Durable cutover creation time is invalid');
  assert(!Number.isNaN(new Date(document.lastUpdatedAt).getTime()), 'Durable cutover update time is invalid');
  assert(document.packageState && document.packageState.candidate && document.packageState.recovery,
    'Durable package state is incomplete');
  if (document.recoveryDatabase) {
    assert(!Object.hasOwn(document.recoveryDatabase, 'databaseUrl'),
      'Durable recovery database must not persist a connection value');
  }
  assert(Array.isArray(document.events) && document.events.length >= 1, 'Durable cutover events are missing');
  if (document.phase === 'OPEN') assert.equal(document.state, STATE_OPEN, 'OPEN phase must have OPEN state');
  else assert.equal(document.state, STATE_FROZEN, 'Non-OPEN phase must remain FROZEN');
  return document;
}

function validateState(document) {
  assert(document && typeof document === 'object', 'Durable cutover state is unavailable');
  if (document.version === 2) return validateJournal(document);
  assert.equal(document.version, 1, 'Unsupported durable cutover state version');
  return validateOpenState(document);
}

function assertFreezeContext(context) {
  assert(context && typeof context === 'object', 'Durable cutover context is required');
  assert(String(context.cutoverId || '').trim(), 'Cutover ID is required');
  assert(Number.isSafeInteger(context.expectedOpenGeneration) && context.expectedOpenGeneration >= 0,
    'Expected OPEN generation is required');
  for (const field of ['targetAppServiceResourceId', 'targetSqlServerResourceId', 'targetDatabaseResourceId']) {
    assert(isResource(context[field]), `${field} is invalid`);
  }
  assert(isCommit(context.candidateSha), 'Candidate SHA is invalid');
  for (const field of ['candidatePackageSha256', 'migrationArtifactSha256', 'releaseReceiptSha256',
    'authorizationSha256', 'recoveryPackageSha256']) {
    assert(isSha256(context[field]), `${field} is invalid`);
  }
  assert(context.packageState?.candidate && context.packageState?.recovery,
    'Initial durable package state is incomplete');
  assert(context.currentDatabase?.resourceId === context.targetDatabaseResourceId,
    'Initial durable database state differs from the target');
  return context;
}

function equalityFields() {
  return ['cutoverId', 'targetAppServiceResourceId', 'targetSqlServerResourceId',
    'targetDatabaseResourceId', 'candidateSha', 'candidatePackageSha256',
    'migrationArtifactSha256', 'releaseReceiptSha256', 'authorizationSha256',
    'recoveryPackageSha256'];
}

class DurableFreezeController {
  constructor({ store, owner, now = () => new Date(), heartbeatMs = 20000 }) {
    assert(store, 'Durable store is required');
    assert(Number.isInteger(heartbeatMs) && heartbeatMs >= 1000, 'Lease heartbeat must be at least one second');
    assert(String(owner || '').trim(), 'Controller ID is required');
    this.store = store;
    this.controllerId = owner;
    this.owner = ownerFingerprint(owner);
    this.now = now;
    this.heartbeatMs = heartbeatMs;
    this.lease = null;
    this.timer = null;
    this.lostError = null;
  }

  async inspect() {
    try {
      const document = validateState(await this.store.read());
      return { verdict: document.state === STATE_OPEN ? 'OPEN' : 'FAIL_CLOSED', document };
    } catch (error) {
      return { verdict: 'FAIL_CLOSED', document: null, reason: error.message };
    }
  }

  startHeartbeat() {
    this.timer = setInterval(() => void this.renew(), this.heartbeatMs);
    this.timer.unref?.();
  }

  stopControllerHeartbeat() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return { verdict: 'LEASE_RENEWAL_STOPPED_FOR_CONTROLLER_EXIT' };
  }

  async freeze(context, prepareFreeze = null) {
    assertFreezeContext(context);
    this.lease = await this.store.acquireLease();
    try {
      const before = validateState(await this.store.read({ leaseId: this.lease.id }));
      validateOpenState(before);
      assert.equal(before.generation, context.expectedOpenGeneration, 'OPEN control generation differs');
      const now = this.now().toISOString();
      const controlGeneration = before.generation + 1;
      const controller = {
        id: this.controllerId,
        idSha256: this.owner,
        status: 'ACTIVE',
        leaseIdSha256: sha256(this.lease.id),
      };
      const prepared = prepareFreeze
        ? await prepareFreeze({
          controlGeneration,
          leaseGeneration: 1,
          controllerId: this.controllerId,
          cutoverCreatedAt: now,
        })
        : null;
      if (prepareFreeze) {
        assert(prepared?.quiescenceSnapshot?.snapshotId,
          'Prepared freeze did not return a quiescence snapshot ID');
        assert(isSha256(prepared.quiescenceSnapshot.snapshotSha256),
          'Prepared freeze did not return a valid quiescence snapshot hash');
      }
      const preparing = { phase: 'PREPARING', at: now, evidenceSha256: sha256(JSON.stringify({
        cutoverId: context.cutoverId, candidateSha: context.candidateSha,
      })) };
      const frozen = { phase: 'FROZEN', at: now, evidenceSha256: sha256(JSON.stringify(controller)) };
      const document = {
        version: 2,
        state: STATE_FROZEN,
        phase: 'FROZEN',
        lastCompletedCheckpoint: 'PREPARING',
        generation: controlGeneration,
        controlGeneration,
        leaseGeneration: 1,
        cutoverId: context.cutoverId,
        operationId: context.cutoverId,
        targetAppServiceResourceId: context.targetAppServiceResourceId,
        targetSqlServerResourceId: context.targetSqlServerResourceId,
        targetDatabaseResourceId: context.targetDatabaseResourceId,
        candidateSha: context.candidateSha.toLowerCase(),
        candidatePackageSha256: context.candidatePackageSha256.toLowerCase(),
        migrationArtifactSha256: context.migrationArtifactSha256.toLowerCase(),
        releaseReceiptSha256: context.releaseReceiptSha256.toLowerCase(),
        authorizationSha256: context.authorizationSha256.toLowerCase(),
        recoveryPackageSha256: context.recoveryPackageSha256.toLowerCase(),
        quiescenceSnapshot: prepared?.quiescenceSnapshot || null,
        recoveryPoint: null,
        currentDatabase: context.currentDatabase,
        packageState: context.packageState,
        acceptance: null,
        recoveryDatabase: null,
        controller,
        previousControllers: [],
        createdAt: now,
        lastUpdatedAt: now,
        reopenedAt: null,
        events: [preparing, frozen],
      };
      await this.store.write(document, { leaseId: this.lease.id });
      await this.assertFrozen();
      this.startHeartbeat();
      return { verdict: 'FROZEN', generation: document.generation,
        controlGeneration, leaseGeneration: document.leaseGeneration, controllerId: this.controllerId,
        document };
    } catch (error) {
      await this.store.releaseLease(this.lease.id).catch(() => {});
      this.lease = null;
      throw error;
    }
  }

  async resumeFrozen(expected) {
    assert(expected && typeof expected === 'object', 'Exact adoption context is required');
    assert(Number.isSafeInteger(expected.expectedGeneration) && expected.expectedGeneration >= 1,
      'Exact durable generation is required');
    const status = expected.previousControllerStatus;
    assert(['LEASE_EXPIRED', 'PROCESS_CONFIRMED_LOST', 'EXPLICITLY_RELINQUISHED'].includes(status),
      'Reviewed previous-controller status is required');
    this.lease = await this.store.acquireLease();
    try {
      const before = validateJournal(await this.store.read({ leaseId: this.lease.id }));
      assert.equal(before.state, STATE_FROZEN, 'Only a frozen environment can be adopted');
      assert.notEqual(before.phase, 'OPEN', 'OPEN operation cannot be adopted');
      assert.equal(before.generation, expected.expectedGeneration, 'Frozen operation generation differs');
      for (const field of equalityFields()) {
        assert.equal(String(before[field]).toLowerCase(), String(expected[field]).toLowerCase(),
          `Frozen ${field} differs`);
      }
      if (expected.expectedPhase) assert.equal(before.phase, expected.expectedPhase, 'Frozen phase differs');
      if (before.quiescenceSnapshot || expected.quiescenceSnapshot) {
        assert.deepEqual(before.quiescenceSnapshot, expected.quiescenceSnapshot,
          'Frozen quiescence snapshot identity differs');
      }
      if (status === 'EXPLICITLY_RELINQUISHED') {
        assert.equal(before.controller.status, 'EXPLICITLY_RELINQUISHED',
          'Previous controller was not explicitly relinquished');
      } else {
        assert(['ACTIVE', 'LEASE_EXPIRED', 'PROCESS_CONFIRMED_LOST'].includes(before.controller.status),
          'Previous controller ownership state is not adoptable');
      }
      const now = this.now().toISOString();
      const previous = { id: before.controller.id, idSha256: before.controller.idSha256,
        leaseIdSha256: before.controller.leaseIdSha256, status, endedAt: now };
      const document = {
        ...before,
        generation: before.generation + 1,
        leaseGeneration: before.leaseGeneration + 1,
        controller: { id: this.controllerId, idSha256: this.owner, status: 'ACTIVE',
          leaseIdSha256: sha256(this.lease.id) },
        previousControllers: [...before.previousControllers, previous],
        lastUpdatedAt: now,
        events: [...before.events, { phase: before.phase, at: now, action: 'CONTROLLER_ADOPTED',
          previousControllerId: previous.id, previousLeaseIdSha256: previous.leaseIdSha256,
          previousControllerStatus: status, newControllerId: this.controllerId,
          newLeaseIdSha256: sha256(this.lease.id),
          evidenceSha256: sha256(JSON.stringify({ expected, previous })) }],
      };
      await this.store.write(document, { leaseId: this.lease.id });
      await this.assertFrozen();
      this.startHeartbeat();
      return { verdict: 'FROZEN_ADOPTED', generation: document.generation,
        controlGeneration: document.controlGeneration, leaseGeneration: document.leaseGeneration,
        phase: document.phase, previousControllerStatus: status, document };
    } catch (error) {
      if (this.lease) await this.store.releaseLease(this.lease.id).catch(() => {});
      this.lease = null;
      throw error;
    }
  }

  async checkpoint(phase, { evidence, patch = {} } = {}) {
    await this.assertFrozen();
    assert(DURABLE_PHASES.includes(phase) && phase !== 'OPEN', 'Durable checkpoint phase is invalid');
    assert(evidence && typeof evidence === 'object' && Object.keys(evidence).length > 0,
      'Durable checkpoint evidence is required');
    const before = validateJournal(await this.store.read({ leaseId: this.lease.id }));
    assert((NORMAL_TRANSITIONS[before.phase] || []).includes(phase),
      `Impossible durable transition ${before.phase} -> ${phase}`);
    const permittedPatch = new Set(['quiescenceSnapshot', 'recoveryPoint', 'currentDatabase',
      'packageState', 'acceptance', 'recoveryDatabase', 'lastError']);
    for (const field of Object.keys(patch)) assert(permittedPatch.has(field), `Durable patch field ${field} is not permitted`);
    const now = this.now().toISOString();
    const document = {
      ...before,
      ...patch,
      phase,
      lastCompletedCheckpoint: before.phase,
      generation: before.generation + 1,
      lastUpdatedAt: now,
      events: [...before.events, { phase, at: now, evidence, evidenceSha256: sha256(JSON.stringify(evidence)) }],
    };
    await this.store.write(document, { leaseId: this.lease.id });
    await this.assertFrozen();
    return { verdict: 'CHECKPOINT_RECORDED', phase, generation: document.generation, document };
  }

  async markFailedFrozen(error, evidence = {}) {
    await this.assertFrozen();
    const before = validateJournal(await this.store.read({ leaseId: this.lease.id }));
    if (before.phase === 'FAILED_FROZEN') return { verdict: 'FAILED_FROZEN', document: before };
    const now = this.now().toISOString();
    const failure = { message: error?.message || String(error), ...evidence };
    const document = { ...before, phase: 'FAILED_FROZEN', lastCompletedCheckpoint: before.phase,
      generation: before.generation + 1, lastUpdatedAt: now, lastError: failure,
      events: [...before.events, { phase: 'FAILED_FROZEN', at: now, evidence: failure,
        evidenceSha256: sha256(JSON.stringify(failure)) }] };
    await this.store.write(document, { leaseId: this.lease.id });
    return { verdict: 'FAILED_FROZEN', document };
  }

  async currentJournal() {
    await this.assertFrozen();
    return validateJournal(await this.store.read({ leaseId: this.lease.id }));
  }

  async renew() {
    if (!this.lease || this.lostError) return;
    try {
      await this.store.renewLease(this.lease.id);
      await this.assertFrozen();
    } catch (error) {
      this.lostError = error;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
  }

  async assertFrozen() {
    if (this.lostError) throw this.lostError;
    assert(this.lease, 'Environment lease is not owned');
    const document = validateJournal(await this.store.read({ leaseId: this.lease.id }));
    assert.equal(document.state, STATE_FROZEN, 'Environment is not frozen');
    assert.equal(document.controller.idSha256, this.owner, 'Durable freeze owner differs');
    assert.equal(document.controller.leaseIdSha256, sha256(this.lease.id), 'Durable lease identity differs');
    return { verdict: 'FROZEN', generation: document.generation, phase: document.phase };
  }

  async reopen({ acceptanceReceiptSha256 }) {
    await this.assertFrozen();
    assert(isSha256(acceptanceReceiptSha256), 'Explicit acceptance or recovery receipt SHA-256 is required to reopen');
    const before = validateJournal(await this.store.read({ leaseId: this.lease.id }));
    assert.equal(before.phase, 'CLEANUP_IN_PROGRESS', 'Durable cutover cleanup is not complete');
    const now = this.now().toISOString();
    const document = { ...before, state: STATE_OPEN, phase: 'OPEN', lastCompletedCheckpoint: 'CLEANUP_IN_PROGRESS',
      generation: before.generation + 1, lastUpdatedAt: now, reopenedAt: now,
      reopenReceiptSha256: acceptanceReceiptSha256.toLowerCase(),
      controller: { ...before.controller, status: 'COMPLETED' },
      events: [...before.events, { phase: 'OPEN', at: now,
        evidence: { acceptanceReceiptSha256: acceptanceReceiptSha256.toLowerCase() },
        evidenceSha256: sha256(acceptanceReceiptSha256.toLowerCase()) }] };
    await this.store.write(document, { leaseId: this.lease.id });
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.store.releaseLease(this.lease.id);
    this.lease = null;
    return { verdict: 'OPEN', generation: document.generation, document };
  }

  async abandonController({ reason = 'EXPLICITLY_RELINQUISHED' } = {}) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.lease) {
      const before = validateJournal(await this.store.read({ leaseId: this.lease.id }));
      const now = this.now().toISOString();
      const document = { ...before, generation: before.generation + 1, lastUpdatedAt: now,
        controller: { ...before.controller, status: reason },
        events: [...before.events, { phase: before.phase, at: now, action: 'CONTROLLER_RELINQUISHED',
          reason, evidenceSha256: sha256(reason) }] };
      await this.store.write(document, { leaseId: this.lease.id });
      await this.store.releaseLease(this.lease.id);
    }
    this.lease = null;
    return { verdict: 'CONTROLLER_ABANDONED_ENVIRONMENT_REMAINS_FROZEN', reason };
  }
}

function createAzureBlobStore(blobClient) {
  assert(blobClient, 'Azure control BlobClient is required');
  return {
    async read(options = {}) {
      const response = await blobClient.download(0, undefined,
        options.leaseId ? { conditions: { leaseId: options.leaseId } } : {});
      const text = await streamToText(response.readableStreamBody);
      return JSON.parse(text);
    },
    async write(document, { leaseId }) {
      const body = JSON.stringify(document);
      await blobClient.upload(body, Buffer.byteLength(body), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        conditions: { leaseId },
      });
    },
    async acquireLease() {
      const leaseClient = blobClient.getBlobLeaseClient();
      const response = await leaseClient.acquireLease(60);
      return { id: response.leaseId, client: leaseClient };
    },
    async renewLease(leaseId) {
      const leaseClient = blobClient.getBlobLeaseClient(leaseId);
      await leaseClient.renewLease();
    },
    async releaseLease(leaseId) {
      const leaseClient = blobClient.getBlobLeaseClient(leaseId);
      await leaseClient.releaseLease();
    },
  };
}

async function streamToText(stream) {
  if (!stream) return '';
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = {
  DURABLE_PHASES,
  DurableFreezeController,
  NORMAL_TRANSITIONS,
  STATE_FROZEN,
  STATE_OPEN,
  createAzureBlobStore,
  ownerFingerprint,
  validateJournal,
  validateState,
};
