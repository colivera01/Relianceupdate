import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const draftsRoot = path.join(root, "docs", "legal-content-drafts");
const legacyDirectory = path.join(draftsRoot, "2026-10-12");
const revisedDirectory = path.join(draftsRoot, "2026-10-12-draft.2");
const legacyManifestPath = path.join(legacyDirectory, "manifest.json");
const revisedManifestPath = path.join(revisedDirectory, "manifest.json");
const legacyPackageSha256 = "63bb7c9523e4690e85843d542b92cd6d78d8ad70714c5b0e13be2df573f5f83b";
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

const requiredMetadata = [
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

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function readDraft(directory, fileName) {
  const document = normalizeText(fs.readFileSync(path.join(directory, fileName), "utf8"));
  const match = document.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${fileName}: front matter is missing or malformed`);

  const metadata = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`${fileName}: malformed metadata line: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  for (const key of requiredMetadata) {
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
  return { document, metadata, body: match[2] };
}

function parseLegacyDraft(fileName) {
  const { document, metadata, body } = readDraft(legacyDirectory, fileName);
  const contentSnapshot = body.endsWith("\n") ? body : `${body}\n`;
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

function legacyManifestFromSource() {
  const entries = draftFiles.map(parseLegacyDraft).sort((left, right) =>
    left.contentKey.localeCompare(right.contentKey),
  );
  const packageFingerprint = entries.map(({ contentKey, version, contentSha256 }) => ({
    contentKey,
    version,
    contentSha256,
  }));
  return {
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
}

function verifyLegacyPackage() {
  const computed = legacyManifestFromSource();
  const serialized = `${JSON.stringify(computed, null, 2)}\n`;
  const existing = normalizeText(fs.readFileSync(legacyManifestPath, "utf8"));
  if (existing !== serialized) {
    throw new Error("Revision 1 draft package changed; restore its original files and manifest");
  }
  if (computed.packageSha256 !== legacyPackageSha256) {
    throw new Error("Revision 1 package identity does not match its preserved SHA-256");
  }
  return computed;
}

function extractBoundedSection(fileName, body, sectionName) {
  const heading = `## ${sectionName}`;
  const begin = `<!-- BEGIN ${sectionName} -->\n`;
  const end = `\n<!-- END ${sectionName} -->`;
  if (!body.includes(heading)) throw new Error(`${fileName}: missing ${heading}`);
  const start = body.indexOf(begin);
  const finish = body.indexOf(end, start + begin.length);
  if (
    start < 0 ||
    finish < 0 ||
    body.indexOf(begin, start + begin.length) >= 0 ||
    body.indexOf(end, finish + end.length) >= 0
  ) {
    throw new Error(`${fileName}: expected exactly one bounded ${sectionName} section`);
  }
  return `${body.slice(start + begin.length, finish)}\n`;
}

function parseRevisedDraft(fileName, legacyByContentKey) {
  const { document, metadata, body } = readDraft(revisedDirectory, fileName);
  if (!metadata.supersedes_version) {
    throw new Error(`${fileName}: supersedes_version is required`);
  }
  if (!metadata.version.endsWith("-draft.2")) {
    throw new Error(`${fileName}: revision 2 version must end with -draft.2`);
  }

  const predecessor = legacyByContentKey.get(metadata.content_key);
  if (!predecessor) throw new Error(`${fileName}: no revision 1 predecessor found`);
  if (metadata.supersedes_version !== predecessor.version) {
    throw new Error(`${fileName}: supersedes_version does not match revision 1`);
  }
  if (metadata.version !== predecessor.version.replace(/-draft\.1$/, "-draft.2")) {
    throw new Error(`${fileName}: revision 2 version does not advance its predecessor`);
  }

  const publishableBody = extractBoundedSection(
    fileName,
    body,
    "PROSPECTIVE USER-FACING COPY",
  );
  const internalActivationNotes = extractBoundedSection(
    fileName,
    body,
    "INTERNAL ACTIVATION NOTES",
  );

  return {
    file: `docs/legal-content-drafts/2026-10-12-draft.2/${fileName}`,
    contentKey: metadata.content_key,
    contentClass: metadata.content_class,
    audienceRole: metadata.audience_role,
    version: metadata.version,
    governanceStatus: metadata.governance_status,
    reviewState: metadata.review_state,
    runtimeEffective: false,
    counselApproved: false,
    language: metadata.language,
    predecessor: {
      version: predecessor.version,
      contentSha256: predecessor.contentSha256,
      documentSha256: predecessor.documentSha256,
    },
    publishableBodySha256: sha256(publishableBody),
    internalActivationNotesSha256: sha256(internalActivationNotes),
    documentSha256: sha256(document),
    publishableBodyBytes: Buffer.byteLength(publishableBody, "utf8"),
    internalActivationNotesBytes: Buffer.byteLength(internalActivationNotes, "utf8"),
    documentBytes: Buffer.byteLength(document, "utf8"),
  };
}

function revisedManifestFromSource(legacyManifest) {
  const legacyByContentKey = new Map(
    legacyManifest.entries.map((entry) => [entry.contentKey, entry]),
  );
  const entries = draftFiles
    .map((fileName) => parseRevisedDraft(fileName, legacyByContentKey))
    .sort((left, right) => left.contentKey.localeCompare(right.contentKey));

  if (new Set(entries.map((entry) => entry.contentKey)).size !== entries.length) {
    throw new Error("Revision 2 content keys must be unique");
  }
  if (new Set(entries.map((entry) => entry.version)).size !== entries.length) {
    throw new Error("Revision 2 versions must be unique");
  }

  const packageFingerprint = entries.map(
    ({
      contentKey,
      version,
      publishableBodySha256,
      internalActivationNotesSha256,
      documentSha256,
    }) => ({
      contentKey,
      version,
      publishableBodySha256,
      internalActivationNotesSha256,
      documentSha256,
    }),
  );
  return {
    formatVersion: 2,
    packageKey: "reliance-legal-content-drafts-2026-10-12-draft.2",
    predecessorPackage: {
      packageKey: legacyManifest.packageKey,
      packageSha256: legacyManifest.packageSha256,
    },
    governanceStatus: "DRAFT",
    reviewState: "PRODUCT_OWNER_REVIEW",
    runtimeEffective: false,
    counselApproved: false,
    normalization: "UTF-8 text with LF line endings",
    hashBoundaries: {
      publishableBody: "Exact text between PROSPECTIVE USER-FACING COPY markers; excludes markers, draft banner, metadata, and internal notes",
      internalActivationNotes: "Exact text between INTERNAL ACTIVATION NOTES markers; excluded from future accepted legal text",
      document: "Complete normalized Markdown document including front matter and both marked sections",
    },
    packageSha256: sha256(JSON.stringify(packageFingerprint)),
    entries,
  };
}

const legacyManifest = verifyLegacyPackage();
const revisedManifest = revisedManifestFromSource(legacyManifest);
const serialized = `${JSON.stringify(revisedManifest, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing = normalizeText(fs.readFileSync(revisedManifestPath, "utf8"));
  if (existing !== serialized) {
    throw new Error("Revision 2 draft manifest is stale; run npm run legal:drafts:manifest");
  }
  console.log(
    `Verified revision 1 ${legacyManifest.entries.length} drafts (${legacyManifest.packageSha256}) and revision 2 ${revisedManifest.entries.length} drafts (${revisedManifest.packageSha256})`,
  );
} else {
  fs.writeFileSync(revisedManifestPath, serialized, "utf8");
  console.log(
    `Preserved revision 1 (${legacyManifest.packageSha256}); wrote revision 2 ${revisedManifest.entries.length} draft snapshots (${revisedManifest.packageSha256})`,
  );
}
