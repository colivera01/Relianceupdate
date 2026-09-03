import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadCustomerServiceRecords } from './customer-service-records-server';
import { normalizePrismaSqlServerUrl } from './prisma-sqlserver-url';

// Opt-in release check only. Never seeds, authenticates, or invokes mutations.
const artifact = process.env.RELIANCE_ARTIFACT_READONLY_ROOT;
const customerUserId = process.env.RELIANCE_READONLY_CUSTOMER_ID;
it.skipIf(!artifact || !customerUserId)('extracted candidate client reads beta contracts and the actual customer loader without adapters', async () => {
  const root = resolve(artifact!);
  const packagedRequire = createRequire(resolve(root, 'package.json'));
  const require = createRequire(import.meta.url);
  const { verify } = require('../../scripts/release/verify_prisma_artifact.cjs');
  const manifest = JSON.parse(readFileSync(resolve(root, 'prisma-artifact-manifest.json'), 'utf8'));
  expect(verify(root, manifest).verdict).toBe('PASS');
  const { PrismaClient, Prisma } = packagedRequire('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: normalizePrismaSqlServerUrl(process.env.DATABASE_URL) || process.env.DATABASE_URL } } });
  try {
    const database = await db.$queryRaw`SELECT DB_NAME() AS name`;
    expect(database[0].name).toBe('reliance-beta-db');
    const migrations = await db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
    expect(migrations.filter((row: any) => row.finished_at && !row.rolled_back_at)).toHaveLength(53);
    expect(migrations.filter((row: any) => !row.finished_at && !row.rolled_back_at)).toHaveLength(0);
    const protectedId = 'cmtj89mlo004llufi0b6tvdpj';
    const snapshot = async () => {
      const rows: Record<string, unknown> = { Booking: await db.booking.findUnique({ where: { id: protectedId } }) };
      for (const model of Prisma.dmmf.datamodel.models) {
        if (!model.fields.some((field: any) => field.name === 'bookingId' && field.kind === 'scalar')) continue;
        const delegate = model.name[0].toLowerCase() + model.name.slice(1);
        const entries = await db[delegate].findMany({ where: { bookingId: protectedId } });
        rows[model.name] = entries.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
      }
      rows.VendorFavorite = await db.vendorFavorite.findMany({ where: { userId: customerUserId }, orderBy: { id: 'asc' } });
      return createHash('sha256').update(JSON.stringify(rows, (_key, value) => typeof value === 'bigint' ? value.toString() : value)).digest('hex');
    };
    const before = await snapshot();
    const packageId = 'cmtj8l7eu007ulufinhjhtvgw';
    const passId = 'cmtj8qmd400b9lufi84x8tk9f';
    const grantId = 'cmtj8qmef00balufiv9xojezw';
    const packageHash = 'bd0df99505832e379180f1f16621347f3279215497f4f765275cd160f917e0ba';
    expect(await db.serviceVideoPackageEvidence.findUnique({ where: { id: packageId } })).toMatchObject({ bookingId: protectedId, status: 'PRIVATE_APPROVED', isCurrent: true, packageHash, adminAuditDecisionId: passId, customerAccessGrantId: grantId });
    expect(await db.serviceVideoAdminAuditDecisionEvidence.findUnique({ where: { id: passId } })).toMatchObject({ bookingId: protectedId, packageId, packageHash, decision: 'PASS', customerAccessGrantId: grantId });
    expect(await db.privateProofAccessGrant.findUnique({ where: { id: grantId } })).toMatchObject({ bookingId: protectedId, packageId, adminAuditDecisionId: passId, customerUserId, status: 'ACTIVE' });
    await db.customerServiceRecordOrganizationEvent.findMany({ take: 1, select: { id: true } });
    await db.vendorFavorite.count();
    await db.review.findMany({ take: 1, select: Object.fromEntries(['id', ...manifest.requiredReviewFields].map((field) => [field, true])) });
    const all = await loadCustomerServiceRecords({ db, customerUserId: customerUserId!, includeAll: true });
    expect(all.counts).toEqual({ upcoming: 2, completed: 4, needs_attention: 0, cancelled: 2, archived: 1, unclassified: 0 });
    expect(all.records).toHaveLength(9);
    const page = await loadCustomerServiceRecords({ db, customerUserId: customerUserId!, requestedTab: 'completed', search: 'Breaker', page: 1, limit: 1 });
    expect(page.records.map((row) => row.id)).toEqual([protectedId]);
    expect(page.pagination.total).toBe(1);
    const detail = await loadCustomerServiceRecords({ db, customerUserId: customerUserId!, bookingId: protectedId, includeAll: true });
    expect(detail.records).toHaveLength(1);
    expect(detail.records[0].customer_record).toMatchObject({ lifecycle: 'COMPLETED', archived: false, attention: { required: false }, video: { state: 'READY' }, review: { state: 'LEAVE_REVIEW' }, visibility: { label: 'Private' } });
    expect(await db.review.count({ where: { bookingId: protectedId } })).toBe(0);
    expect(await db.employeeCustomerRatingEvidence.count({ where: { bookingId: protectedId } })).toBe(0);
    expect(await db.customerServiceRecordOrganizationEvent.count({ where: { bookingId: protectedId } })).toBe(0);
    expect(await db.employeeRecordingSafetyEvidence.count({ where: { bookingId: protectedId } })).toBe(0);
    const visibility = await db.serviceVideoPackageVisibilityDecision.findMany({ where: { bookingId: protectedId }, orderBy: { version: 'asc' }, select: { version: true, decision: true, isCurrent: true } });
    expect(visibility).toEqual([{ version: 1, decision: 'KEEP_PRIVATE', isCurrent: false }, { version: 2, decision: 'SHARE_PUBLICLY', isCurrent: false }, { version: 3, decision: 'KEEP_PRIVATE', isCurrent: true }]);
    const after = await snapshot();
    expect(after).toBe(before);
    console.log(JSON.stringify({ verdict: 'PASS', clientRoot: root, sourceCommit: manifest.sourceCommit, migrations: 53, unresolved: 0, counts: all.counts, protectedBeforeSha256: before, protectedAfterSha256: after, mutations: 0 }));
  } finally { await db.$disconnect(); }
}, 180_000);
