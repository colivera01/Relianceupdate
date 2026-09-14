#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sql = require('mssql');
const { parsePrismaSqlServerUrl } = require('./migration_safety.cjs');

class SerializedRequestGate {
  constructor() { this.tail = Promise.resolve(); }

  run(operation) {
    const current = this.tail.then(operation, operation);
    this.tail = current.then(() => undefined, () => undefined);
    return current;
  }

  idle() { return this.tail; }
}

class ContinuousCutoverLock {
  constructor({ databaseUrl, resourceId, timeoutMs = 0, heartbeatMs = 5000, onHeartbeat = () => {} }) {
    assert(databaseUrl, 'databaseUrl is required');
    assert(resourceId, 'resourceId is required');
    assert(Number.isInteger(timeoutMs) && timeoutMs >= 0 && timeoutMs <= 60000, 'timeoutMs must be 0..60000');
    assert(Number.isInteger(heartbeatMs) && heartbeatMs >= 250, 'heartbeatMs must be at least 250');
    this.config = { ...parsePrismaSqlServerUrl(databaseUrl), pool: { max: 2, min: 0, idleTimeoutMillis: 30000 } };
    this.resource = `RelianceRelease:${crypto.createHash('sha256').update(resourceId).digest('hex')}`;
    this.timeoutMs = timeoutMs;
    this.heartbeatMs = heartbeatMs;
    this.onHeartbeat = onHeartbeat;
    this.pool = null;
    this.transaction = null;
    this.timer = null;
    this.heartbeatRunning = false;
    this.releasing = false;
    this.lostError = null;
    this.acquired = false;
    this.sessionId = null;
    this.requestGate = new SerializedRequestGate();
  }

  async request(query, inputs = {}) {
    return this.requestGate.run(async () => {
      assert(this.transaction, 'Control connection is not open');
      const request = new sql.Request(this.transaction);
      for (const [name, value] of Object.entries(inputs)) request.input(name, value);
      return request.query(query);
    });
  }

  async acquire() {
    assert(!this.pool, 'Lock object cannot be reused');
    this.pool = await new sql.ConnectionPool(this.config).connect();
    this.transaction = new sql.Transaction(this.pool);
    await this.transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    const result = await this.request(
      `DECLARE @result int;
       EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=@timeout;
       SELECT @result AS result,@@SPID AS sessionId;`,
      { resource: this.resource, timeout: this.timeoutMs },
    );
    const row = result.recordset[0];
    assert(row.result >= 0, `Exclusive cutover lock unavailable (sp_getapplock=${row.result})`);
    this.acquired = true;
    this.sessionId = Number(row.sessionId);
    await this.assertOwned();
    this.timer = setInterval(() => void this.heartbeat(), this.heartbeatMs);
    this.timer.unref?.();
    return { verdict: 'LOCK_ACQUIRED', sessionId: this.sessionId, resource: this.resource };
  }

  async heartbeat() {
    if (!this.acquired || this.releasing || this.heartbeatRunning || this.lostError) return;
    this.heartbeatRunning = true;
    try {
      const status = await this.assertOwned();
      this.onHeartbeat(status);
    } catch (error) {
      this.lostError = error;
    } finally {
      this.heartbeatRunning = false;
    }
  }

  async assertOwned() {
    if (this.lostError) throw this.lostError;
    assert(this.acquired, 'Cutover lock is not owned');
    const result = await this.request(
      `SELECT APPLOCK_MODE('public',@resource,'Session') AS lockMode,@@SPID AS sessionId;`,
      { resource: this.resource },
    );
    const row = result.recordset[0];
    assert.equal(row.lockMode, 'Exclusive', 'Parent cutover lock was lost');
    assert.equal(Number(row.sessionId), this.sessionId, 'Control connection session changed');
    return { verdict: 'LOCK_HELD', sessionId: this.sessionId, lockMode: row.lockMode };
  }

  async release() {
    this.releasing = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    let lockLoss = null;
    try {
      if (this.acquired && this.transaction) {
        await this.requestGate.idle();
        await this.assertOwned();
        await this.request(`EXEC sys.sp_releaseapplock @Resource=@resource,@LockOwner='Session';`, { resource: this.resource });
      }
    } catch (error) {
      lockLoss = error;
    } finally {
      this.acquired = false;
      if (this.transaction) await this.transaction.rollback().catch(() => {});
      if (this.pool) await this.pool.close().catch(() => {});
      this.transaction = null;
      this.pool = null;
    }
    return lockLoss
      ? { verdict: 'LOCK_CONNECTION_CLOSED_AFTER_LOSS', lockWasLost: true, error: lockLoss.message }
      : { verdict: 'LOCK_RELEASED' };
  }
}

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

