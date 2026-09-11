#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const root = path.resolve(value('--root') || process.cwd());
const manifestPath = path.resolve(root, value('--manifest') || 'prisma/active-migration-manifest.json');
const receiptArg = value('--receipt');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const fail = (message) => {
  console.error(`MIGRATION_MANIFEST_FAILED: ${message}`);
  process.exit(2);
};
const slash = (file) => file.replace(/\\/g, '/');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const migrationRoot = path.join(root, 'prisma', 'migrations');
const entries = fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => {
    const file = path.join(migrationRoot, name, 'migration.sql');
    if (!fs.existsSync(file)) fail(`missing migration.sql for ${name}`);
    const bytes = fs.readFileSync(file);
    return { name, sha256: sha256(bytes), bytes: bytes.length };
  });
const aggregateSha256 = sha256(Buffer.from(entries.map((entry) => `${entry.name}\0${entry.sha256}\0${entry.bytes}\n`).join('')));

if (JSON.stringify(entries) !== JSON.stringify(manifest.entries)) fail('active migration order, file set, raw hash, or byte count differs');
if (aggregateSha256 !== manifest.aggregateSha256) fail('active aggregate hash differs');

const archiveRoot = path.resolve(root, 'docs', 'database', 'migration-history-legacy');
const archiveManifestPath = path.resolve(root, manifest.legacyArchiveManifest);
if (!archiveManifestPath.startsWith(`${archiveRoot}${path.sep}`)) fail('legacy archive manifest is outside the non-executable archive root');
const archiveBytes = fs.readFileSync(archiveManifestPath);
const archiveHash = sha256(archiveBytes);
if (archiveHash !== manifest.legacyArchiveManifestSha256) fail('legacy archive manifest hash differs');
const archiveManifest = JSON.parse(archiveBytes.toString('utf8'));
const archiveFiles = archiveManifest.entries.flatMap((entry) => entry.archivedFiles || []);
if (archiveManifest.migrationDirectoryCount !== 57 || archiveManifest.archivedSqlFileCount !== 61 || archiveFiles.length !== 61) {
  fail('legacy archive count differs from approved 57 directories / 61 SQL files');
}
const expectedArchivePaths = archiveFiles.map((entry) => entry.destinationPath).sort();
const actualArchivePaths = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.sql$/i.test(entry.name)) actualArchivePaths.push(slash(path.relative(root, target)));
  }
};
walk(archiveRoot);
actualArchivePaths.sort();
if (JSON.stringify(actualArchivePaths) !== JSON.stringify(expectedArchivePaths)) fail('archived SQL file set differs from archive manifest');
for (const archived of archiveFiles) {
  const actual = fs.readFileSync(path.join(root, archived.destinationPath));
  if (sha256(actual) !== archived.archivedRawSha256) fail(`archived SQL bytes differ: ${archived.destinationPath}`);
  if (archived.sourceGitBlobSha !== archived.archivedGitBlobSha || archived.match !== true) fail(`archive blob-preservation assertion is false: ${archived.destinationPath}`);
}
const activeNames = new Set(entries.map((entry) => entry.name));
for (const archived of archiveManifest.entries) {
  if (activeNames.has(archived.migrationName)) fail(`active executable migration name also appears in archive: ${archived.migrationName}`);
}

if (receiptArg) {
  const receipt = JSON.parse(fs.readFileSync(path.resolve(root, receiptArg), 'utf8'));
  if (receipt.activeMigrationAggregateHash !== manifest.aggregateSha256) fail('release receipt aggregate differs');
  if (receipt.legacyArchiveManifestHash !== manifest.legacyArchiveManifestSha256) fail('release receipt archive hash differs');
  if (JSON.stringify(receipt.activeMigrationManifest) !== JSON.stringify(manifest.entries)) fail('release receipt migration entries differ');
}

console.log(JSON.stringify({
  verdict: 'PASS',
  activeMigrationCount: entries.length,
  activeMigrationOrder: entries.map((entry) => entry.name),
  rawHashes: Object.fromEntries(entries.map((entry) => [entry.name, entry.sha256])),
  activeMigrationAggregateSha256: aggregateSha256,
  legacyArchiveManifestSha256: archiveHash,
  archivedMigrationDirectoryCount: archiveManifest.migrationDirectoryCount,
  archivedSqlCount: actualArchivePaths.length,
  releaseReceiptVerified: Boolean(receiptArg),
}, null, 2));
