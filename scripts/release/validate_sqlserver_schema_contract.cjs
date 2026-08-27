#!/usr/bin/env node

const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const HISTORICAL_EXCEPTION = Object.freeze({
  migrationName: "20260707012500_add_vendor_invite_recipient_fields",
  appliedChecksum: "b69471cc0bd357e81cc419cb5119bfb0cbfe6c8fb842f4ca00bf494bbe1a4f6b",
  appliedAt: "2026-07-07T06:10:35.629Z",
  firstCommittedAt: "2026-07-08T12:05:50.000Z",
  currentRawChecksum: "c8eb76acae5006ed92ba6814199e4537762161ef78a9edc1f81a04a7d648e155",
  provenanceDocument:
    "Project Management/Pre-Epic8 Release Validation/RV8_VENDOR_INVITE_MIGRATION_PROVENANCE_EXCEPTION.md",
});

const column = (table, name, type, maxLength, nullable, defaultValue = null) => ({
  table,
  name,
  type,
  maxLength,
  nullable,
  defaultValue,
});

const CONTRACT = Object.freeze({
  columns: [
    column("bookings", "creationRequestKey", "nvarchar", 255, true),
    column("vendor_invites", "inviteeName", "nvarchar", 1000, true),
    column("vendor_invites", "inviteeEmail", "nvarchar", 1000, true),
    column("vendor_invites", "inviteePhone", "nvarchar", 1000, true),
    column("vendor_invites", "inviteeRole", "nvarchar", 1000, true),
    column("recording_gate_decision_evidence", "audioExpected", "bit", 1, false, false),
    column("recording_gate_decision_evidence", "audioContractVersion", "int", 4, false, 1),
    column("media_upload_attempts", "audioExpected", "bit", 1, false, false),
    column("media_upload_attempts", "audioPresence", "nvarchar", 1000, false, "LEGACY_UNKNOWN"),
    column("media_upload_attempts", "audioEvidenceVersion", "int", 4, false, 1),
    column("media_assets", "audioExpected", "bit", 1, false, false),
    column("media_assets", "audioPresence", "nvarchar", 1000, false, "LEGACY_UNKNOWN"),
    column("media_assets", "audioTrackCount", "int", 4, true),
    column("media_assets", "audioCodec", "nvarchar", 1000, true),
    column("media_assets", "audioDetectionMethod", "nvarchar", 1000, true),
    column("media_assets", "audioEvidenceVersion", "int", 4, false, 1),
    column("media_assets", "audioDetectedAt", "datetime2", 8, true),
    column("media_sessions", "audioExpected", "bit", 1, false, false),
    column("media_sessions", "audioContractVersion", "int", 4, false, 1),
    column("service_video_stage_evidence", "audioExpected", "bit", 1, false, false),
    column("service_video_stage_evidence", "audioPresence", "nvarchar", 1000, false, "LEGACY_UNKNOWN"),
    column("service_video_stage_evidence", "audioEvidenceVersion", "int", 4, false, 1),
    column("service_video_package_evidence", "audioExpected", "bit", 1, false, false),
    column("service_video_package_evidence", "audioConformance", "nvarchar", 1000, false, "LEGACY_VIDEO_ONLY"),
    column("service_video_package_evidence", "audioEvidenceVersion", "int", 4, false, 1),
  ],
  filteredUniqueIndexes: [
    { table: "bookings", columns: ["creationRequestKey"] },
    { table: "consent_records", columns: ["token"] },
    { table: "users", columns: ["phone"] },
  ],
  indexes: [
    { table: "media_assets", columns: ["audioPresence"], unique: false, included: [] },
    {
      table: "service_video_stage_evidence",
      columns: ["bookingId", "audioPresence"],
      unique: false,
      included: [],
    },
  ],
  foreignKeys: [
    ["booking_notification_attempts", "notificationId", "booking_notifications", "id", "CASCADE", "NO_ACTION"],
    ["booking_notifications", "bookingId", "bookings", "id", "CASCADE", "NO_ACTION"],
    ["consent_decision_sessions", "consentRecordId", "consent_records", "id", "CASCADE", "NO_ACTION"],
    ["consent_request_links", "consentRecordId", "consent_records", "id", "CASCADE", "NO_ACTION"],
    ["consent_verification_challenges", "consentRecordId", "consent_records", "id", "CASCADE", "NO_ACTION"],
    ["employee_recording_certifications", "bookingId", "bookings", "id", "CASCADE", "NO_ACTION"],
    ["recording_authority_requirements", "assessmentId", "recording_scope_assessments", "id", "CASCADE", "NO_ACTION"],
    ["recording_gate_metrics", "bookingId", "bookings", "id", "CASCADE", "NO_ACTION"],
    ["recording_location_attempts", "bookingId", "bookings", "id", "CASCADE", "NO_ACTION"],
    ["recording_location_exceptions", "bookingId", "bookings", "id", "CASCADE", "NO_ACTION"],
    ["recording_scope_assessments", "bookingId", "bookings", "id", "CASCADE", "NO_ACTION"],
    ["consent_records", "mediaSessionId", "media_sessions", "id", "SET_NULL", "NO_ACTION"],
  ].map(([table, columnName, referencedTable, referencedColumn, deleteAction, updateAction]) => ({
    table,
    column: columnName,
    referencedTable,
    referencedColumn,
    deleteAction,
    updateAction,
  })),
});

