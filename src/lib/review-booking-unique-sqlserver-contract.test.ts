import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const baselinePath = path.join(
  process.cwd(),
  "prisma/migrations/00000000000000_reliance_forward_baseline_20260910/migration.sql"
);
const archivedMigrationPath = path.join(
  process.cwd(),
  "docs/database/migration-history-legacy/2026-09-10/20260907210000_restore_reviews_booking_unique_not_null/migration.sql"
);
const baseline = fs.readFileSync(baselinePath, "utf8");
const archivedMigration = fs.readFileSync(archivedMigrationPath, "utf8");

describe("review booking uniqueness SQL Server contract", () => {
  it("preserves the historical duplicate preflight as non-executable evidence", () => {
    expect(archivedMigration).toMatch(/GROUP BY \[bookingId\][\s\S]*HAVING COUNT_BIG\(\*\) > 1/);
    expect(archivedMigration).toContain("THROW 51056");
  });

  it("creates the intended filtered unique index in the active baseline", () => {
    expect(baseline).toMatch(
      /CREATE UNIQUE NONCLUSTERED INDEX \[reviews_bookingId_unique_not_null\][\s\S]*ON \[dbo\]\.\[reviews\]\(\[bookingId\]\)[\s\S]*WHERE \[bookingId\] IS NOT NULL/
    );
  });

  it("does not perform operational data mutations", () => {
    expect(baseline).not.toMatch(/^\s*UPDATE\s+/im);
    expect(baseline).not.toMatch(/^\s*DELETE\s+/im);
    expect(baseline).not.toMatch(/^\s*INSERT\s+/im);
  });
});
