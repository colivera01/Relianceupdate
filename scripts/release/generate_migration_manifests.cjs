#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const slash = (value) => value.replace(/\\/g, '/');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function git(root, args, encoding = 'utf8') {
  const result = spawnSync('git', args, { cwd: root, encoding, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || `Git failed: ${args.join(' ')}`);
  return encoding ? result.stdout.trim() : result.stdout;
}

function sqlFiles(root) {
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.sql$/i.test(entry.name)) found.push(target);
    }
  };
  walk(root);
  return found.sort();
}

function createArchiveManifest({ root, sourceCommit, archiveDirectory }) {
  const archiveRoot = path.resolve(root, archiveDirectory);
  const directories = fs.readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.equal(directories.length, 57, 'Expected exactly 57 archived migration directories');
  const entries = directories.map((migrationName) => {
    const directory = path.join(archiveRoot, migrationName);
    const files = sqlFiles(directory).map((file) => {
      const fileName = path.basename(file);
      const sourcePath = `prisma/migrations/${migrationName}/${fileName}`;
      const destinationPath = slash(path.relative(root, file));
      const sourceBytes = git(root, ['show', `${sourceCommit}:${sourcePath}`], null);
      let archivedBytes = fs.readFileSync(file);
      if (!sourceBytes.equals(archivedBytes)) {
        fs.writeFileSync(file, sourceBytes);
        archivedBytes = fs.readFileSync(file);
      }
      const sourceGitBlobSha = git(root, ['rev-parse', `${sourceCommit}:${sourcePath}`]);
      const archivedGitBlobSha = git(root, ['hash-object', file]);
      assert(sourceBytes.equals(archivedBytes), `Archive bytes differ from ${sourceCommit}:${sourcePath}`);
      assert.equal(sourceGitBlobSha, archivedGitBlobSha, `Archive Git blob differs: ${destinationPath}`);
      return {
        migrationName,
        fileName,
        sourcePath,
        destinationPath,
        sourceGitBlobSha,
        archivedGitBlobSha,
        sourceGitSha256: sha256(sourceBytes),
        archivedRawSha256: sha256(archivedBytes),
        bytes: archivedBytes.length,
        match: true,
      };
    });
    return { migrationName, driftClassification: 'PRESERVED_FROM_933262_SOURCE', archivedFiles: files };
  });
  const archivedFiles = entries.flatMap((entry) => entry.archivedFiles);
  assert.equal(archivedFiles.length, 61, 'Expected exactly 61 archived SQL files');
  const aggregateArchivedPathAndBytesSha256 = sha256(Buffer.from(archivedFiles
    .map((file) => `${file.destinationPath}\0${file.archivedRawSha256}\0${file.bytes}\n`).join('')));
  return {
    archiveVersion: 3,
    sourceCommit,
    generatedAt: new Date().toISOString(),
    currentCanonicalDatabase: 'reliance-beta-recovery-a8ae548',
    migrationDirectoryCount: directories.length,
    archivedSqlFileCount: archivedFiles.length,
    sourceGitBlobPreservation: true,
    aggregateArchivedPathAndBytesSha256,
    entries,
  };
}

function createActiveManifest({ root, sourceCommit, archiveManifestPath, archiveManifestBytes }) {
  const migrationRoot = path.join(root, 'prisma', 'migrations');
  const entries = fs.readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    .map((name) => {
      const bytes = fs.readFileSync(path.join(migrationRoot, name, 'migration.sql'));
      return { name, sha256: sha256(bytes), bytes: bytes.length };
    });
  assert.equal(entries.length, 2, 'Forward foundation must contain exactly two active migrations');
  return {
    manifestVersion: 2,
    sourceCheckpoint: sourceCommit,
    currentCanonicalDatabase: 'reliance-beta-recovery-a8ae548',
    entries,
    aggregateSha256: sha256(Buffer.from(entries.map((entry) => `${entry.name}\0${entry.sha256}\0${entry.bytes}\n`).join(''))),
    legacyArchiveManifest: slash(path.relative(root, archiveManifestPath)),
    legacyArchiveManifestSha256: sha256(archiveManifestBytes),
  };
}

function writeJsonExclusive(file, value) {
  assert(!fs.existsSync(file), `Refusing to overwrite ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function generate({ root, sourceCommit, archiveDirectory }) {
  const archiveManifest = createArchiveManifest({ root, sourceCommit, archiveDirectory });
  const archiveManifestPath = path.join(root, archiveDirectory, 'archive-manifest.json');
  const archiveBytes = Buffer.from(`${JSON.stringify(archiveManifest, null, 2)}\n`);
  writeJsonExclusive(archiveManifestPath, archiveManifest);
  fs.writeFileSync(`${archiveManifestPath}.sha256`, `${sha256(archiveBytes)}  archive-manifest.json\n`, { flag: 'wx' });
  const activeManifest = createActiveManifest({ root, sourceCommit, archiveManifestPath, archiveManifestBytes: archiveBytes });
  writeJsonExclusive(path.join(root, 'prisma', 'active-migration-manifest.json'), activeManifest);
  return { verdict: 'PASS', archiveManifest, activeManifest };
}

if (require.main === module) {
  try {
    const root = process.cwd();
    const sourceCommit = git(root, ['rev-parse', '9332627314ea6f8786625cc0891f58b9582736e5']);
    const result = generate({
      root,
      sourceCommit,
      archiveDirectory: 'docs/database/migration-history-legacy/2026-09-14-v2',
    });
    process.stdout.write(`${JSON.stringify({
      verdict: result.verdict,
      sourceCommit,
      archivedDirectories: result.archiveManifest.migrationDirectoryCount,
      archivedSqlFiles: result.archiveManifest.archivedSqlFileCount,
      activeMigrations: result.activeManifest.entries.map((entry) => entry.name),
      activeAggregateSha256: result.activeManifest.aggregateSha256,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`MIGRATION_MANIFEST_GENERATION_FAILED: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { createActiveManifest, createArchiveManifest, generate, sha256 };
