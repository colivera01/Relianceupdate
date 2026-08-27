import { describe, expect, it } from "vitest";

// The release CLI is CommonJS so it can run directly under Node on deployment hosts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const validator = require("../../../scripts/release/validate_sqlserver_schema_contract.cjs") as {
  CONTRACT: {
    columns: Array<Record<string, unknown>>;
    filteredUniqueIndexes: Array<{ table: string; columns: string[] }>;
    indexes: Array<{ table: string; columns: string[]; unique: boolean; included: string[] }>;
    foreignKeys: Array<Record<string, unknown>>;
  };
  HISTORICAL_EXCEPTION: { migrationName: string; appliedChecksum: string };
  normalizeDefault: (value: unknown) => unknown;
  validateRawPrismaDiff: (
    rawDiff: string,
    snapshot: Record<string, unknown>,
  ) => { ok: boolean; errors: string[]; summary: Record<string, number> };
  validateSnapshot: (
    snapshot: Record<string, unknown>,
    migrations: Array<{ name: string; checksums: Set<string> }>,
    options?: { provenanceDocumentPresent?: boolean },
  ) => { ok: boolean; errors: string[]; warnings: string[] };
};

type MutableFixtureEntry = Record<string, any>;

function validFixture() {
  const historical = validator.HISTORICAL_EXCEPTION;
  const repositoryMigrations = [
    { name: "20260101000000_baseline", checksums: new Set(["baseline-checksum"]) },
    { name: historical.migrationName, checksums: new Set(["current-unmatched-checksum"]) },
  ];
  const snapshot: {
    columns: MutableFixtureEntry[];
    indexes: MutableFixtureEntry[];
    foreignKeys: MutableFixtureEntry[];
    uniqueValueChecks: MutableFixtureEntry[];
    migrations: MutableFixtureEntry[];
  } = {
    columns: validator.CONTRACT.columns.map((entry): MutableFixtureEntry => ({
      ...entry,
      defaultDefinition:
        entry.defaultValue === null || entry.defaultValue === undefined
          ? null
          : typeof entry.defaultValue === "string"
            ? `(N'${entry.defaultValue}')`
            : entry.defaultValue === false
              ? "((0))"
              : `((${entry.defaultValue}))`,
    })),
    indexes: [
      ...validator.CONTRACT.filteredUniqueIndexes.map((entry, index): MutableFixtureEntry => ({
        table: entry.table,
        name: `live_filtered_${index}`,
        unique: true,
        filterDefinition: `([${entry.columns[0]}] IS NOT NULL)`,
        columns: entry.columns.map((name, ordinal) => ({ name, ordinal: ordinal + 1, included: false })),
      })),
      ...validator.CONTRACT.indexes.map((entry, index): MutableFixtureEntry => ({
        table: entry.table,
        name: `intentional_live_name_${index}`,
        unique: entry.unique,
        filterDefinition: null,
        columns: [
          ...entry.columns.map((name, ordinal) => ({ name, ordinal: ordinal + 1, included: false })),
          ...entry.included.map((name) => ({ name, ordinal: 0, included: true })),
        ],
      })),
    ],
    foreignKeys: validator.CONTRACT.foreignKeys.map((entry): MutableFixtureEntry => ({
      ...entry,
      name: "generated_name_is_not_semantic",
      disabled: false,
      notTrusted: false,
    })),
    uniqueValueChecks: validator.CONTRACT.filteredUniqueIndexes.map((entry): MutableFixtureEntry => ({
      table: entry.table,
      column: entry.columns[0],
      duplicateGroupCount: 0,
    })),
    migrations: [
      {
        name: "20260101000000_baseline",
        checksum: "baseline-checksum",
        finishedAt: new Date(),
        rolledBackAt: null,
      },
      {
        name: historical.migrationName,
        checksum: historical.appliedChecksum,
        finishedAt: new Date(),
        rolledBackAt: null,
      },
    ],
  };
  return { snapshot, repositoryMigrations };
}

function validate(fixture = validFixture()) {
  return validator.validateSnapshot(fixture.snapshot, fixture.repositoryMigrations, {
    provenanceDocumentPresent: true,
  });
}

