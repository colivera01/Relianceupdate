import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const baselinePath = path.join(
  process.cwd(),
  'prisma/migrations/00000000000000_reliance_forward_baseline_20260910/migration.sql',
);
const archivedMigrationPath = path.join(
  process.cwd(),
  'docs/database/migration-history-legacy/2026-09-10/20260906183000_fix_review_window_nullable_unique/migration.sql',
);

describe('Review Window SQL Server constraint contract', () => {
  const baseline = fs.readFileSync(baselinePath, 'utf8');
  const archivedMigration = fs.readFileSync(archivedMigrationPath, 'utf8');
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('defines the nullable review relation as a filtered unique index in the active baseline', () => {
    expect(baseline).toMatch(/CREATE UNIQUE NONCLUSTERED INDEX \[review_windows_reviewId_key\][\s\S]*WHERE \[reviewId\] IS NOT NULL/);
    expect(baseline).not.toMatch(/UPDATE\s+\[dbo\]\.\[review_windows\]/i);
    expect(baseline).not.toMatch(/INSERT\s+INTO/i);
  });

  it('preserves the historical replacement migration as non-executable evidence', () => {
    expect(archivedMigration).toContain('DROP CONSTRAINT [review_windows_reviewId_key]');
    expect(archivedMigration).toContain('DROP INDEX [review_windows_reviewId_key]');
  });

  it('makes the application get-or-create tuple a database identity', () => {
    expect(baseline).toMatch(
      /CONSTRAINT \[review_windows_booking_vendor_media_key\] UNIQUE NONCLUSTERED \(\[bookingId\],\[vendorId\],\[mediaSessionId\]\)/,
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
