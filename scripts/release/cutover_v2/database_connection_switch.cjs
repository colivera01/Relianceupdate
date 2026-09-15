#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function switchDatabaseConnection({ root, resourceGroup, appService, database, databaseUrl, apply = true }) {
  assert(/restore|recovery/i.test(database || ''), 'Recovery database name is required');
  assert(databaseUrl, 'Recovery database URL is required');
  const variable = 'RELIANCE_RECOVERY_DATABASE_URL';
  const args = [
    path.join(root, 'scripts', 'release', 'update_azure_database_setting.py'),
    '--resource-group', resourceGroup,
    '--app', appService,
    '--database-url-env', variable,
    '--expected-database', database,
  ];
  if (apply) args.push('--apply');
  const result = spawnSync(process.env.PYTHON || 'python', args, {
    cwd: root,
    env: { ...process.env, [variable]: databaseUrl },
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, `Structured database setting switch failed: ${(result.stderr || '').trim()}`);
  const output = JSON.parse(result.stdout);
  assert.equal(output.secretPrinted, false);
  assert.equal(output.database.toLowerCase(), database.toLowerCase());
  return output;
}

module.exports = { switchDatabaseConnection };
