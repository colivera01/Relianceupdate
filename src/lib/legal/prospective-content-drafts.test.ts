import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const legacyRoot = path.join(root, "docs/legal-content-drafts/2026-10-12");
const revisedRoot = path.join(root, "docs/legal-content-drafts/2026-10-12-draft.2");
const currentRoot = path.join(root, "docs/legal-content-drafts/2026-10-13-draft.3");
const legacyPackageSha256 = "63bb7c9523e4690e85843d542b92cd6d78d8ad70714c5b0e13be2df573f5f83b";
const revisedPackageSha256 = "78893222833248ff6f299e78c59ac1a2a0fba893a8e4e8f72ca50022891d0555";

type LegacyEntry = {
  contentKey: string;
  version: string;
  contentSha256: string;
  documentSha256: string;
};

type RevisedEntry = {
  file: string;
  contentKey: string;
  version: string;
  predecessor: {
    version: string;
    contentSha256: string;
    documentSha256: string;
  };
  publishableBodySha256: string;
  internalActivationNotesSha256: string;
  documentSha256: string;
};

type CurrentEntry = Omit<RevisedEntry, "predecessor"> & {
  predecessor: {
    version: string;
    publishableBodySha256: string;
    internalActivationNotesSha256: string;
    documentSha256: string;
  };
};

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : [absolute];
  });
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function boundedSection(document: string, name: string): string {
  const begin = `<!-- BEGIN ${name} -->\n`;
  const end = `\n<!-- END ${name} -->`;
  const start = document.indexOf(begin);
  const finish = document.indexOf(end);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(finish).toBeGreaterThan(start);
  expect(document.indexOf(begin, start + begin.length)).toBe(-1);
  expect(document.indexOf(end, finish + end.length)).toBe(-1);
  return `${document.slice(start + begin.length, finish)}\n`;
}

function revisedDocument(fileName: string): string {
  return normalize(fs.readFileSync(path.join(revisedRoot, fileName), "utf8"));
}

function publishableCopy(fileName: string): string {
  return boundedSection(revisedDocument(fileName), "PROSPECTIVE USER-FACING COPY");
}

function currentDocument(fileName: string): string {
  return normalize(fs.readFileSync(path.join(currentRoot, fileName), "utf8"));
}

function currentPublishableCopy(fileName: string): string {
  return boundedSection(currentDocument(fileName), "PROSPECTIVE USER-FACING COPY");
}

