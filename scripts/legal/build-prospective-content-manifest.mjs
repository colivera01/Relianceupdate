import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const draftDirectory = path.join(root, "docs", "legal-content-drafts", "2026-10-12");
const manifestPath = path.join(draftDirectory, "manifest.json");
const draftFiles = [
  "terms-of-use.draft.md",
  "privacy-notice.draft.md",
  "vendor-assent.draft.md",
  "employee-accountless-assent.draft.md",
  "customer-recording-authorization.draft.md",
  "employee-recording-participation.draft.md",
  "employee-standing-public-participation.draft.md",
  "customer-package-visibility.draft.md",
  "withdrawal-dispute.draft.md",
  "privacy-request-intake.draft.md",
  "transactional-sms.draft.md",
  "ai-disclosure-governance.draft.md",
  "retention-disposition.draft.md",
  "accessibility-statement.draft.md",
];

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function parseDraft(fileName) {
  const absolutePath = path.join(draftDirectory, fileName);
  const document = normalizeText(fs.readFileSync(absolutePath, "utf8"));
  const match = document.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${fileName}: front matter is missing or malformed`);

  const metadata = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`${fileName}: malformed metadata line: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  const required = [
    "content_key",
    "content_class",
    "audience_role",
    "version",
    "governance_status",
    "review_state",
    "runtime_effective",
    "counsel_approved",
    "language",
  ];
  for (const key of required) {
    if (!metadata[key]) throw new Error(`${fileName}: required metadata ${key} is missing`);
  }
  if (metadata.governance_status !== "DRAFT") {
    throw new Error(`${fileName}: only DRAFT governance status is permitted`);
  }
  if (metadata.review_state !== "PRODUCT_OWNER_REVIEW") {
    throw new Error(`${fileName}: review state must be PRODUCT_OWNER_REVIEW`);
  }
  if (metadata.runtime_effective !== "false" || metadata.counsel_approved !== "false") {
    throw new Error(`${fileName}: draft cannot be runtime effective or counsel approved`);
  }
  if (!match[2].startsWith("# DRAFT / PRODUCT OWNER REVIEW")) {
    throw new Error(`${fileName}: visible draft banner is missing`);
  }

  const contentSnapshot = match[2].endsWith("\n") ? match[2] : `${match[2]}\n`;
  return {
    file: `docs/legal-content-drafts/2026-10-12/${fileName}`,
    contentKey: metadata.content_key,
    contentClass: metadata.content_class,
    audienceRole: metadata.audience_role,
    version: metadata.version,
    governanceStatus: metadata.governance_status,
    reviewState: metadata.review_state,
    runtimeEffective: false,
    counselApproved: false,
    language: metadata.language,
    contentSha256: sha256(contentSnapshot),
    documentSha256: sha256(document),
    contentBytes: Buffer.byteLength(contentSnapshot, "utf8"),
    documentBytes: Buffer.byteLength(document, "utf8"),
  };
}

const entries = draftFiles.map(parseDraft).sort((left, right) =>
  left.contentKey.localeCompare(right.contentKey),
);
if (new Set(entries.map((entry) => entry.contentKey)).size !== entries.length) {
  throw new Error("Draft content keys must be unique");
}
if (new Set(entries.map((entry) => entry.version)).size !== entries.length) {
  throw new Error("Draft content versions must be unique");
}

const packageFingerprint = entries.map(({ contentKey, version, contentSha256 }) => ({
  contentKey,
  version,
  contentSha256,
}));
const manifest = {
  formatVersion: 1,
  packageKey: "reliance-legal-content-drafts-2026-10-12",
  governanceStatus: "DRAFT",
  reviewState: "PRODUCT_OWNER_REVIEW",
  runtimeEffective: false,
  counselApproved: false,
  normalization: "UTF-8 text with LF line endings; content hash covers the exact body after front matter",
  packageSha256: sha256(JSON.stringify(packageFingerprint)),
  entries,
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing = normalizeText(fs.readFileSync(manifestPath, "utf8"));
  if (existing !== serialized) {
    throw new Error("Draft manifest is stale; run npm run legal:drafts:manifest");
  }
  console.log(`Verified ${entries.length} draft snapshots (${manifest.packageSha256})`);
} else {
  fs.writeFileSync(manifestPath, serialized, "utf8");
  console.log(`Wrote ${entries.length} draft snapshots (${manifest.packageSha256})`);
}
