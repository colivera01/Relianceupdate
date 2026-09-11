#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const forbidden = /\bprisma\s+(?:migrate\s+(?:dev|reset|deploy|resolve)|db\s+push)\b/i;
const violations = [];

for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  if (forbidden.test(command)) violations.push(`package.json scripts.${name}`);
}

const roots = ['.github', 'scripts'];
const exempt = new Set([
  'scripts/release/run_guarded_prisma.cjs',
  'scripts/release/test_migration_safety.cjs',
  'scripts/release/verify_no_dangerous_prisma_commands.cjs',
]);
const walk = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else {
      const relative = path.relative(root, target).replace(/\\/g, '/');
      if (!/\.(?:c?js|mjs|ts|json|ya?ml|ps1|sh)$/i.test(entry.name)) continue;
      if (!exempt.has(relative) && forbidden.test(fs.readFileSync(target, 'utf8'))) violations.push(relative);
    }
  }
};
for (const directory of roots) walk(path.join(root, directory));

console.log(JSON.stringify({ verdict: violations.length ? 'FAIL' : 'PASS', violations }, null, 2));
if (violations.length) process.exit(2);
