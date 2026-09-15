#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROHIBITED = Object.freeze([
  { label: 'Azure Web App deploy command', expression: /\bwebapp[\s'",]+deploy\b/i },
  { label: 'legacy ZIP deployment endpoint', expression: /\bzipdeploy\b/i },
  { label: 'legacy OneDeploy endpoint', expression: /\bonedeploy\b/i },
]);

function scanFiles(files) {
  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of PROHIBITED) {
      if (rule.expression.test(content)) findings.push({ file, rule: rule.label });
    }
  }
  return findings;
}

function v2ExecutionFiles(root) {
  const directory = path.join(root, 'scripts', 'release', 'cutover_v2');
  const excluded = new Set(['prohibited_path_guard.cjs']);
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.cjs') && !entry.name.startsWith('test_') && !excluded.has(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

function verifyV2ExecutionPaths(root) {
  const files = v2ExecutionFiles(root);
  assert(files.length > 0, 'No Cutover V2 execution files were found');
  const findings = scanFiles(files);
  assert.deepEqual(findings, [], `Prohibited beta deployment path found: ${JSON.stringify(findings)}`);
  return { verdict: 'PASS', files: files.map((file) => path.relative(root, file)), findings };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || process.cwd());
  process.stdout.write(`${JSON.stringify(verifyV2ExecutionPaths(root), null, 2)}\n`);
}

module.exports = { PROHIBITED, scanFiles, v2ExecutionFiles, verifyV2ExecutionPaths };
