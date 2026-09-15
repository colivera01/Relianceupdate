#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { verifyStage } = require('./migration_staging.cjs');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };

try {
  const root = path.resolve(value('--root') || process.cwd());
  const stageRoot = path.resolve(value('--stage-root') || '');
  const stageName = value('--stage');
  if (!value('--stage-root')) throw new Error('--stage-root is required');
  console.log(JSON.stringify(verifyStage({ root, stageRoot, stageName }), null, 2));
} catch (error) {
  console.error(`MIGRATION_STAGE_VERIFY_FAILED: ${error.message}`);
  process.exitCode = 2;
}

