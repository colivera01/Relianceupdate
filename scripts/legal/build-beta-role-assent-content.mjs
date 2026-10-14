import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceDirectory = path.join(
  root,
  "docs",
  "legal-content-drafts",
  "2026-10-13-draft.3",
);
const manifestPath = path.join(sourceDirectory, "manifest.json");
const outputPath = path.join(
  root,
  "src",
  "config",
  "beta-role-assent-content.generated.json",
);
const sourceFiles = [
  "terms-of-use.draft.md",
  "privacy-notice.draft.md",
  "vendor-assent.draft.md",
  "employee-accountless-assent.draft.md",
];

function normalize(value) {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function parseSource(fileName) {
  const document = normalize(
    fs.readFileSync(path.join(sourceDirectory, fileName), "utf8"),
  );
  const match = document.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${fileName}: malformed front matter`);
  const metadata = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`${fileName}: malformed metadata`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  const begin = "<!-- BEGIN PROSPECTIVE USER-FACING COPY -->\n";
  const end = "\n<!-- END PROSPECTIVE USER-FACING COPY -->";
  const start = match[2].indexOf(begin);
  const finish = match[2].indexOf(end, start + begin.length);
  if (start < 0 || finish < 0) {
    throw new Error(`${fileName}: publishable copy markers missing`);
  }
  const contentSnapshot = `${match[2].slice(start + begin.length, finish)}\n`;
  return {
    sourceFile: `docs/legal-content-drafts/2026-10-13-draft.3/${fileName}`,
    contentKey: metadata.content_key,
    contentClass: metadata.content_class,
    audienceRole: metadata.audience_role,
    version: metadata.version,
    sourceGovernanceStatus: metadata.governance_status,
    sourceRuntimeEffective: metadata.runtime_effective === "true",
    sourceCounselApproved: metadata.counsel_approved === "true",
    contentSnapshot,
    contentHash: sha256(contentSnapshot),
  };
}

const manifest = JSON.parse(normalize(fs.readFileSync(manifestPath, "utf8")));
if (
  manifest.packageKey !== "reliance-legal-content-drafts-2026-10-13-draft.3" ||
  manifest.packageSha256 !==
    "581d51137b2e592700612485604613702244211ca941d4e81bfcdbd2b4f4fb80" ||
  manifest.runtimeEffective !== false ||
  manifest.counselApproved !== false
) {
  throw new Error("The approved draft.3 package identity changed");
}

const entries = sourceFiles.map(parseSource);
for (const entry of entries) {
  const expected = manifest.entries.find(
    (candidate) => candidate.contentKey === entry.contentKey,
  );
  if (!expected || expected.version !== entry.version) {
    throw new Error(`${entry.contentKey}: version is not in the approved manifest`);
  }
  if (expected.publishableBodySha256 !== entry.contentHash) {
    throw new Error(`${entry.contentKey}: publishable text hash changed`);
  }
  if (
    entry.contentClass !== "POLICY" ||
    entry.sourceGovernanceStatus !== "DRAFT" ||
    entry.sourceRuntimeEffective ||
    entry.sourceCounselApproved
  ) {
    throw new Error(`${entry.contentKey}: source governance boundary changed`);
  }
}

const output = {
  formatVersion: 1,
  packageKey: manifest.packageKey,
  packageSha256: manifest.packageSha256,
  authorizationScope: "BETA_ROLE_ASSENT_SURFACES_ONLY",
  globallyEffective: false,
  counselApproved: false,
  generatedFromCommit: "a9446e05cf30cdc5bc1d9951bf88f60e9a6b4095",
  entries,
};
const serialized = `${JSON.stringify(output, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing = normalize(fs.readFileSync(outputPath, "utf8"));
  if (existing !== serialized) {
    throw new Error("Generated beta role-assent content is stale");
  }
  console.log("Beta role-assent content matches the approved draft.3 package.");
} else {
  fs.writeFileSync(outputPath, serialized, "utf8");
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}
