#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const guard = path.join(root, 'scripts', 'release', 'run_guarded_prisma.cjs');
const cases = [
  { name: 'disposable migrate dev', environment: 'disposable', url: 'sqlserver://localhost:1433;database=reliance-checkpoint-test;user=test;password=test;trustServerCertificate=true', args: ['migrate', 'dev'], expected: 0, disposable: 'YES' },
  { name: 'beta migrate dev', environment: 'beta', url: 'sqlserver://sql-reliance-beta-wcus.database.windows.net:1433;database=reliance-beta-db;user=test;password=test;encrypt=true', args: ['migrate', 'dev'], expected: 2 },
  { name: 'beta migrate reset', environment: 'beta', url: 'sqlserver://sql-reliance-beta-wcus.database.windows.net:1433;database=reliance-beta-db;user=test;password=test;encrypt=true', args: ['migrate', 'reset'], expected: 2 },
  { name: 'beta db push', environment: 'beta', url: 'sqlserver://sql-reliance-beta-wcus.database.windows.net:1433;database=reliance-beta-db;user=test;password=test;encrypt=true', args: ['db', 'push'], expected: 2 },
  { name: 'production migrate dev', environment: 'production', url: 'sqlserver://relianceorgsqlserver.database.windows.net:1433;database=reliance-production;user=test;password=test;encrypt=true', args: ['migrate', 'dev'], expected: 2 },
  { name: 'production migrate reset', environment: 'production', url: 'sqlserver://relianceorgsqlserver.database.windows.net:1433;database=reliance-production;user=test;password=test;encrypt=true', args: ['migrate', 'reset'], expected: 2 },
  { name: 'production db push', environment: 'production', url: 'sqlserver://relianceorgsqlserver.database.windows.net:1433;database=reliance-production;user=test;password=test;encrypt=true', args: ['db', 'push'], expected: 2 },
  { name: 'beta disguised as disposable', environment: 'disposable', url: 'sqlserver://sql-reliance-beta-wcus.database.windows.net:1433;database=reliance-beta-db;user=test;password=test;encrypt=true', args: ['migrate', 'dev'], expected: 2, disposable: 'YES' },
];

const results = cases.map((item) => {
  const run = spawnSync(process.execPath, [guard, ...item.args, '--check-only'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      RELIANCE_DB_ENVIRONMENT: item.environment,
      RELIANCE_DISPOSABLE: item.disposable || '',
      DATABASE_URL: item.url,
    },
  });
  assert.equal(run.status, item.expected, `${item.name}: ${run.stdout} ${run.stderr}`);
  return { name: item.name, verdict: item.expected === 0 ? 'ALLOWED' : 'BLOCKED' };
});

console.log(JSON.stringify({ verdict: 'PASS', results }, null, 2));