describe("SQL Server semantic schema contract", () => {
  it("accepts the intended filtered indexes, name-only differences, NO ACTION FKs, audio indexes, and one provenance exception", () => {
    const result = validate();
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([
      `Approved historical checksum provenance exception: ${validator.HISTORICAL_EXCEPTION.migrationName}`,
    ]);
  });

  it("normalizes equivalent Unicode, BIT, and integer defaults", () => {
    expect(validator.normalizeDefault("((N'ACTIVE'))")).toBe("ACTIVE");
    expect(validator.normalizeDefault("('ACTIVE')")).toBe("ACTIVE");
    expect(validator.normalizeDefault("((0))")).toBe(false);
    expect(validator.normalizeDefault("((1))")).toBe(1);
  });

  it("accepts only equivalent defaults, name-only indexes, and the two filtered-unique Prisma limitations", () => {
    const fixture = validFixture();
    fixture.snapshot.columns.push({
      table: "example",
      name: "status",
      type: "nvarchar",
      maxLength: 1000,
      nullable: false,
      defaultDefinition: "(N'ACTIVE')",
    });
    fixture.snapshot.indexes.push({
      table: "example",
      name: "live_short_name",
      unique: false,
      filterDefinition: null,
      columns: [{ name: "status", ordinal: 1, included: false }],
    });
    const rawDiff = `BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[example] DROP CONSTRAINT [example_status_df];
ALTER TABLE [dbo].[example] ADD CONSTRAINT [example_status_df] DEFAULT 'ACTIVE' FOR [status];

-- CreateIndex
ALTER TABLE [dbo].[consent_records] ADD CONSTRAINT [consent_records_token_key] UNIQUE NONCLUSTERED ([token]);

-- CreateIndex
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_phone_key] UNIQUE NONCLUSTERED ([phone]);

-- RenameIndex
EXEC SP_RENAME N'dbo.example.live_short_name', N'generated_long_name', N'INDEX';

COMMIT TRAN;
END TRY`;
    const result = validator.validateRawPrismaDiff(rawDiff, fixture.snapshot);
    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({
      equivalentDefaults: 1,
      nameOnlyIndexes: 1,
      filteredUniqueLimitations: 2,
    });
  });

  it("rejects any new raw Prisma DDL category", () => {
    const fixture = validFixture();
    const rawDiff = `BEGIN TRY

BEGIN TRAN;

-- DropTable
DROP TABLE [dbo].[bookings];

COMMIT TRAN;
END TRY`;
    expect(validator.validateRawPrismaDiff(rawDiff, fixture.snapshot).ok).toBe(false);
  });

  it.each([
    ["wrong creationRequestKey width", (fixture: ReturnType<typeof validFixture>) => {
      const target = fixture.snapshot.columns.find((entry) => entry.table === "bookings");
      if (target) target.maxLength = 1000;
    }],
    ["wrong column nullability", (fixture: ReturnType<typeof validFixture>) => {
      const target = fixture.snapshot.columns.find((entry) => entry.table === "media_assets" && entry.name === "audioPresence");
      if (target) target.nullable = true;
    }],
    ["wrong semantic default", (fixture: ReturnType<typeof validFixture>) => {
      const target = fixture.snapshot.columns.find((entry) => entry.table === "media_assets" && entry.name === "audioPresence");
      if (target) target.defaultDefinition = "N'PRESENT'";
    }],
    ["missing consent token index", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.indexes = fixture.snapshot.indexes.filter((entry) => !(entry.table === "consent_records"));
    }],
    ["missing phone index", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.indexes = fixture.snapshot.indexes.filter((entry) => !(entry.table === "users"));
    }],
    ["missing filtered predicate", (fixture: ReturnType<typeof validFixture>) => {
      const target = fixture.snapshot.indexes.find((entry) => entry.table === "consent_records");
      if (target) target.filterDefinition = null;
    }],
    ["duplicate non-null values", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.uniqueValueChecks[0].duplicateGroupCount = 1;
    }],
    ["missing audio index", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.indexes = fixture.snapshot.indexes.filter((entry) => entry.table !== "media_assets" || entry.columns[0]?.name !== "audioPresence");
    }],
    ["wrong audio index columns", (fixture: ReturnType<typeof validFixture>) => {
      const target = fixture.snapshot.indexes.find((entry) => entry.table === "service_video_stage_evidence" && !entry.unique);
      if (target) target.columns[0].name = "audioPresence";
    }],
    ["missing FK", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.foreignKeys.shift();
    }],
    ["wrong FK delete behavior", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.foreignKeys[0].deleteAction = "NO_ACTION";
    }],
    ["wrong FK update behavior", (fixture: ReturnType<typeof validFixture>) => {
      fixture.snapshot.foreignKeys[0].updateAction = "CASCADE";
    }],
  ])("fails closed for %s", (_name, mutate) => {
    const fixture = validFixture();
    mutate(fixture);
    expect(validate(fixture).ok).toBe(false);
  });

  it("fails for an unknown checksum mismatch", () => {
    const fixture = validFixture();
    fixture.snapshot.migrations[0].checksum = "unexpected";
    expect(validate(fixture).errors).toContain(
      "Unapproved migration checksum mismatch: 20260101000000_baseline",
    );
  });

  it("fails if the approved exception lacks its provenance document", () => {
    const fixture = validFixture();
    const result = validator.validateSnapshot(fixture.snapshot, fixture.repositoryMigrations, {
      provenanceDocumentPresent: false,
    });
    expect(result.ok).toBe(false);
  });

  it("fails for a missing or pending repository migration", () => {
    const fixture = validFixture();
    fixture.snapshot.migrations = fixture.snapshot.migrations.filter(
      (entry) => entry.name !== "20260101000000_baseline",
    );
    expect(validate(fixture).errors).toContain(
      "Pending or missing applied migration 20260101000000_baseline",
    );
  });

  it("fails when a repository migration row exists but never finished", () => {
    const fixture = validFixture();
    fixture.snapshot.migrations[0].finishedAt = null;
    expect(validate(fixture).errors).toContain(
      "Pending or missing applied migration 20260101000000_baseline",
    );
  });

  it("fails when an applied migration is absent from the repository", () => {
    const fixture = validFixture();
    fixture.snapshot.migrations.push({
      name: "20269999999999_unexpected",
      checksum: "unexpected",
      finishedAt: new Date(),
      rolledBackAt: null,
    });
    expect(validate(fixture).errors).toContain(
      "Applied migration is absent from repository: 20269999999999_unexpected",
    );
  });
});
