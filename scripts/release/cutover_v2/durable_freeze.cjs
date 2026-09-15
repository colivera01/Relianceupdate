#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const STATE_OPEN = 'OPEN';
const STATE_FROZEN = 'FROZEN';

function ownerFingerprint(owner) {
  assert(owner, 'Cutover owner is required');
  return crypto.createHash('sha256').update(owner).digest('hex');
}

function validateState(document) {
  assert(document && typeof document === 'object', 'Durable cutover state is unavailable');
  assert([STATE_OPEN, STATE_FROZEN].includes(document.state), 'Durable cutover state is invalid');
  assert(Number.isSafeInteger(document.generation) && document.generation >= 0,
    'Durable cutover generation is invalid');
  return document;
}

class DurableFreezeController {
  constructor({ store, owner, now = () => new Date(), heartbeatMs = 20000 }) {
    assert(store, 'Durable store is required');
    assert(Number.isInteger(heartbeatMs) && heartbeatMs >= 1000, 'Lease heartbeat must be at least one second');
    this.store = store;
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

  async freeze({ operationId, targetResourceId }) {
    assert(operationId, 'Operation ID is required');
    assert(targetResourceId, 'Target resource ID is required');
    this.lease = await this.store.acquireLease();
    try {
      const before = validateState(await this.store.read({ leaseId: this.lease.id }));
      assert.equal(before.state, STATE_OPEN, 'Environment is already frozen');
      const document = {
        version: 1,
        state: STATE_FROZEN,
        generation: before.generation + 1,
        operationId,
        ownerSha256: this.owner,
        targetResourceId,
        frozenAt: this.now().toISOString(),
        reopenedAt: null,
      };
      await this.store.write(document, { leaseId: this.lease.id });
      await this.assertFrozen();
      this.timer = setInterval(() => void this.renew(), this.heartbeatMs);
      this.timer.unref?.();
      return { verdict: 'FROZEN', generation: document.generation, ownerSha256: this.owner };
    } catch (error) {
      await this.store.releaseLease(this.lease.id).catch(() => {});
      this.lease = null;
      throw error;
    }
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
    const document = validateState(await this.store.read({ leaseId: this.lease.id }));
    assert.equal(document.state, STATE_FROZEN, 'Environment is not frozen');
    assert.equal(document.ownerSha256, this.owner, 'Durable freeze owner differs');
    return { verdict: 'FROZEN', generation: document.generation };
  }

  async reopen({ acceptanceReceiptSha256 }) {
    await this.assertFrozen();
    assert.match(acceptanceReceiptSha256 || '', /^[a-f0-9]{64}$/i,
      'Explicit acceptance or recovery receipt SHA-256 is required to reopen');
    const before = validateState(await this.store.read({ leaseId: this.lease.id }));
    const document = {
      ...before,
      state: STATE_OPEN,
      generation: before.generation + 1,
      reopenedAt: this.now().toISOString(),
      reopenReceiptSha256: acceptanceReceiptSha256.toLowerCase(),
    };
    await this.store.write(document, { leaseId: this.lease.id });
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.store.releaseLease(this.lease.id);
    this.lease = null;
    return { verdict: 'OPEN', generation: document.generation };
  }

  async abandonController() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.lease) await this.store.releaseLease(this.lease.id).catch(() => {});
    this.lease = null;
    return { verdict: 'CONTROLLER_ABANDONED_ENVIRONMENT_REMAINS_FROZEN' };
  }
}

function createAzureBlobStore(blobClient) {
  assert(blobClient, 'Azure control BlobClient is required');
  return {
    async read(options = {}) {
      const response = await blobClient.download(0, undefined, options.leaseId ? { conditions: { leaseId: options.leaseId } } : {});
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
  DurableFreezeController,
  STATE_FROZEN,
  STATE_OPEN,
  createAzureBlobStore,
  ownerFingerprint,
  validateState,
};