function environmentResourceId(databaseResourceId) {
  const serverResourceId = String(databaseResourceId).replace(/\/databases\/[^/]+\/?$/i, '');
  assert.notEqual(serverResourceId, databaseResourceId, 'Database Azure resource ID is required');
  return `${serverResourceId}/reliance-forward-baseline-environment`;
}

async function assertSecondActorBlocked({ databaseUrl, resourceId }) {
  const resource = `RelianceRelease:${crypto.createHash('sha256').update(resourceId).digest('hex')}`;
  const pool = await new sql.ConnectionPool({
    ...parsePrismaSqlServerUrl(databaseUrl),
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
  }).connect();
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
      throw new Error('Second actor acquired an exclusive cutover lock');
    }
    return { verdict: 'BLOCKED', result: code };
  } finally { await pool.close(); }
}

class CutoverLockSet {
  constructor({ databaseUrl, resourceId, heartbeatMs = 5000 }) {
    this.databaseUrl = databaseUrl;
    this.resourceId = resourceId;
    this.heartbeatMs = heartbeatMs;
    this.environmentDatabaseUrl = replaceDatabase(databaseUrl, 'master');
    this.environmentResourceId = environmentResourceId(resourceId);
    this.environmentLock = new ContinuousCutoverLock({ databaseUrl: this.environmentDatabaseUrl,
      resourceId: this.environmentResourceId, heartbeatMs });
    this.databaseLock = new ContinuousCutoverLock({ databaseUrl, resourceId, heartbeatMs });
    this.databaseLockReleasedForAcceptance = false;
  }

  async acquire() {
    const environment = await this.environmentLock.acquire();
    try {
      const environmentSecondActor = await assertSecondActorBlocked({
        databaseUrl: this.environmentDatabaseUrl,
        resourceId: this.environmentResourceId,
      });
      const database = await this.databaseLock.acquire();
      return { verdict: 'LOCK_SET_ACQUIRED', environment, environmentSecondActor, database };
    } catch (error) {
      await this.environmentLock.release();
      throw error;
    }
  }

  async assertOwned() {
    const environment = await this.environmentLock.assertOwned();
    const database = this.databaseLockReleasedForAcceptance
      ? { verdict: 'DATABASE_LOCK_RELEASED_FOR_ACCEPTANCE' }
      : await this.databaseLock.assertOwned();
    return { verdict: 'LOCK_SET_HELD', environment, database };
  }

  async assertEnvironmentOwned() {
    const environment = await this.environmentLock.assertOwned();
    return { verdict: 'ENVIRONMENT_LOCK_HELD', environment };
  }

  async releaseDatabaseForAcceptance() {
    assert.equal(this.databaseLockReleasedForAcceptance, false, 'Database lock was already released');
    const database = await this.databaseLock.release();
    assert.equal(database.verdict, 'LOCK_RELEASED', 'Database lock could not be released cleanly');
    this.databaseLockReleasedForAcceptance = true;
    return { verdict: 'DATABASE_LOCK_RELEASED_FOR_BOUNDED_ACCEPTANCE', database };
  }

  async reacquireDatabaseForRollback() {
    if (!this.databaseLockReleasedForAcceptance) return { verdict: 'DATABASE_LOCK_ALREADY_HELD' };
    this.databaseLock = new ContinuousCutoverLock({
      databaseUrl: this.databaseUrl,
      resourceId: this.resourceId,
      heartbeatMs: this.heartbeatMs,
    });
    const database = await this.databaseLock.acquire();
    this.databaseLockReleasedForAcceptance = false;
    return { verdict: 'DATABASE_LOCK_REACQUIRED_FOR_ROLLBACK', database };
  }

  async release() {
    const database = this.databaseLockReleasedForAcceptance
      ? { verdict: 'LOCK_ALREADY_RELEASED_FOR_ACCEPTANCE' }
      : await this.databaseLock.release();
    const environment = await this.environmentLock.release();
    return { verdict: 'LOCK_RELEASED', database, environment };
  }
}

module.exports = { assertSecondActorBlocked, ContinuousCutoverLock, CutoverLockSet,
  environmentResourceId, replaceDatabase, SerializedRequestGate };
