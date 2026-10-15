import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(
  root,
  "src",
  "config",
  "beta-onboarding-legal-content.generated.json",
);
const outputPath = path.join(
  root,
  "src",
  "config",
  "beta-role-assent-content.generated.json",
);
const roleDocumentIds = new Set([
  "terms",
  "privacy",
  "vendor-organization",
  "employee-service-order",
  "manager-work-record-attestation",
]);

function normalize(value) {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

const source = JSON.parse(normalize(fs.readFileSync(sourcePath, "utf8")));
if (
  source.packageKey !== "reliance-beta-onboarding-legal-2026-10-14.1" ||
  source.authorizationReference !== "github-issue-1-comment-6180609703" ||
  source.globallyEffective !== false ||
  source.counselApproved !== false
) {
  throw new Error("The approved beta onboarding package identity changed");
}

const entries = source.entries
  .filter((entry) => roleDocumentIds.has(entry.documentId))
  .map((entry) => ({
    sourceFile: entry.sourceFile,
    contentKey: entry.contentKey,
    contentClass: entry.contentClass,
    audienceRole: entry.audienceRole,
    version: entry.version,
    sourceGovernanceStatus: "DRAFT",
    sourceRuntimeEffective: false,
    sourceCounselApproved: false,
    contentSnapshot: entry.contentSnapshot,
    contentHash: entry.contentHash,
    ...(entry.presentation ? { presentation: entry.presentation } : {}),
  }));
for (const entry of entries) {
  if (entry.contentClass !== "POLICY" || sha256(entry.contentSnapshot) !== entry.contentHash) {
    throw new Error(`${entry.contentKey}: onboarding content integrity changed`);
  }
}

const output = {
  formatVersion: 1,
  packageKey: source.packageKey,
  packageSha256: source.packageSha256,
  authorizationScope: "BETA_ROLE_ASSENT_SURFACES_ONLY",
  globallyEffective: false,
  counselApproved: false,
  generatedFromCommit: source.authorizationReference,
  entries,
};
const serialized = `${JSON.stringify(output, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing = normalize(fs.readFileSync(outputPath, "utf8"));
  if (existing !== serialized) {
    throw new Error("Generated beta role-assent content is stale");
  }
  console.log("Beta role-assent content matches the approved onboarding package.");
} else {
  fs.writeFileSync(outputPath, serialized, "utf8");
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}