function stripOuterParentheses(value) {
  let normalized = String(value ?? "").trim();
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function normalizeDefault(value) {
  if (value === null || value === undefined) return null;
  let normalized = stripOuterParentheses(value);
  if (/^N?'.*'$/is.test(normalized)) {
    normalized = normalized.replace(/^N'/i, "'");
    return normalized.slice(1, -1).replace(/''/g, "'");
  }
  if (/^(0|false)$/i.test(normalized)) return false;
  if (/^(1|true)$/i.test(normalized)) return 1;
  if (/^-?\d+$/.test(normalized)) return Number(normalized);
  return normalized.toUpperCase().replace(/\s+/g, " ");
}

function normalizeFilter(value) {
  return String(value ?? "")
    .replace(/[\[\]]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function indexColumns(index, included = false) {
  return index.columns
    .filter((entry) => Boolean(entry.included) === included)
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
    .map((entry) => entry.name);
}

function findIndex(snapshot, expected) {
  return snapshot.indexes.find(
    (index) =>
      index.table === expected.table &&
      Boolean(index.unique) === Boolean(expected.unique) &&
      JSON.stringify(indexColumns(index)) === JSON.stringify(expected.columns) &&
      JSON.stringify(indexColumns(index, true)) === JSON.stringify(expected.included ?? []),
  );
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function migrationChecksums(buffer) {
  const text = buffer.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return new Set([
    sha256(buffer),
    sha256(Buffer.from(text, "utf8")),
    sha256(Buffer.from(text.replace(/\n/g, "\r\n"), "utf8")),
  ]);
}

function validateRawPrismaDiff(rawDiff, snapshot) {
  const errors = [];
  const blocks = [...rawDiff.matchAll(/-- (\w+)\s*\r?\n([\s\S]*?)(?=\r?\n-- \w+\s*\r?\n|\r?\nCOMMIT TRAN;)/g)].map(
    (match) => ({ kind: match[1], sql: match[2].trim() }),
  );
  const allowedUniqueAdds = new Set([
    "consent_records.token",
    "users.phone",
  ]);
  let equivalentDefaults = 0;
  let nameOnlyIndexes = 0;
  let filteredUniqueLimitations = 0;

  for (const block of blocks) {
    if (block.kind === "AlterTable") {
      const tableMatch = block.sql.match(/ALTER TABLE \[dbo\]\.\[([^\]]+)\]/);
      const table = tableMatch?.[1];
      const additions = [...block.sql.matchAll(/CONSTRAINT \[[^\]]+\] DEFAULT (.+?) FOR \[([^\]]+)\](?=,|;)/g)];
      const dropClause = block.sql.match(/DROP CONSTRAINT ([\s\S]+?);/);
      const droppedConstraintCount = dropClause
        ? [...dropClause[1].matchAll(/\[[^\]]+\]/g)].length
        : 0;
      if (!table || additions.length === 0 || droppedConstraintCount !== additions.length) {
        errors.push("Raw Prisma diff contains a non-default ALTER TABLE operation");
        continue;
      }
      for (const addition of additions) {
        const actual = snapshot.columns.find(
          (candidate) => candidate.table === table && candidate.name === addition[2],
        );
        if (!actual || normalizeDefault(actual.defaultDefinition) !== normalizeDefault(addition[1])) {
          errors.push(`Raw Prisma diff contains a semantic default change for ${table}.${addition[2]}`);
        } else {
          equivalentDefaults += 1;
        }
      }
      continue;
    }
    if (block.kind === "CreateIndex") {
      const match = block.sql.match(
        /ALTER TABLE \[dbo\]\.\[([^\]]+)\] ADD CONSTRAINT \[[^\]]+\] UNIQUE NONCLUSTERED \(\[([^\]]+)\]\);/,
      );
      const key = match ? `${match[1]}.${match[2]}` : "";
      if (!allowedUniqueAdds.has(key)) {
        errors.push(`Raw Prisma diff contains an unexpected index creation: ${key || "unparsed"}`);
      } else {
        filteredUniqueLimitations += 1;
      }
      continue;
    }
    if (block.kind === "RenameIndex") {
      const match = block.sql.match(/EXEC SP_RENAME N'dbo\.([^.]+)\.([^']+)', N'([^']+)', N'INDEX';/);
      if (!match) {
        errors.push("Raw Prisma diff contains an unparsed index rename");
        continue;
      }
      const live = snapshot.indexes.find((index) => index.table === match[1] && index.name === match[2]);
      if (!live) {
        errors.push(`Raw Prisma diff names a missing live index ${match[1]}.${match[2]}`);
      } else {
        nameOnlyIndexes += 1;
      }
      continue;
    }
    errors.push(`Raw Prisma diff contains unexpected operation category: ${block.kind}`);
  }

  const commentCount = [...rawDiff.matchAll(/^-- /gm)].length;
  if (blocks.length !== commentCount) {
    errors.push("Raw Prisma diff contains an unclassified operation block");
  }
  if (filteredUniqueLimitations !== 2) {
    errors.push(`Expected exactly two filtered-unique Prisma limitations, found ${filteredUniqueLimitations}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    summary: { equivalentDefaults, nameOnlyIndexes, filteredUniqueLimitations },
  };
}

function validateSnapshot(snapshot, repositoryMigrations, options = {}) {
  const errors = [];
  const warnings = [];
  for (const expected of CONTRACT.columns) {
    const actual = snapshot.columns.find(
      (candidate) => candidate.table === expected.table && candidate.name === expected.name,
    );
    if (!actual) {
      errors.push(`Missing column ${expected.table}.${expected.name}`);
      continue;
    }
    if (String(actual.type).toLowerCase() !== expected.type) {
      errors.push(`Wrong type for ${expected.table}.${expected.name}: ${actual.type}`);
    }
    if (expected.maxLength !== null && Number(actual.maxLength) !== expected.maxLength) {
      errors.push(`Wrong width for ${expected.table}.${expected.name}: ${actual.maxLength}`);
    }
    if (Boolean(actual.nullable) !== expected.nullable) {
      errors.push(`Wrong nullability for ${expected.table}.${expected.name}`);
    }
    if (expected.defaultValue !== null) {
      const actualDefault = normalizeDefault(actual.defaultDefinition);
      const expectedDefault = normalizeDefault(expected.defaultValue);
      if (actualDefault !== expectedDefault) {
        errors.push(`Wrong default for ${expected.table}.${expected.name}: ${actual.defaultDefinition}`);
      }
    }
  }

  for (const expected of CONTRACT.filteredUniqueIndexes) {
    const index = snapshot.indexes.find(
      (candidate) =>
        candidate.table === expected.table &&
        candidate.unique &&
        JSON.stringify(indexColumns(candidate)) === JSON.stringify(expected.columns),
    );
    if (!index) {
      errors.push(`Missing filtered unique index on ${expected.table}(${expected.columns.join(", ")})`);
      continue;
    }
    const predicate = normalizeFilter(index.filterDefinition);
    if (!expected.columns.every((name) => predicate.includes(`${name.toLowerCase()} is not null`))) {
      errors.push(`Unsafe filtered unique predicate on ${expected.table}(${expected.columns.join(", ")})`);
    }
    const valueCheck = snapshot.uniqueValueChecks?.find(
      (candidate) => candidate.table === expected.table && candidate.column === expected.columns[0],
    );
    if (!valueCheck) {
      errors.push(`Missing uniqueness data check for ${expected.table}.${expected.columns[0]}`);
    } else if (Number(valueCheck.duplicateGroupCount) !== 0) {
      errors.push(`Duplicate non-null values exist for ${expected.table}.${expected.columns[0]}`);
    }
  }

  for (const expected of CONTRACT.indexes) {
    if (!findIndex(snapshot, expected)) {
      errors.push(`Missing semantic index on ${expected.table}(${expected.columns.join(", ")})`);
    }
  }

  for (const expected of CONTRACT.foreignKeys) {
    const actual = snapshot.foreignKeys.find(
      (candidate) => candidate.table === expected.table && candidate.column === expected.column,
    );
    if (!actual) {
      errors.push(`Missing foreign key ${expected.table}.${expected.column}`);
      continue;
    }
    for (const property of ["referencedTable", "referencedColumn", "deleteAction", "updateAction"]) {
      if (String(actual[property]).toUpperCase() !== String(expected[property]).toUpperCase()) {
        errors.push(`Wrong ${property} for ${expected.table}.${expected.column}: ${actual[property]}`);
      }
    }
    if (actual.disabled || actual.notTrusted) {
      errors.push(`Foreign key ${expected.table}.${expected.column} is disabled or untrusted`);
    }
  }

  const applied = snapshot.migrations.filter((migration) => migration.finishedAt && !migration.rolledBackAt);
  const appliedByName = new Map(applied.map((migration) => [migration.name, migration]));
  const repositoryByName = new Map(repositoryMigrations.map((migration) => [migration.name, migration]));
  for (const migration of repositoryMigrations) {
    const live = appliedByName.get(migration.name);
    if (!live) {
      errors.push(`Pending or missing applied migration ${migration.name}`);
      continue;
    }
    if (!migration.checksums.has(live.checksum)) {
      const isApprovedException =
        migration.name === HISTORICAL_EXCEPTION.migrationName &&
        live.checksum === HISTORICAL_EXCEPTION.appliedChecksum &&
        options.provenanceDocumentPresent !== false;
      if (isApprovedException) {
        warnings.push(`Approved historical checksum provenance exception: ${migration.name}`);
      } else {
        errors.push(`Unapproved migration checksum mismatch: ${migration.name}`);
      }
    }
  }
  for (const migration of applied) {
    if (!repositoryByName.has(migration.name)) {
      errors.push(`Applied migration is absent from repository: ${migration.name}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      columnsChecked: CONTRACT.columns.length,
      filteredUniqueIndexesChecked: CONTRACT.filteredUniqueIndexes.length,
      semanticIndexesChecked: CONTRACT.indexes.length,
      foreignKeysChecked: CONTRACT.foreignKeys.length,
      repositoryMigrations: repositoryMigrations.length,
      appliedMigrations: applied.length,
    },
  };
}

