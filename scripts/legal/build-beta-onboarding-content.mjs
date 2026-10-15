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
const sourceManifestPath = path.join(sourceDirectory, "manifest.json");
const contentOutputPath = path.join(
  root,
  "src",
  "config",
  "beta-onboarding-legal-content.generated.json",
);
const metadataOutputPath = path.join(
  root,
  "src",
  "config",
  "beta-onboarding-legal-metadata.generated.json",
);

const PACKAGE_KEY = "reliance-beta-onboarding-legal-2026-10-14.1";
const AUTHORIZATION_REFERENCE = "github-issue-1-comment-6180609703";
const PREDECESSOR_PACKAGE_KEY = "reliance-legal-content-drafts-2026-10-13-draft.3";
const PREDECESSOR_PACKAGE_SHA256 =
  "581d51137b2e592700612485604613702244211ca941d4e81bfcdbd2b4f4fb80";

const sourceDefinitions = [
  {
    documentId: "terms",
    fileName: "terms-of-use.draft.md",
    version: "reliance-terms-2026-10-14-onboarding.1",
  },
  {
    documentId: "privacy",
    fileName: "privacy-notice.draft.md",
    version: "reliance-privacy-2026-10-14-onboarding.1",
  },
  {
    documentId: "sms",
    fileName: "transactional-sms.draft.md",
    version: "reliance-transactional-sms-2026-10-14-onboarding.1",
  },
  {
    documentId: "vendor-organization",
    fileName: "vendor-assent.draft.md",
    version: "reliance-vendor-organization-agreement-2026-10-14-onboarding.1",
  },
  {
    documentId: "employee-service-order",
    fileName: "employee-accountless-assent.draft.md",
    version: "reliance-employee-accountless-assent-2026-10-14-onboarding.1",
  },
  {
    documentId: "manager-work-record-attestation",
    fileName: "vendor-assent.draft.md",
    version: "reliance-manager-work-record-attestation-2026-10-14-onboarding.1",
    contentKey: "reliance.manager-work-record-attestation",
    audienceRole: "VENDOR",
  },
];

const vendorAcknowledgements = Object.freeze([
  {
    key: "authority",
    label: "I am authorized to act for and bind the identified Vendor organization.",
  },
  {
    key: "terms",
    label: "I agree to the exact Reliance Terms of Use version shown.",
  },
  {
    key: "privacy",
    label: "I acknowledge that I reviewed the exact Reliance Privacy Notice version shown.",
  },
  {
    key: "electronicRecords",
    label:
      "I consent to receive and retain these terms, notices, receipts, and related records electronically.",
  },
]);

function normalize(value) {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJson(item)]),
    );
  }
  return value;
}

