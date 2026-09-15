#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStage, destroyStage, verifyStage } = require('./migration_staging.cjs');

const root = process.cwd();
for (const stageName of ['baseline', 'reconciliation']) {
  const stage = createStage({ root, stageName });
  try {
    const verified = verifyStage({ root, stageRoot: stage.stageRoot, stageName });
    assert.equal(verified.verdict, 'PASS');
    assert.equal(verified.files.length, stageName === 'baseline' ? 1 : 2);
    if (stageName === 'baseline') {
      const unexpected = path.join(stage.stageRoot, 'prisma', 'migrations', '20260914030000_enforce_one_active_device_assignment_v2');
      assert.equal(fs.existsSync(unexpected), false);
    }
  } finally {
    destroyStage(stage.stageRoot);
    assert.equal(fs.existsSync(stage.stageRoot), false);
  }
}
const corrupted = createStage({ root, stageName: 'baseline' });
try {
  fs.appendFileSync(path.join(corrupted.stageRoot, 'prisma', 'migrations', '00000000000000_reliance_forward_baseline_20260914_v2', 'migration.sql'), '\n-- mutation');
  assert.throws(() => verifyStage({ root, stageRoot: corrupted.stageRoot, stageName: 'baseline' }));
} finally { destroyStage(corrupted.stageRoot); }
console.log(JSON.stringify({ verdict: 'PASS', stages: ['baseline', 'reconciliation'], independentCorruptionBlocked: true, temporaryStagesDestroyed: true }));