describe("prospective legal content drafts", () => {
  it("has deterministic current manifests and preserves revision 1", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/legal/build-prospective-content-manifest.mjs", "--check"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const legacy = JSON.parse(
      fs.readFileSync(path.join(legacyRoot, "manifest.json"), "utf8"),
    );
    expect(legacy.packageSha256).toBe(legacyPackageSha256);
    expect(legacy.entries).toHaveLength(14);
    const revised = JSON.parse(
      fs.readFileSync(path.join(revisedRoot, "manifest.json"), "utf8"),
    );
    expect(revised.packageSha256).toBe(revisedPackageSha256);
  });

  it("contains fourteen draft.3 identities linked to immutable draft.2 predecessors", () => {
    const revised = JSON.parse(
      fs.readFileSync(path.join(revisedRoot, "manifest.json"), "utf8"),
    );
    const current = JSON.parse(
      fs.readFileSync(path.join(currentRoot, "manifest.json"), "utf8"),
    );
    const revisedByKey = new Map<string, RevisedEntry>(
      revised.entries.map((entry: RevisedEntry) => [entry.contentKey, entry]),
    );

    expect(current.formatVersion).toBe(3);
    expect(current.packageKey).toBe(
      "reliance-legal-content-drafts-2026-10-13-draft.3",
    );
    expect(current.entries).toHaveLength(14);
    expect(current.predecessorPackage).toEqual({
      packageKey: revised.packageKey,
      packageSha256: revisedPackageSha256,
    });
    expect(current.governanceStatus).toBe("DRAFT");
    expect(current.reviewState).toBe("PRODUCT_OWNER_REVIEW");
    expect(current.runtimeEffective).toBe(false);
    expect(current.counselApproved).toBe(false);

    for (const entry of current.entries as CurrentEntry[]) {
      const predecessor = revisedByKey.get(entry.contentKey);
      expect(predecessor).toBeDefined();
      expect(entry.version).toBe(
        predecessor!.version.replace(
          /-2026-10-12-draft\.2$/,
          "-2026-10-13-draft.3",
        ),
      );
      expect(entry.predecessor).toEqual({
        version: predecessor!.version,
        publishableBodySha256: predecessor!.publishableBodySha256,
        internalActivationNotesSha256:
          predecessor!.internalActivationNotesSha256,
        documentSha256: predecessor!.documentSha256,
      });
    }
  });

  it("changes only the approved support contact in draft.3 publishable copy", () => {
    const draftFiles = fs
      .readdirSync(currentRoot)
      .filter((file) => file.endsWith(".draft.md"));
    expect(draftFiles).toHaveLength(14);

    for (const fileName of draftFiles) {
      const expected = publishableCopy(fileName).replaceAll(
        "colivera080124@gmail.com",
        "Relianceorg.support@gmail.com",
      );
      expect(currentPublishableCopy(fileName)).toBe(expected);
      expect(currentPublishableCopy(fileName)).not.toContain(
        "colivera080124@gmail.com",
      );
    }
    expect(
      currentPublishableCopy("customer-recording-authorization.draft.md"),
    ).not.toMatch(/decide later/i);
    expect(
      fs.readFileSync(path.join(currentRoot, "coverage-map.md"), "utf8"),
    ).toContain("retired Decide Later action has been removed prospectively");
  });

  it("keeps every draft.3 document review-only and non-effective", () => {
    const documents = fs
      .readdirSync(currentRoot)
      .filter((file) => file.endsWith(".draft.md"))
      .map((file) => currentDocument(file));
    expect(documents).toHaveLength(14);
    for (const document of documents) {
      expect(document).toContain("# DRAFT / PRODUCT OWNER REVIEW");
      expect(document).toMatch(/version: .+-2026-10-13-draft\.3/);
      expect(document).toMatch(/supersedes_version: .+-2026-10-12-draft\.2/);
      expect(document).toMatch(/governance_status: DRAFT/);
      expect(document).toMatch(/review_state: PRODUCT_OWNER_REVIEW/);
      expect(document).toMatch(/runtime_effective: false/);
      expect(document).toMatch(/counsel_approved: false/);
    }
  });

  it("contains fourteen new draft.2 identities linked to immutable predecessors", () => {
    const legacy = JSON.parse(
      fs.readFileSync(path.join(legacyRoot, "manifest.json"), "utf8"),
    );
    const revised = JSON.parse(
      fs.readFileSync(path.join(revisedRoot, "manifest.json"), "utf8"),
    );
    const legacyByKey = new Map<string, LegacyEntry>(
      legacy.entries.map((entry: LegacyEntry) => [entry.contentKey, entry]),
    );

    expect(revised.formatVersion).toBe(2);
    expect(revised.entries).toHaveLength(14);
    expect(revised.predecessorPackage.packageSha256).toBe(legacyPackageSha256);
    expect(revised.governanceStatus).toBe("DRAFT");
    expect(revised.reviewState).toBe("PRODUCT_OWNER_REVIEW");
    expect(revised.runtimeEffective).toBe(false);
    expect(revised.counselApproved).toBe(false);
    expect(new Set(revised.entries.map((entry: RevisedEntry) => entry.contentKey)).size).toBe(14);

    for (const entry of revised.entries as RevisedEntry[]) {
      const predecessor = legacyByKey.get(entry.contentKey);
      expect(predecessor).toBeDefined();
      expect(entry.version).toBe(predecessor!.version.replace(/-draft\.1$/, "-draft.2"));
      expect(entry.predecessor).toEqual({
        version: predecessor!.version,
        contentSha256: predecessor!.contentSha256,
        documentSha256: predecessor!.documentSha256,
      });
    }
  });

  it("hashes publishable copy separately from internal activation notes", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(revisedRoot, "manifest.json"), "utf8"),
    );
    for (const entry of manifest.entries as RevisedEntry[]) {
      const document = normalize(fs.readFileSync(path.join(root, entry.file), "utf8"));
      const publishable = boundedSection(document, "PROSPECTIVE USER-FACING COPY");
      const internal = boundedSection(document, "INTERNAL ACTIVATION NOTES");

      expect(sha256(publishable)).toBe(entry.publishableBodySha256);
      expect(sha256(internal)).toBe(entry.internalActivationNotesSha256);
      expect(sha256(document)).toBe(entry.documentSha256);
      expect(publishable).not.toContain("INTERNAL ACTIVATION NOTES");
      expect(publishable).not.toContain("Activation dependencies");
      expect(internal.length).toBeGreaterThan(40);
      expect(entry.publishableBodySha256).not.toBe(entry.internalActivationNotesSha256);
    }
  });

  it("keeps every revised document visibly draft-only and non-effective", () => {
    const documents = fs.readdirSync(revisedRoot)
      .filter((file) => file.endsWith(".draft.md"))
      .map((file) => revisedDocument(file));
    expect(documents).toHaveLength(14);
    for (const document of documents) {
      expect(document).toContain("# DRAFT / PRODUCT OWNER REVIEW");
      expect(document).toMatch(/version: .+-draft\.2/);
      expect(document).toMatch(/supersedes_version: .+-draft\.1/);
      expect(document).toMatch(/governance_status: DRAFT/);
      expect(document).toMatch(/review_state: PRODUCT_OWNER_REVIEW/);
      expect(document).toMatch(/runtime_effective: false/);
      expect(document).toMatch(/counsel_approved: false/);
      expect(document).not.toMatch(/governance_status: (?:EFFECTIVE|COUNSEL_APPROVED)/);
      expect(document).not.toMatch(/runtime_effective: true/);
      expect(document).not.toMatch(/counsel_approved: true/);
    }
  });

  it("implements the Product Owner substantive revision disposition", () => {
    const terms = publishableCopy("terms-of-use.draft.md");
    expect(terms).not.toContain("support and legal-plan contact");
    expect(terms).toContain("Questions about these Terms or Reliance");
    expect(terms).toContain("does not authorize Reliance to sell");
    expect(terms).toContain("unrelated advertising or promotional exploitation");
    expect(terms).toContain("general-purpose model training unrelated");
    expect(terms).toContain("These Terms are governed by Florida law");
    expect(terms).not.toContain("intended to be governed");

    const privacy = publishableCopy("privacy-notice.draft.md");
    expect(privacy).not.toContain("public or licensed sources");
    expect(privacy).not.toContain("Reliance should maintain");
    expect(privacy).toContain("exact lifecycle event that starts each period");

    const standing = publishableCopy("employee-standing-public-participation.draft.md");
    expect(standing).toContain("continued or new Reliance-controlled Public display");
    expect(standing).toContain("hold or remove dependent controlled Public display");

    const visibility = publishableCopy("customer-package-visibility.draft.md");
    expect(visibility).toContain("not publicly visible");
    expect(visibility).toContain("authorized Reliance operational or administrative access");
    expect(visibility).not.toContain("visible only through authorized Private Proof access");

    const withdrawal = publishableCopy("withdrawal-dispute.draft.md");
    expect(withdrawal).toContain("promptly holds or removes that controlled Public display");
    expect(withdrawal).toContain("without keeping the content publicly displayed");

    const retention = publishableCopy("retention-disposition.draft.md");
    expect(retention).toContain("exact lifecycle event that starts each period");
    expect(retention).not.toContain("after the relevant Private Proof lifecycle closes");
    expect(retention).not.toContain("after the relevant relationship or record closes");
    const retentionInternal = boundedSection(
      revisedDocument("retention-disposition.draft.md"),
      "INTERNAL ACTIVATION NOTES",
    );
    expect(retentionInternal).toContain("An irreversible disposition may occur only after");
    expect(retentionInternal).toContain("irreversible deletion is not described as reversible");
  });

  it("keeps Decide Later and the live support mismatch as activation blockers only", () => {
    expect(publishableCopy("customer-recording-authorization.draft.md")).not.toContain(
      "Decide Later",
    );
    const customerInternal = boundedSection(
      revisedDocument("customer-recording-authorization.draft.md"),
      "INTERNAL ACTIVATION NOTES",
    );
    expect(customerInternal).toContain("Decide Later is retired");
    const coverage = fs.readFileSync(path.join(revisedRoot, "coverage-map.md"), "utf8");
    expect(coverage).toContain("current Customer recording runtime still exposes a retired Decide Later action");
    expect(coverage).toContain("differs from the live canonical customer-support configuration");
  });

  it("updates all C-01 through C-24 coverage items", () => {
    const coverage = fs.readFileSync(path.join(revisedRoot, "coverage-map.md"), "utf8");
    for (let index = 1; index <= 24; index += 1) {
      expect(coverage).toContain(`C-${String(index).padStart(2, "0")}`);
    }
  });

  it("is not imported by live application or component modules", () => {
    const runtimeRoots = [path.join(root, "src/app"), path.join(root, "src/components")];
    const runtime = runtimeRoots
      .flatMap(sourceFiles)
      .filter(
        (file) =>
          /\.(?:ts|tsx)$/.test(file) &&
          !file.endsWith(".test.ts") &&
          !file.endsWith(".test.tsx"),
      )
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    expect(runtime).not.toContain("legal-content-drafts");
    expect(runtime).not.toContain("reliance-legal-content-drafts-2026-10-12");
    expect(runtime).not.toContain("reliance-legal-content-drafts-2026-10-12-draft.2");
    expect(runtime).not.toContain("reliance-legal-content-drafts-2026-10-13-draft.3");
  });
});
