#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sql = require('mssql');
const { connect } = require('./sqlserver_contract.cjs');

const separator = process.argv.indexOf('--');
const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
const value = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
};

async function acquirePinnedLock({ pool, resource, timeout, driver = sql }) {
  const transaction = new driver.Transaction(pool);
  await transaction.begin(driver.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const request = new driver.Request(transaction);
    request.input('resource', resource);
    request.input('timeout', timeout);
    const result = await request.query(`DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=@timeout; SELECT @result AS result, @@SPID AS sessionId;`);
    const lock = result.recordset[0];
    assert(lock.result >= 0, `Exclusive release lock unavailable (sp_getapplock=${lock.result})`);
    return { transaction, sessionId: lock.sessionId };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function releasePinnedLock({ lock, resource, driver = sql }) {
  if (!lock?.transaction) return { verdict: 'LOCK_ALREADY_ABSENT', reason: 'NO_OWNING_TRANSACTION' };
  try {
    const request = new driver.Request(lock.transaction);
    request.input('resource', resource);
    const result = await request.query(`DECLARE @mode nvarchar(32)=APPLOCK_MODE('public',@resource,'Transaction'); DECLARE @result int=0; IF COALESCE(@mode,'NoLock')<>'NoLock' EXEC @result=sys.sp_releaseapplock @Resource=@resource,@LockOwner='Transaction'; SELECT COALESCE(@mode,'NoLock') AS initialMode,@result AS result,@@SPID AS sessionId;`);
    const observed = result.recordset[0];
    assert(observed.result >= 0, `Exclusive release lock cleanup failed (sp_releaseapplock=${observed.result})`);
    await lock.transaction.commit();
    return observed.initialMode === 'NoLock'
      ? { verdict: 'LOCK_ALREADY_ABSENT', reason: 'OWNING_TRANSACTION_REPORTED_NO_LOCK', sessionId: observed.sessionId }
      : { verdict: 'LOCK_RELEASED', sessionId: observed.sessionId };
  } catch (error) {
    await lock.transaction.rollback().catch(() => {});
    if (/connection.*closed|not connected|connection is closed|transaction.*aborted|requests can only be made/i
      .test(error.message || '')) {
      return { verdict: 'LOCK_ALREADY_ABSENT', reason: 'OWNING_SQL_SESSION_LOST' };
    }
    throw error;
  }
}

async function main() {
  assert(command.length, 'Usage: with_migration_lock.cjs [--timeout-ms N] -- command args...');
  assert(process.env.RELIANCE_EXPECTED_RESOURCE_ID, 'RELIANCE_EXPECTED_RESOURCE_ID is required');
  assert(process.env.RELIANCE_TARGET_SPEC, 'RELIANCE_TARGET_SPEC is required');
  assert(process.env.RELIANCE_RELEASE_RECEIPT, 'RELIANCE_RELEASE_RECEIPT is required');
  const timeout = Number(value('--timeout-ms') || 0);
  assert(Number.isInteger(timeout) && timeout >= 0 && timeout <= 60000, 'Lock timeout must be 0..60000 milliseconds');
  const resource = `RelianceRelease:${crypto.createHash('sha256').update(process.env.RELIANCE_EXPECTED_RESOURCE_ID).digest('hex')}`;
  const pool = await connect(process.env.DATABASE_URL);
  let lock = null;
  try {
    lock = await acquirePinnedLock({ pool, resource, timeout });
    const owner = `${os.hostname()}:${process.pid}:${process.env.RELIANCE_RELEASE_OWNER || 'unspecified'}`;
    const token = crypto.randomUUID();
    console.log(JSON.stringify({ verdict: 'LOCK_ACQUIRED', owner, sessionId: lock.sessionId,
      timeoutMs: timeout, ownerType: 'PINNED_TRANSACTION' }));
    const verification = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/release/verify_database_target.cjs'),
      '--spec', process.env.RELIANCE_TARGET_SPEC,
      '--receipt', process.env.RELIANCE_RELEASE_RECEIPT,
      '--phase', process.env.RELIANCE_TARGET_PHASE || 'preCutover',
      '--resource-id', process.env.RELIANCE_EXPECTED_RESOURCE_ID,
      '--azure-verify'], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
    if (verification.error || verification.status !== 0) process.exitCode = verification.status || 2;
    else {
      const child = spawnSync(command[0], command.slice(1), {
        cwd: process.cwd(),
        env: {
          ...process.env,
          RELIANCE_MIGRATION_LOCK_TOKEN: token,
          RELIANCE_MIGRATION_LOCK_OWNER: owner,
          RELIANCE_TARGET_VERIFICATION_TOKEN: token,
        },
        stdio: 'inherit',
        shell: false,
      });
      if (child.error) throw child.error;
      process.exitCode = child.status ?? 1;
    }
  } finally {
    if (lock) console.log(JSON.stringify(await releasePinnedLock({ lock, resource })));
    await pool.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(`MIGRATION_LOCK_FAILED: ${error.message}`); process.exitCode = 2; });
}

module.exports = { acquirePinnedLock, releasePinnedLock };
