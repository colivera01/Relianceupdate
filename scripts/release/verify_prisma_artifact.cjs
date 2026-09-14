#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const schemaText = (value) => value.replace(/\r\n/g, '\n').trim();
const requiredReviewFields = ['contractVersion', 'ratingValidityStatus', 'ratingInvalidationReason', 'ratingInvalidatedAt', 'ratingInvalidatedByUserId', 'submissionRequestId', 'submissionRequestHash'];

function assertInside(root, file) {
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `Runtime dependency escapes isolated root: ${file}`);
}

function inspect(root) {
  root = path.resolve(root);
  const runtimeRequire = createRequire(path.join(root, 'package.json'));
  const entry = runtimeRequire.resolve('@prisma/client');
  assertInside(root, entry);
  const clientPackage = runtimeRequire.resolve('@prisma/client/package.json');
  const generatedDir = path.join(root, 'node_modules/.prisma/client');
  const generatedSchema = path.join(generatedDir, 'schema.prisma');
  assertInside(root, generatedSchema);
  const { PrismaClient, Prisma } = runtimeRequire('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: 'sqlserver://localhost:1433;database=artifact_validation;user=unused;password=unused;trustServerCertificate=true' } } });
  try {
    const models = Prisma.dmmf.datamodel.models;
    for (const model of models) {
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      assert.equal(typeof db[delegate]?.findMany, 'function', `Missing Prisma delegate: ${delegate}`);
    }
    for (const delegate of ['customerServiceRecordOrganizationEvent', 'vendorFavorite']) {
      assert.equal(typeof db[delegate]?.findMany, 'function', `Missing current Prisma delegate: ${delegate}`);
    }
    const review = models.find((model) => model.name === 'Review');
    for (const field of requiredReviewFields) assert(review?.fields.some((item) => item.name === field), `Missing current Review.${field}`);
    assertInside(root, createRequire(entry).resolve('.prisma/client/default'));
    assertInside(root, runtimeRequire.resolve('@prisma/client/runtime/library'));
    const generated = fs.readFileSync(generatedSchema);
    assert.equal(schemaText(db._engineConfig.inlineSchema), schemaText(generated.toString()), 'Generated executable/schema mismatch');
    const version = readJson(clientPackage).version;
    assert.equal(Prisma.prismaVersion.client, version, 'Generated client/@prisma/client version mismatch');
    assert.equal(db._engineConfig.activeProvider, 'sqlserver', 'Wrong datasource provider');
    const engineFiles = fs.readdirSync(generatedDir).filter((name) => /query_engine.*\.(node|dll)$/.test(name)).sort();
    assert(engineFiles.includes('libquery_engine-debian-openssl-3.0.x.so.node'), 'Missing Azure Linux query engine');
    if (process.platform === 'win32') assert(engineFiles.includes('query_engine-windows.dll.node'), 'Missing native validation engine');
    const engines = Object.fromEntries(engineFiles.map((name) => [name, sha256(fs.readFileSync(path.join(generatedDir, name)))]));
    const codeHashes = Object.fromEntries([
      'node_modules/.prisma/client/index.js', 'node_modules/.prisma/client/default.js', 'node_modules/.prisma/client/package.json',
      'node_modules/@prisma/client/default.js', 'node_modules/@prisma/client/package.json', 'node_modules/@prisma/client/runtime/library.js',
    ].map((name) => [name, sha256(fs.readFileSync(path.join(root, name)))]));
    // Load the native engine without connecting to a database.
    const nativeName = process.platform === 'win32' ? 'query_engine-windows.dll.node' : 'libquery_engine-debian-openssl-3.0.x.so.node';
    const native = runtimeRequire(path.join(generatedDir, nativeName));
    assert.equal(native.version().commit, Prisma.prismaVersion.engine, 'Query engine/generated-client revision mismatch');
    const contract = models.map((model) => ({ ...model, fields: [...model.fields].sort((a, b) => a.name.localeCompare(b.name)) })).sort((a, b) => a.name.localeCompare(b.name));
    return {
      generatedSchemaSha256: sha256(generated), generatedSchema: schemaText(generated.toString()),
      clientVersion: version, engineVersion: Prisma.prismaVersion.engine,
      engines, codeHashes, models: contract, requiredReviewFields,
    };
  } finally { void db.$disconnect(); }
}

function createManifest(root, schema, lockfile, commit) {
  assert(/^[a-f0-9]{40}$/.test(commit), 'Exact source commit required');
  const runtime = inspect(root);
  const source = fs.readFileSync(schema);
  assert.equal(runtime.generatedSchema, schemaText(source.toString()), 'Generated schema is not the current source schema');
  const lock = readJson(lockfile);
  assert.equal(runtime.clientVersion, lock.packages['node_modules/@prisma/client'].version, 'Client differs from lockfile');
  assert.equal(runtime.clientVersion, lock.packages['node_modules/prisma'].version, 'CLI/client version mismatch');
  const { generatedSchema, ...evidence } = runtime;
  return { contractVersion: 1, sourceCommit: commit, sourceSchemaSha256: sha256(source), sourceSchemaNormalizedSha256: sha256(generatedSchema), lockfileSha256: sha256(fs.readFileSync(lockfile)), prismaCliVersion: lock.packages['node_modules/prisma'].version, ...evidence };
}

function verify(root, manifest) {
  const runtime = inspect(root);
  assert.equal(manifest.contractVersion, 1, 'Unsupported artifact manifest');
  assert.equal(sha256(runtime.generatedSchema), manifest.sourceSchemaNormalizedSha256, 'Source semantic schema mismatch');
  for (const key of ['generatedSchemaSha256', 'clientVersion', 'engineVersion', 'engines', 'codeHashes', 'models', 'requiredReviewFields']) {
    assert.deepEqual(runtime[key], manifest[key], `Packaged Prisma ${key} differs from current generation`);
  }
  return { verdict: 'PASS', sourceCommit: manifest.sourceCommit, sourceSchemaSha256: manifest.sourceSchemaSha256, generatedSchemaSha256: runtime.generatedSchemaSha256, clientVersion: runtime.clientVersion, engineVersion: runtime.engineVersion, modelCount: runtime.models.length };
}

module.exports = { inspect, createManifest, verify, schemaText, sha256 };
if (require.main === module) {
  try {
    const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 ? pairs : [...pairs, [value.replace(/^--/, ''), all[index + 1]]], []));
    if (args.mode === 'create') {
      const manifest = createManifest(args.root, args.schema, args.lockfile, args.commit);
      fs.writeFileSync(args.output, JSON.stringify(manifest, null, 2) + '\n');
      console.log(JSON.stringify({ verdict: 'PASS', sourceCommit: manifest.sourceCommit, generatedSchemaSha256: manifest.generatedSchemaSha256, modelCount: manifest.models.length }));
    } else {
      console.log(JSON.stringify(verify(args.root, readJson(args.manifest)), null, 2));
    }
  } catch (error) { console.error(`PRISMA_ARTIFACT_INVALID: ${error.message}`); process.exitCode = 1; }
}
