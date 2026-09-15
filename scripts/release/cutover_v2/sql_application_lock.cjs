#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sql = require('mssql');

function parseSqlServerUrl(value) {
  assert(value?.startsWith('sqlserver://'), 'SQL Server URL is required');
  const fields = value.slice('sqlserver://'.length).split(';');
  const [hostPort, ...options] = fields;
  const [server, portValue] = hostPort.split(':');
  const values = Object.fromEntries(options.map((item) => {
    const index = item.indexOf('=');
    return [item.slice(0, index).toLowerCase(), item.slice(index + 1)];
  }));
  assert(server && values.database && values.user && values.password, 'SQL Server URL is incomplete');
  return {
    server,
    port: Number(portValue || 1433),
    database: values.database,
    user: values.user,
    password: values.password,
    options: {
      encrypt: values.encrypt !== 'false',
      trustServerCertificate: values.trustservercertificate === 'true',
    },
    pool: { max: 1, min: 1, idleTimeoutMillis: 0 },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };
}

class SqlApplicationLock {
  constructor({ databaseUrl, resourceId, heartbeatMs = 1000, timeoutMs = 0, sqlModule = sql }) {
    assert(resourceId, 'SQL lock resource ID is required');
    this.sql = sqlModule;
    this.config = parseSqlServerUrl(databaseUrl);
    this.resource = `RelianceCutoverV2:${crypto.createHash('sha256').update(resourceId).digest('hex')}`;
    this.heartbeatMs = heartbeatMs;
    this.timeoutMs = timeoutMs;
    this.pool = null;
    this.transaction = null;
    this.sessionId = null;
    this.timer = null;
    this.lostError = null;
    this.tail = Promise.resolve();
  }

  serialize(operation) {
    const next = this.tail.then(operation, operation);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }

  request(query, inputs = {}) {
    return this.serialize(async () => {
      if (this.lostError) throw this.lostError;
      assert(this.transaction, 'SQL lock connection is not open');
      const request = new this.sql.Request(this.transaction);
      for (const [name, value] of Object.entries(inputs)) request.input(name, value);
      return request.query(query);
    });
  }

  async acquire() {
    assert(!this.pool, 'SQL lock object cannot be reused');
    this.pool = await new this.sql.ConnectionPool(this.config).connect();
    this.pool.on?.('error', (error) => { this.lostError = error; });
    this.transaction = new this.sql.Transaction(this.pool);
    await this.transaction.begin(this.sql.ISOLATION_LEVEL.READ_COMMITTED);
    const response = await this.request(
      `DECLARE @result int;
       EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=@timeout;
       SELECT @result result,@@SPID sessionId;`,
      { resource: this.resource, timeout: this.timeoutMs },
    );
    const row = response.recordset[0];
    assert(row.result >= 0, `SQL application lock unavailable (${row.result})`);
    this.sessionId = Number(row.sessionId);
    await this.assertOwned();
    this.timer = setInterval(() => void this.heartbeat(), this.heartbeatMs);
    this.timer.unref?.();
    return { verdict: 'LOCK_ACQUIRED', resource: this.resource, sessionId: this.sessionId };
  }

  async heartbeat() {
    if (!this.transaction || this.lostError) return;
    try {
      await this.assertOwned();
    } catch (error) {
      this.lostError = error;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
  }

  async assertOwned() {
    if (this.lostError) throw this.lostError;
    const response = await this.request(
      `SELECT APPLOCK_MODE('public',@resource,'Session') lockMode,@@SPID sessionId;`,
      { resource: this.resource },
    );
    const row = response.recordset[0];
    assert.equal(row.lockMode, 'Exclusive', 'SQL application lock was lost');
    assert.equal(Number(row.sessionId), this.sessionId, 'SQL lock session changed');
    return { verdict: 'LOCK_HELD', resource: this.resource, sessionId: this.sessionId };
  }

  async release() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    let loss = this.lostError;
    try {
      await this.tail;
      if (this.transaction && !loss) {
        await this.request(`EXEC sys.sp_releaseapplock @Resource=@resource,@LockOwner='Session';`, {
          resource: this.resource,
        });
      }
    } catch (error) {
      loss ||= error;
    } finally {
      if (this.transaction) await this.transaction.rollback().catch(() => {});
      if (this.pool) await this.pool.close().catch(() => {});
      this.transaction = null;
      this.pool = null;
    }
    return loss
      ? { verdict: 'LOCK_CONNECTION_CLOSED_AFTER_LOSS', error: loss.message }
      : { verdict: 'LOCK_RELEASED' };
  }
}

async function assertSecondActorBlocked({ databaseUrl, resourceId, sqlModule = sql }) {
  const contender = new SqlApplicationLock({ databaseUrl, resourceId, timeoutMs: 0, sqlModule });
  try {
    await contender.acquire();
    throw new Error('Second actor unexpectedly acquired the SQL lock');
  } catch (error) {
    assert.match(error.message, /unavailable/, 'Second actor failed for an unexpected reason');
    return { verdict: 'BLOCKED' };
  } finally {
    await contender.release().catch(() => {});
  }
}

module.exports = { SqlApplicationLock, assertSecondActorBlocked, parseSqlServerUrl };