function parseSource(definition) {
  const document = normalize(
    fs.readFileSync(path.join(sourceDirectory, definition.fileName), "utf8"),
  );
  const match = document.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${definition.fileName}: malformed front matter`);
  const metadata = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`${definition.fileName}: malformed metadata`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  const begin = "<!-- BEGIN PROSPECTIVE USER-FACING COPY -->\n";
  const end = "\n<!-- END PROSPECTIVE USER-FACING COPY -->";
  const start = match[2].indexOf(begin);
  const finish = match[2].indexOf(end, start + begin.length);
  if (start < 0 || finish < 0) {
    throw new Error(`${definition.fileName}: publishable copy markers missing`);
  }
  return {
    definition,
    metadata,
    sourceSnapshot: `${match[2].slice(start + begin.length, finish)}\n`,
  };
}

function vendorOrganizationSnapshot(sourceSnapshot) {
  const oldAcknowledgements = [
    "**Terms checkbox:** I am authorized to bind the identified Vendor and agree to the exact Reliance Terms of Use version shown.",
    "",
    "**Privacy checkbox:** I acknowledge that I reviewed the exact Reliance Privacy Notice version shown and understand the described processing for the Vendor relationship.",
    "",
    "**Electronic-record checkbox:** I consent to receive these Vendor terms, notices, receipts, and related records electronically and can access and retain the versions shown.",
  ].join("\n");
  const newAcknowledgements = vendorAcknowledgements
    .map((item) => `**${item.key}:** ${item.label}`)
    .join("\n\n");
  let result = sourceSnapshot.replace(
    "# Vendor and Vendor Manager Assent\n",
    "# Vendor Organization Agreement\n",
  );
  if (!result.includes(oldAcknowledgements)) {
    throw new Error("Vendor draft acknowledgement block changed unexpectedly");
  }
  result = result.replace(oldAcknowledgements, newAcknowledgements);

  const attestationStart = "\n## Job-specific Manager attestation\n";
  const declineStart = "\n## Decline\n";
  const start = result.indexOf(attestationStart);
  const finish = result.indexOf(declineStart, start + attestationStart.length);
  if (start < 0 || finish < 0) {
    throw new Error("Vendor draft Manager attestation boundary changed unexpectedly");
  }
  result = `${result.slice(0, start)}${result.slice(finish)}`;
  return result;
}

function managerWorkRecordAttestation(sourceSnapshot) {
  const match = sourceSnapshot.match(
    /## Job-specific Manager attestation\n\n\*\*Attestation:\*\* ([\s\S]*?)\n\n\*\*Button:\*\* Confirm Work Record Attestation\n\n([\s\S]*?)\n\n## Decline/,
  );
  if (!match) {
    throw new Error("Vendor draft Manager attestation text changed unexpectedly");
  }
  const presentation = {
    title: "Manager Work Record attestation required before Service Order release",
    attestationText: match[1].trim(),
    confirmationText:
      "I confirm this exact current Work Record, assignment, and recording context for the identified Vendor.",
    disclaimerText: match[2].trim(),
    actionLabel: "Confirm Work Record Attestation",
  };
  return {
    presentation,
    contentSnapshot: [
      "# Manager Work Record Attestation",
      "",
      presentation.attestationText,
      "",
      `**Confirmation:** ${presentation.confirmationText}`,
      "",
      presentation.disclaimerText,
      "",
      `**Button:** ${presentation.actionLabel}`,
      "",
    ].join("\n"),
  };
}

const sourceManifest = JSON.parse(
  normalize(fs.readFileSync(sourceManifestPath, "utf8")),
);
if (
  sourceManifest.packageKey !== PREDECESSOR_PACKAGE_KEY ||
  sourceManifest.packageSha256 !== PREDECESSOR_PACKAGE_SHA256 ||
  sourceManifest.runtimeEffective !== false ||
  sourceManifest.counselApproved !== false
) {
  throw new Error("The approved draft.3 package identity changed");
}

const entries = sourceDefinitions.map((definition) => {
  const parsed = parseSource(definition);
  const expected = sourceManifest.entries.find(
    (candidate) => candidate.contentKey === parsed.metadata.content_key,
  );
  if (
    !expected ||
    expected.version !== parsed.metadata.version ||
    expected.publishableBodySha256 !== sha256(parsed.sourceSnapshot)
  ) {
    throw new Error(`${definition.fileName}: draft.3 source identity changed`);
  }
  if (
    parsed.metadata.content_class !== "POLICY" ||
    parsed.metadata.governance_status !== "DRAFT" ||
    parsed.metadata.runtime_effective !== "false" ||
    parsed.metadata.counsel_approved !== "false"
  ) {
    throw new Error(`${definition.fileName}: source governance boundary changed`);
  }
  const managerAttestation =
    definition.documentId === "manager-work-record-attestation"
      ? managerWorkRecordAttestation(parsed.sourceSnapshot)
      : null;
  const contentSnapshot = managerAttestation
    ? managerAttestation.contentSnapshot
    : definition.documentId === "vendor-organization"
      ? vendorOrganizationSnapshot(parsed.sourceSnapshot)
      : parsed.sourceSnapshot;
  return {
    documentId: definition.documentId,
    sourceFile: `docs/legal-content-drafts/2026-10-13-draft.3/${definition.fileName}`,
    predecessorVersion: parsed.metadata.version,
    predecessorContentHash: sha256(parsed.sourceSnapshot),
    contentKey: definition.contentKey || parsed.metadata.content_key,
    contentClass: "POLICY",
    audienceRole: definition.audienceRole || parsed.metadata.audience_role,
    version: definition.version,
    governanceStatus: "PRODUCT_OWNER_APPROVED",
    globallyEffective: false,
    counselApproved: false,
    authorizationReference: AUTHORIZATION_REFERENCE,
    contentSnapshot,
    contentHash: sha256(contentSnapshot),
    ...(managerAttestation ? { presentation: managerAttestation.presentation } : {}),
  };
});

function contentSetHash(documentIds) {
  return sha256(
    JSON.stringify(
      canonicalJson(
        entries
          .filter((entry) => documentIds.includes(entry.documentId))
          .map(({ contentKey, version, contentHash }) => ({
            contentKey,
            version,
            contentHash,
          })),
      ),
    ),
  );
}

const packageFingerprint = entries.map(
  ({ documentId, contentKey, version, contentHash, predecessorVersion, predecessorContentHash }) => ({
    documentId,
    contentKey,
    version,
    contentHash,
    predecessorVersion,
    predecessorContentHash,
  }),
);
const packageSha256 = sha256(JSON.stringify(canonicalJson(packageFingerprint)));
const contentSets = {
  customer: {
    documentIds: ["terms", "privacy", "sms"],
    contentSetHash: contentSetHash(["terms", "privacy", "sms"]),
  },
  vendor: {
    documentIds: ["terms", "privacy", "vendor-organization"],
    contentSetHash: contentSetHash(["terms", "privacy", "vendor-organization"]),
  },
  employee: {
    documentIds: ["terms", "privacy", "employee-service-order"],
    contentSetHash: contentSetHash(["terms", "privacy", "employee-service-order"]),
  },
};

const contentOutput = {
  formatVersion: 1,
  packageKey: PACKAGE_KEY,
  packageSha256,
  predecessorPackage: {
    packageKey: PREDECESSOR_PACKAGE_KEY,
    packageSha256: PREDECESSOR_PACKAGE_SHA256,
  },
  authorizationReference: AUTHORIZATION_REFERENCE,
  authorizationScope: "BETA_REGISTRATION_AND_ROLE_ASSENT_ONLY",
  globallyEffective: false,
  counselApproved: false,
  canonicalSupportEmail: "Relianceorg.support@gmail.com",
  vendorAcknowledgements,
  contentSets,
  entries,
};

const metadataOutput = {
  formatVersion: contentOutput.formatVersion,
  packageKey: contentOutput.packageKey,
  packageSha256: contentOutput.packageSha256,
  authorizationScope: contentOutput.authorizationScope,
  globallyEffective: false,
  counselApproved: false,
  canonicalSupportEmail: contentOutput.canonicalSupportEmail,
  vendorAcknowledgements,
  contentSets,
  entries: entries.map(
    ({ documentId, contentKey, audienceRole, version, contentHash, presentation }) => ({
      documentId,
      contentKey,
      audienceRole,
      version,
      contentHash,
      viewerHref: `/legal/onboarding/${documentId}`,
      downloadHref: `/api/legal/onboarding/${documentId}?download=1`,
      ...(presentation ? { presentation } : {}),
    }),
  ),
};

function writeOrCheck(outputPath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const existing = normalize(fs.readFileSync(outputPath, "utf8"));
    if (existing !== serialized) {
      throw new Error(`${path.relative(root, outputPath)} is stale`);
    }
  } else {
    fs.writeFileSync(outputPath, serialized, "utf8");
  }
}

writeOrCheck(contentOutputPath, contentOutput);
writeOrCheck(metadataOutputPath, metadataOutput);

console.log(
  process.argv.includes("--check")
    ? `Beta onboarding package ${PACKAGE_KEY} (${packageSha256}) is current.`
    : `Wrote beta onboarding package ${PACKAGE_KEY} (${packageSha256}).`,
);
