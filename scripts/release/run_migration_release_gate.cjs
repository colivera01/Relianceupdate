#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const validationEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL
    || 'sqlserver://127.0.0.1:1433;database=reliance_disposable_validation;user=validation;password=not-used;encrypt=true;trustServerCertificate=true',
};
const commands = [
  ['node', ['scripts/release/verify_migration_manifest.cjs']],
  ['node', ['scripts/release/verify_migration_package_boundaries.cjs', '.']],
  ['node', ['scripts/release/verify_no_dangerous_prisma_commands.cjs']],
  ['node', ['scripts/release/verify_database_target_spec.cjs']],
  ['node', ['scripts/release/test_migration_safety.cjs']],
  ['node', ['scripts/release/test_migration_immutability.cjs']],
  ['node', ['node_modules/prisma/build/index.js', 'validate', '--schema=prisma/schema.prisma']],
  ['node', ['node_modules/prisma/build/index.js', 'generate', '--schema=prisma/schema.prisma']],
];
const results = [];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: root, env: validationEnv, encoding: 'utf8' });
  results.push({ command: [command, ...args].join(' '), exitCode: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() });
  if (result.error || result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    console.error(JSON.stringify({ verdict: 'FAIL', results }, null, 2));
    process.exit(result.status || 2);
  }
}
const summary = { verdict: 'PASS', checks: results.length, results };
const outputArg = process.argv.indexOf('--output');
if (outputArg >= 0) fs.writeFileSync(path.resolve(root, process.argv[outputArg + 1]), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
