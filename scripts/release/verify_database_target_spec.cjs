#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { targetSpecEvidence } = require('./release_receipt_lib.cjs');

try {
  const target = path.join(process.cwd(), 'config', 'release-targets', 'reliance-beta.json');
  const { spec, sha256 } = targetSpecEvidence(target);
  console.log(JSON.stringify({
    verdict: 'PASS',
    environment: spec.environment,
    server: spec.server,
    database: spec.database,
    resourceId: spec.resourceId,
    targetSpecSha256: sha256,
    phases: Object.keys(spec.expectedStates || {}),
  }, null, 2));
} catch (error) {
  console.error(`TARGET_SPEC_FAILED: ${error.message}`);
  process.exitCode = 2;
}
