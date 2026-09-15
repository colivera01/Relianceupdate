import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'docs/database/migration-history-legacy/2026-09-14-v2/20260906183000_fix_review_window_nullable_unique/migration.sql',
);
const baselinePath = path.join(
  process.cwd(),
  'prisma/migrations/00000000000000_reliance_forward_baseline_20260914_v2/migration.sql',
);

describe('Review Window SQL Server constraint contract', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const baseline = fs.readFileSync(baselinePath, 'utf8');
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('defines the nullable review relation as a filtered unique index in the active baseline', () => {
    expect(baseline).toMatch(/CREATE UNIQUE NONCLUSTERED INDEX \[review_windows_reviewId_key\][\s\S]*WHERE \[reviewId\] IS NOT NULL/);
    expect(baseline).not.toMatch(/UPDATE\s+\[dbo\]\.\[review_windows\]/i);
    expect(baseline).not.toMatch(/INSERT\s+INTO/i);
  });

  it('replaces the nullable review relation with a filtered unique index', () => {
    expect(migration).toContain('DROP CONSTRAINT [review_windows_reviewId_key]');
    expect(migration).toContain('DROP INDEX [review_windows_reviewId_key]');
    expect(migration).toMatch(/CREATE UNIQUE INDEX \[review_windows_reviewId_key\][\s\S]*WHERE \[reviewId\] IS NOT NULL/);
    expect(migration).not.toMatch(/UPDATE\s+\[dbo\]\.\[review_windows\]/i);
    expect(migration).not.toMatch(/INSERT\s+INTO/i);
  });

  it('makes the application get-or-create tuple a database identity', () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX \[review_windows_booking_vendor_media_key\][\s\S]*\[bookingId\], \[vendorId\], \[mediaSessionId\]/,
    );
    expect(schema).toContain(
      '@@unique([bookingId, vendorId, mediaSessionId], map: "review_windows_booking_vendor_media_key")',
    );
  });

  it('retains the Prisma one-to-one relation annotation without weakening reviewId uniqueness', () => {
    expect(schema).toContain('reviewId       String?   @unique(map: "review_windows_reviewId_key")');
    expect(schema).toContain('review       Review?');
  });
});
