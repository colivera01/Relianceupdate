import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const draftRoot = path.join(root, "docs/legal-content-drafts/2026-10-12");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : [absolute];
  });
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

describe("prospective legal content drafts", () => {
  it("has a deterministic, current package manifest", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/legal/build-prospective-content-manifest.mjs", "--check"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it("contains exactly the fourteen authorized draft content items", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(draftRoot, "manifest.json"), "utf8"));
    expect(manifest.entries).toHaveLength(14);
    expect(manifest.governanceStatus).toBe("DRAFT");
    expect(manifest.reviewState).toBe("PRODUCT_OWNER_REVIEW");
    expect(manifest.runtimeEffective).toBe(false);
    expect(manifest.counselApproved).toBe(false);
    expect(new Set(manifest.entries.map((entry: { contentKey: string }) => entry.contentKey)).size).toBe(14);
  });

  it("binds every exact display snapshot to its manifest hash", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(draftRoot, "manifest.json"), "utf8"));
    for (const entry of manifest.entries) {
      const document = fs.readFileSync(path.join(root, entry.file), "utf8").replace(/\r\n?/g, "\n");
      const body = document.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)?.[1];
      expect(body).toBeDefined();
      const snapshot = body!.endsWith("\n") ? body! : `${body!}\n`;
      expect(sha256(snapshot)).toBe(entry.contentSha256);
      expect(sha256(document)).toBe(entry.documentSha256);
      expect(document).toContain("# DRAFT / PRODUCT OWNER REVIEW");
      expect(document).toContain("runtime_effective: false");
      expect(document).toContain("counsel_approved: false");
    }
  });

  it("is not imported by any live application or component module", () => {
    const runtimeRoots = [path.join(root, "src/app"), path.join(root, "src/components")];
    const runtime = runtimeRoots
      .flatMap(sourceFiles)
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    expect(runtime).not.toContain("legal-content-drafts");
    expect(runtime).not.toContain("reliance-legal-content-drafts-2026-10-12");
  });

  it("does not claim an effective or counsel-approved state", () => {
    const documents = fs.readdirSync(draftRoot)
      .filter((file) => file.endsWith(".draft.md"))
      .map((file) => fs.readFileSync(path.join(draftRoot, file), "utf8"));
    for (const document of documents) {
      expect(document).toMatch(/governance_status: DRAFT/);
      expect(document).toMatch(/review_state: PRODUCT_OWNER_REVIEW/);
      expect(document).not.toMatch(/governance_status: (?:EFFECTIVE|COUNSEL_APPROVED)/);
      expect(document).not.toMatch(/counsel_approved: true/);
      expect(document).not.toMatch(/runtime_effective: true/);
    }
  });
});
