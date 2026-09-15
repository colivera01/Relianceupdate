#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { connect } = require('./sqlserver_contract.cjs');

const separator = process.argv.indexOf('--');
const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
const value = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
};

async function main() {
  assert(command.length, 'Usage: with_migration_lock.cjs [--timeout-ms N] -- command args...');
  assert(process.env.RELIANCE_EXPECTED_RESOURCE_ID, 'RELIANCE_EXPECTED_RESOURCE_ID is required');
  assert(process.env.RELIANCE_TARGET_SPEC, 'RELIANCE_TARGET_SPEC is required');
  assert(process.env.RELIANCE_RELEASE_RECEIPT, 'RELIANCE_RELEASE_RECEIPT is required');
  const timeout = Number(value('--timeout-ms') || 0);
  assert(Number.isInteger(timeout) && timeout >= 0 && timeout <= 60000, 'Lock timeout must be 0..60000 milliseconds');
  const resource = `RelianceRelease:${crypto.createHash('sha256').update(process.env.RELIANCE_EXPECTED_RESOURCE_ID).digest('hex')}`;
  const pool = await connect(process.env.DATABASE_URL);
  let acquired = false;
  try {
    const request = pool.request();
    request.input('resource', resource);
    request.input('timeout', timeout);
    const result = await request.query(`DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=@timeout; SELECT @result AS result, @@SPID AS sessionId;`);
    const lock = result.recordset[0];
    assert(lock.result >= 0, `Exclusive release lock unavailable (sp_getapplock=${lock.result})`);
    acquired = true;
    const owner = `${os.hostname()}:${process.pid}:${process.env.RELIANCE_RELEASE_OWNER || 'unspecified'}`;
    const token = crypto.randomUUID();
    console.log(JSON.stringify({ verdict: 'LOCK_ACQUIRED', owner, sessionId: lock.sessionId, timeoutMs: timeout }));
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
    if (acquired) {
      const release = pool.request();
      release.input('resource', resource);
      await release.query(`EXEC sys.sp_releaseapplock @Resource=@resource,@LockOwner='Session';`);
      console.log(JSON.stringify({ verdict: 'LOCK_RELEASED' }));
    }
    await pool.close();
  }
}

main().catch((error) => { console.error(`MIGRATION_LOCK_FAILED: ${error.message}`); process.exitCode = 2; });