function loadRepositoryMigrations(root) {
  const migrationsDirectory = path.join(root, "prisma", "migrations");
  return fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(migrationsDirectory, entry.name, "migration.sql");
      const contents = fs.readFileSync(file);
      return { name: entry.name, checksums: migrationChecksums(contents) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseSqlServerUrl(connectionString) {
  const raw = connectionString.replace(/^sqlserver:\/\//i, "");
  const parts = raw.split(";");
  const serverPart = parts.shift();
  const [server, portText] = serverPart.split(":");
  const values = Object.fromEntries(
    parts.map((part) => {
      const separator = part.indexOf("=");
      return [part.slice(0, separator).toLowerCase(), decodeURIComponent(part.slice(separator + 1))];
    }),
  );
  return {
    server,
    port: Number(portText || 1433),
    database: values.database,
    user: values.user,
    password: values.password,
    connectionTimeout: 15000,
    requestTimeout: 30000,
    options: {
      encrypt: values.encrypt !== "false",
      trustServerCertificate: values.trustservercertificate === "true",
    },
  };
}

async function readSnapshot(connectionString) {
  const sql = require("mssql");
  const pool = await sql.connect(parseSqlServerUrl(connectionString));
  try {
    const columns = await pool.request().query(`
      SELECT t.name AS [table], c.name, ty.name AS [type],
             CASE WHEN ty.name IN ('nvarchar','nchar') AND c.max_length > 0 THEN c.max_length / 2 ELSE c.max_length END AS maxLength,
             CAST(c.is_nullable AS bit) AS nullable, dc.name AS defaultConstraintName,
             dc.definition AS defaultDefinition
      FROM sys.tables t
      JOIN sys.columns c ON c.object_id = t.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = t.object_id AND dc.parent_column_id = c.column_id
      WHERE SCHEMA_NAME(t.schema_id) = 'dbo';
    `);
    const foreignKeys = await pool.request().query(`
      SELECT pt.name AS [table], pc.name AS [column], rt.name AS referencedTable,
             rc.name AS referencedColumn, fk.delete_referential_action_desc AS deleteAction,
             fk.update_referential_action_desc AS updateAction, fk.name,
             CAST(fk.is_disabled AS bit) AS disabled, CAST(fk.is_not_trusted AS bit) AS notTrusted
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
      JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
      JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
      JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
      WHERE SCHEMA_NAME(pt.schema_id) = 'dbo';
    `);
    const indexRows = await pool.request().query(`
      SELECT t.name AS [table], i.name, CAST(i.is_unique AS bit) AS [unique], i.filter_definition AS filterDefinition,
             c.name AS columnName, ic.key_ordinal AS ordinal, CAST(ic.is_included_column AS bit) AS included
      FROM sys.indexes i
      JOIN sys.tables t ON t.object_id = i.object_id
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
      WHERE SCHEMA_NAME(t.schema_id) = 'dbo' AND i.is_hypothetical = 0 AND i.name IS NOT NULL;
    `);
    const indexes = [...new Set(indexRows.recordset.map((row) => `${row.table}\u0000${row.name}`))].map((key) => {
      const [table, name] = key.split("\u0000");
      const rows = indexRows.recordset.filter((row) => row.table === table && row.name === name);
      return {
        table,
        name,
        unique: rows[0].unique,
        filterDefinition: rows[0].filterDefinition,
        columns: rows.map((row) => ({ name: row.columnName, ordinal: row.ordinal, included: row.included })),
      };
    });
    const migrations = await pool.request().query(`
      SELECT migration_name AS name, checksum, finished_at AS finishedAt,
             rolled_back_at AS rolledBackAt, applied_steps_count AS appliedStepsCount
      FROM dbo._prisma_migrations;
    `);
    const uniqueValueChecks = await pool.request().query(`
      SELECT 'bookings' AS [table], 'creationRequestKey' AS [column],
        (SELECT COUNT(*) FROM (SELECT [creationRequestKey] FROM dbo.[bookings] WHERE [creationRequestKey] IS NOT NULL GROUP BY [creationRequestKey] HAVING COUNT(*) > 1) d) AS duplicateGroupCount
      UNION ALL
      SELECT 'consent_records', 'token',
        (SELECT COUNT(*) FROM (SELECT [token] FROM dbo.[consent_records] WHERE [token] IS NOT NULL GROUP BY [token] HAVING COUNT(*) > 1) d)
      UNION ALL
      SELECT 'users', 'phone',
        (SELECT COUNT(*) FROM (SELECT [phone] FROM dbo.[users] WHERE [phone] IS NOT NULL GROUP BY [phone] HAVING COUNT(*) > 1) d);
    `);
    return {
      columns: columns.recordset,
      foreignKeys: foreignKeys.recordset,
      indexes,
      migrations: migrations.recordset,
      uniqueValueChecks: uniqueValueChecks.recordset,
      database: pool.config.database,
      server: pool.config.server,
    };
  } finally {
    await pool.close();
  }
}

async function main() {
  const root = path.resolve(__dirname, "..", "..");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const repositoryMigrations = loadRepositoryMigrations(root);
  const snapshot = await readSnapshot(connectionString);
  const result = validateSnapshot(snapshot, repositoryMigrations, {
    provenanceDocumentPresent: fs.existsSync(path.join(root, HISTORICAL_EXCEPTION.provenanceDocument)),
  });
  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  const rawDiffProcess = childProcess.spawnSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
      "--exit-code",
    ],
    { cwd: root, env: process.env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (![0, 2].includes(rawDiffProcess.status)) {
    throw new Error(
      `Raw Prisma diff failed with exit code ${rawDiffProcess.status}: ${rawDiffProcess.error?.message ?? rawDiffProcess.stderr.trim()}`,
    );
  }
  const rawDiff = validateRawPrismaDiff(rawDiffProcess.stdout, snapshot);
  result.errors.push(...rawDiff.errors);
  result.ok = result.errors.length === 0;
  process.stdout.write(
    `${JSON.stringify({
      status: result.ok ? "PASS" : "FAIL",
      mode: "read-only",
      database: snapshot.database,
      server: snapshot.server,
      rawPrismaDiff: {
        exitCode: rawDiffProcess.status,
        ...rawDiff,
      },
      ...result,
    }, null, 2)}\n`,
  );
  return result.ok ? 0 : 1;
}

module.exports = {
  CONTRACT,
  HISTORICAL_EXCEPTION,
  migrationChecksums,
  normalizeDefault,
  normalizeFilter,
  validateRawPrismaDiff,
  validateSnapshot,
};

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
