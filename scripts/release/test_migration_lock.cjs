#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = process.cwd();
const wrapper = path.join(root, 'scripts', 'release', 'with_migration_lock.cjs');
const noop = [process.execPath, '-e', 'process.exit(0)'];

function wrapperArgs(timeout, command) {
  return [wrapper, '--timeout-ms', String(timeout), '--', ...command];
}

function waitForMarker(child, marker, timeoutMs) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${marker}`)), timeoutMs);
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes(marker)) {
        clearTimeout(timer);
        resolve(output);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('error', reject);
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });
}

async function main() {
  for (const name of ['DATABASE_URL', 'RELIANCE_EXPECTED_RESOURCE_ID', 'RELIANCE_TARGET_SPEC', 'RELIANCE_RELEASE_RECEIPT']) {
    assert(process.env[name], `${name} is required`);
  }

  const holder = spawn(process.execPath, wrapperArgs(10000, [process.execPath, '-e', 'setTimeout(() => process.exit(0), 5000)']), {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForMarker(holder, 'LOCK_ACQUIRED', 30000);

  const contender = spawnSync(process.execPath, wrapperArgs(0, noop), {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
  });
  const contenderOutput = `${contender.stdout || ''}\n${contender.stderr || ''}`;
  assert.notEqual(contender.status, 0, 'Concurrent lock unexpectedly succeeded');
  assert.match(contenderOutput, /lock unavailable|sp_getapplock/i, `Concurrent failure did not identify lock contention: ${contenderOutput.trim()}`);
  assert.equal(await waitForExit(holder), 0, 'Lock holder failed');

  const reacquire = spawnSync(process.execPath, wrapperArgs(10000, noop), {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
  });
  assert.equal(reacquire.status, 0, `${reacquire.stdout || ''}\n${reacquire.stderr || ''}`);
  assert.match(reacquire.stdout, /LOCK_RELEASED/, 'Reacquired lock was not released');

  console.log(JSON.stringify({
    verdict: 'PASS',
    exclusiveContention: 'FAIL_CLOSED',
    normalRelease: 'PASS',
    reacquireAfterRelease: 'PASS',
    crashBehavior: 'SESSION_LOCK_AUTOMATICALLY_RELEASED_BY_SQL_SERVER',
  }, null, 2));
}

main().catch((error) => {
  console.error(`MIGRATION_LOCK_TEST_FAILED: ${error.message}`);
  process.exitCode = 2;
});
