import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const require = createRequire(import.meta.url);
const { createManifest, verify, inspect } = require('../../scripts/release/verify_prisma_artifact.cjs');
const root = process.cwd();
const commit = '250cce8a7ffc2ccaef0916a18c678425e999aaf4';
const temporary: string[] = [];
afterAll(() => { for (const directory of temporary) rmSync(directory, { recursive: true, force: true }); });

describe('release Prisma artifact contract', () => {
  const manifest = () => createManifest(root, resolve('prisma/schema.prisma'), resolve('package-lock.json'), commit);
  it('loads the current generated client, every delegate, full DMMF and native engine', () => {
    const result = verify(root, manifest());
    expect(result.verdict).toBe('PASS');
    expect(result.modelCount).toBe(manifest().models.length);
  });
  it.each(['generatedSchemaSha256', 'clientVersion', 'engineVersion', 'sourceSchemaNormalizedSha256'])('rejects stale/mixed %s', (key) => {
    expect(() => verify(root, { ...manifest(), [key]: 'stale-donor' })).toThrow();
  });
  it('rejects a changed generated model/field contract', () => {
    const stale = manifest();
    stale.models = stale.models.filter((model: { name: string }) => model.name !== 'VendorFavorite');
    expect(() => verify(root, stale)).toThrow(/models/);
  });
  it('rejects missing or different engine assets', () => {
    expect(() => verify(root, { ...manifest(), engines: {} })).toThrow(/engines/);
  });
  it('rejects mixed generated/runtime JavaScript even when versions match', () => {
    expect(() => verify(root, { ...manifest(), codeHashes: {} })).toThrow(/codeHashes/);
  });
  it('requires generation from the exact current schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prisma-schema-test-')); temporary.push(dir);
    const schema = join(dir, 'schema.prisma');
    writeFileSync(schema, readFileSync(resolve('prisma/schema.prisma'), 'utf8').replace('model VendorFavorite', 'model OldFavorite'));
    expect(() => createManifest(root, schema, resolve('package-lock.json'), commit)).toThrow(/current source schema/);
  });
  it.each(['vendorFavorite', 'customerServiceRecordOrganizationEvent'])('rejects an actual loaded stale client missing %s', (missing) => {
    const dir = mkdtempSync(join(tmpdir(), 'prisma-stale-test-')); temporary.push(dir);
    const client = join(dir, 'node_modules/@prisma/client'); mkdirSync(client, { recursive: true });
    const generated = join(dir, 'node_modules/.prisma/client'); mkdirSync(generated, { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{}');
    writeFileSync(join(client, 'package.json'), '{"main":"index.js","version":"6.19.0"}');
    writeFileSync(join(generated, 'schema.prisma'), '// deliberately stale fixture');
    writeFileSync(join(client, 'index.js'), `exports.Prisma={dmmf:{datamodel:{models:[]}}}; exports.PrismaClient=class{constructor(){this.${missing === 'vendorFavorite' ? 'customerServiceRecordOrganizationEvent' : 'vendorFavorite'}={findMany(){}}} $disconnect(){}};`);
    expect(() => inspect(dir)).toThrow(`Missing current Prisma delegate: ${missing}`);
  });
  it.each(['contractVersion', 'ratingValidityStatus', 'ratingInvalidationReason', 'ratingInvalidatedAt', 'ratingInvalidatedByUserId', 'submissionRequestId', 'submissionRequestHash'])('rejects an executable client missing Review.%s', (missing) => {
    const dir = mkdtempSync(join(tmpdir(), 'prisma-review-stale-')); temporary.push(dir);
    const client = join(dir, 'node_modules/@prisma/client'); mkdirSync(client, { recursive: true });
    const generated = join(dir, 'node_modules/.prisma/client'); mkdirSync(generated, { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{}');
    writeFileSync(join(client, 'package.json'), '{"main":"index.js","version":"6.19.0"}');
    writeFileSync(join(generated, 'schema.prisma'), '// stale review fixture');
    const fields = manifest().requiredReviewFields.filter((name: string) => name !== missing).map((name: string) => ({ name }));
    writeFileSync(join(client, 'index.js'), `exports.Prisma={dmmf:{datamodel:{models:[{name:'Review',fields:${JSON.stringify(fields)}}]}}}; exports.PrismaClient=class{constructor(){this.review=this.vendorFavorite=this.customerServiceRecordOrganizationEvent={findMany(){}}} $disconnect(){}};`);
    expect(() => inspect(dir)).toThrow(`Missing current Review.${missing}`);
  });
});
