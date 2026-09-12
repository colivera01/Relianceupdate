#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { createStage } = require('./migration_staging.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };

try {
  const root = path.resolve(value('--root') || process.cwd());
  const stageName = value('--stage');
  const parentDirectory = value('--parent') ? path.resolve(value('--parent')) : undefined;
  const result = createStage({ root, stageName, parentDirectory });
  console.log(JSON.stringify({ verdict: 'PASS', ...result }, null, 2));
} catch (error) {
  console.error(`MIGRATION_STAGE_FAILED: ${error.message}`);
  process.exitCode = 2;
}
