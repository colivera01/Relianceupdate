import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260917120000_add_employee_verified_participation_v2",
  "migration.sql",
);

describe("Phase 2 employee participation migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("is additive and does not rewrite historical evidence", () => {
    expect(sql).not.toMatch(/(?:^|;)\s*(?:DROP|DELETE|TRUNCATE)\b/im);
    expect(sql).not.toMatch(/\bUPDATE\s+\[dbo\]\./i);
    expect(sql).not.toMatch(/\bMERGE\s+\[dbo\]\./i);
    expect(sql).toContain("ADD [membershipGeneration] INT NOT NULL");
    expect(sql).toContain("ADD [employeeParticipationEvidenceJson] NVARCHAR(MAX) NULL");
    expect(sql).toContain("CREATE TABLE [dbo].[employee_decision_verification_challenges]");
    expect(sql).toContain("CREATE TABLE [dbo].[employee_verified_decision_sessions]");
    expect(sql).toContain("CREATE TABLE [dbo].[employee_recording_participation_decisions]");
  });

  it("preserves durable legal evidence through NO ACTION foreign keys", () => {
    const foreignKeys = sql.match(/FOREIGN KEY[\s\S]*?ON DELETE\s+NO ACTION\s+ON UPDATE\s+NO ACTION/gi) || [];
    expect(foreignKeys.length).toBeGreaterThanOrEqual(16);
    expect(sql).not.toMatch(/ON DELETE\s+CASCADE/i);
  });

  it("uses SQL Server-safe dynamic DDL for indexes and constraints on altered columns", () => {
    expect(sql).toContain("EXEC(N'CREATE INDEX [employee_public_media_consent_verificationSessionId_idx]");
    expect(sql).toContain("EXEC(N'ALTER TABLE [dbo].[employee_public_media_consent_decisions]");
  });
});
