import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { geocodeAddress, getGeocodingProvider, hasCompleteAddress } from '../src/lib/geocoding';

const prisma = new PrismaClient();

type BackfillKind = 'users' | 'vendors' | 'all';

type BackfillRecord = {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: Date | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const kind = readArg('kind', 'all') as BackfillKind;
const limit = Number(readArg('limit', '100'));

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  if (!['users', 'vendors', 'all'].includes(kind)) {
    throw new Error(`Invalid --kind value "${kind}". Use users, vendors, or all.`);
  }

  const provider = getGeocodingProvider();
  console.log(
    `Geocoding backfill starting: provider=${provider}, kind=${kind}, limit=${limit}, force=${force}, dryRun=${dryRun}`
  );

  if (provider === 'disabled') {
    console.log('Geocoding is disabled; no records will be updated.');
    return;
  }

  if (kind === 'users' || kind === 'all') {
    await backfillUsers();
  }
  if (kind === 'vendors' || kind === 'all') {
    await backfillVendors();
  }
}

async function backfillUsers() {
  const users = await (prisma as any).user.findMany({
    where: {
      address: { not: null },
      city: { not: null },
      state: { not: null },
      zipCode: { not: null },
      ...(force ? {} : { geocodedAt: null }),
    },
    select: locationSelect,
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  await processRecords('user', users, async (record, data) => {
    await (prisma as any).user.update({ where: { id: record.id }, data });
  });
}

async function backfillVendors() {
  const vendors = await (prisma as any).vendor.findMany({
    where: {
      address: { not: null },
      city: { not: null },
      state: { not: null },
      zipCode: { not: null },
      ...(force ? {} : { geocodedAt: null }),
    },
    select: locationSelect,
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  await processRecords('vendor', vendors, async (record, data) => {
    await (prisma as any).vendor.update({ where: { id: record.id }, data });
  });
}

const locationSelect = {
  id: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  latitude: true,
  longitude: true,
  geocodedAt: true,
} as const;

async function processRecords(
  label: 'user' | 'vendor',
  records: BackfillRecord[],
  updateRecord: (
    record: BackfillRecord,
    data: { latitude: number; longitude: number; geocodedAt: Date }
  ) => Promise<void>
) {
  console.log(`Found ${records.length} ${label} record(s) eligible for geocoding.`);
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const addressInput = {
      address: record.address,
      city: record.city,
      state: record.state,
      zipCode: record.zipCode,
    };
    if (!hasCompleteAddress(addressInput)) {
      skipped += 1;
      console.log(`skip ${label}:${record.id} incomplete address`);
      continue;
    }

    const result = await geocodeAddress(addressInput);
    if (result.status !== 'success') {
      skipped += 1;
      console.log(`skip ${label}:${record.id} geocode=${result.status} ${result.message || ''}`.trim());
      continue;
    }

    const data = {
      latitude: result.latitude,
      longitude: result.longitude,
      geocodedAt: result.geocodedAt,
    };
    if (!dryRun) {
      await updateRecord(record, data);
    }
    updated += 1;
    console.log(`${dryRun ? 'would update' : 'updated'} ${label}:${record.id}`);
  }

  console.log(`${label} backfill complete: updated=${updated}, skipped=${skipped}`);
}

main()
  .catch((error) => {
    console.error('Geocoding backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
