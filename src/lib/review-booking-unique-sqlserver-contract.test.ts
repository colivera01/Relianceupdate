import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "docs/database/migration-history-legacy/2026-09-14-v2/20260907210000_restore_reviews_booking_unique_not_null/migration.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");

describe("review booking uniqueness SQL Server contract", () => {
  it("fails closed on existing duplicate non-null booking attribution", () => {
    expect(migration).toMatch(/GROUP BY \[bookingId\][\s\S]*HAVING COUNT_BIG\(\*\) > 1/);
    expect(migration).toContain("THROW 51056");
  });

  it("creates the intended filtered unique index with SQL Server-safe dynamic DDL", () => {
    expect(migration).toMatch(
      /EXEC\(N'CREATE UNIQUE INDEX \[reviews_bookingId_unique_not_null\][\s\S]*ON \[dbo\]\.\[reviews\]\(\[bookingId\]\)[\s\S]*WHERE \[bookingId\] IS NOT NULL'\)/
    );
    expect(migration).toContain("i.[is_unique] <> 1");
    expect(migration).toContain("i.[has_filter] <> 1");
    expect(migration).toContain("i.[is_disabled] <> 0");
  });

  it("does not rewrite Review or ReviewWindow evidence", () => {
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bINSERT\b/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE/i);
    expect(migration).not.toContain("review_windows");
  });
});
