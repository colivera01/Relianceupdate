#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { evaluatePolicy } = require('./migration_safety.cjs');

const rawArgs = process.argv.slice(2);
const checkOnly = rawArgs.includes('--check-only');
const prismaArgs = rawArgs.filter((value) => value !== '--check-only');
const root = process.cwd();
const policy = evaluatePolicy({
  root,
  environment: process.env.RELIANCE_DB_ENVIRONMENT,
  databaseUrl: process.env.DATABASE_URL,
  args: prismaArgs,
  disposableAcknowledged: process.env.RELIANCE_DISPOSABLE,
  writeApproved: process.env.RELIANCE_MIGRATION_WRITE_APPROVED,
  lockToken: process.env.RELIANCE_MIGRATION_LOCK_TOKEN,
  targetSpec: process.env.RELIANCE_TARGET_SPEC,
  releaseReceipt: process.env.RELIANCE_RELEASE_RECEIPT,
});

if (!policy.allowed) {
  console.error(JSON.stringify({ verdict: 'BLOCKED', command: prismaArgs.slice(0, 2).join(' '), reason: policy.reason }));
  process.exit(2);
}

if (policy.protected && policy.command !== 'migrate status' && !checkOnly) {
  const verifiedByLock = process.env.RELIANCE_TARGET_VERIFICATION_TOKEN
    && process.env.RELIANCE_TARGET_VERIFICATION_TOKEN === process.env.RELIANCE_MIGRATION_LOCK_TOKEN;
  if (!verifiedByLock) {
    const verifier = path.join(root, 'scripts', 'release', 'verify_database_target.cjs');
    const args = [verifier,
      '--spec', process.env.RELIANCE_TARGET_SPEC,
      '--receipt', process.env.RELIANCE_RELEASE_RECEIPT,
      '--phase', process.env.RELIANCE_TARGET_PHASE || 'preCutover',
      '--resource-id', process.env.RELIANCE_EXPECTED_RESOURCE_ID || '',
      '--azure-verify'];
    const verification = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
    if (verification.error || verification.status !== 0) process.exit(verification.status || 2);
  }
}

console.log(JSON.stringify({ verdict: checkOnly ? 'ALLOWED_CHECK_ONLY' : 'ALLOWED', ...policy }));
if (checkOnly) process.exit(0);

const prismaEntrypoint = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
if (!fs.existsSync(prismaEntrypoint)) throw new Error('Local locked Prisma CLI is unavailable; run npm ci first');
const result = spawnSync(process.execPath, [prismaEntrypoint, ...prismaArgs], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
