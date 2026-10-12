import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "prisma/migrations/20261012193000_add_dormant_legal_consent_infrastructure/migration.sql",
);

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : [absolute];
  });
}

describe("dormant legal infrastructure contract", () => {
  it("uses one additive migration with no data rewrite or destructive statement", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE TABLE [dbo].[governed_content_versions]");
    expect(sql).toContain("CREATE TABLE [dbo].[role_assent_evidence]");
    expect(sql).toContain("CREATE TABLE [dbo].[public_choice_content_evidence]");
    expect(sql).toContain("CREATE TABLE [dbo].[privacy_case_references]");
    expect(sql).toContain("CREATE TABLE [dbo].[privacy_case_events]");
    expect(sql).not.toMatch(/^\s*(?:ALTER|DELETE|DROP|INSERT|MERGE|TRUNCATE|UPDATE)\b/gim);
    expect(sql).toContain("governed_content_versions_supersedesVersionId_fkey");
    expect(sql).toContain("role_assent_evidence_supersedesEvidenceId_fkey");
  });

  it("cannot persist an EFFECTIVE or COUNSEL_APPROVED governance state", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    expect(sql).toContain("[governanceStatus] IN (N'DRAFT', N'PRODUCT_OWNER_APPROVED')");
    expect(sql).not.toContain("COUNSEL_APPROVED");
    expect(sql).not.toContain("N'EFFECTIVE'");
    const model = schema.match(/model GovernedContentVersion \{[\s\S]*?\n\}/)?.[0] || "";
    expect(model).not.toContain("effectiveAt");
    expect(model).not.toContain("counselApproved");
  });

  it("has no live app route, UI, or scheduler import", () => {
    const appRoot = path.join(root, "src/app");
    const appSource = sourceFiles(appRoot)
      .filter((file) => /\.(?:ts|tsx)$/.test(file))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    expect(appSource).not.toContain("governed-content-evidence");
    expect(appSource).not.toContain("assent-gap-report");
    expect(appSource).not.toContain("retention-dry-run");
    expect(appSource).not.toContain("privacy-case-infrastructure");
  });

  it("keeps retired product concepts absent from the new contract", () => {
    const files = [
      migrationPath,
      path.join(root, "src/lib/legal/governed-content-evidence.ts"),
      path.join(root, "src/lib/legal/assent-gap-report.ts"),
      path.join(root, "src/lib/legal/retention-dry-run.ts"),
      path.join(root, "src/lib/legal/privacy-case-infrastructure.ts"),
    ];
    const body = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(body).not.toMatch(/72[- ]hour/i);
    expect(body).not.toMatch(/automatic five[- ]star/i);
    expect(body).not.toMatch(/decide later/i);
    expect(body).not.toMatch(/public review/i);
    expect(body).not.toMatch(/tiktok|bytedance/i);
  });
});
