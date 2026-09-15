const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || process.cwd());
const migrationRoot = path.join(root, 'prisma', 'migrations');
const archiveRoot = path.join(root, 'docs', 'database', 'migration-history-legacy');
const active = fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `prisma/migrations/${entry.name}/migration.sql`)
  .sort();
const archived = [];
const walk = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else archived.push(path.relative(root, target).replace(/\\/g, '/'));
  }
};
walk(archiveRoot);
const violations = [
  ...active.filter((entry) => entry.startsWith('docs/')),
  ...archived.filter((entry) => entry.startsWith('prisma/migrations/')),
];
const result = {
  verdict: violations.length ? 'FAIL' : 'PASS',
  activeMigrationCount: active.length,
  active,
  archivedFileCount: archived.length,
  archivedSqlExecutable: false,
  violations,
};
console.log(JSON.stringify(result, null, 2));
if (violations.length) process.exitCode = 2;

