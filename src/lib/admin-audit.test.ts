import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    $executeRaw: db.executeRaw,
    adminAuditLog: {
      create: db.create,
    },
  },
}));

import { createAdminAuditLog } from "@/lib/admin-audit";

const entry = {
  actionType: "device_paired",
  entityType: "device" as const,
  entityId: "device-1",
  actorUserId: "user-1",
  previousValue: { state: "unpaired" },
  newValue: { state: "paired" },
  metadata: { requestId: "request-1", role: "employee" },
};

function canonicalSql() {
  const query = db.executeRaw.mock.calls[0]?.[0] as Prisma.Sql;
  expect(query).toBeDefined();
  return query;
}

describe("createAdminAuditLog", () => {
  beforeEach(() => {
    db.executeRaw.mockReset();
    db.create.mockReset();
    db.executeRaw.mockResolvedValue(1);
    db.create.mockResolvedValue({ id: "fallback-audit" });
  });

  it("writes exactly once through the canonical actionType path", async () => {
    await createAdminAuditLog(entry);

    expect(db.executeRaw).toHaveBeenCalledTimes(1);
    expect(db.create).not.toHaveBeenCalled();

    const query = canonicalSql();
    const sqlText = query.strings.join("?");
    const insertColumns = sqlText
      .match(/admin_audit_logs\s*\(([^)]+)\)/i)?.[1]
      .split(",")
      .map((column) => column.trim());
    const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === "AdminAuditLog");
    const modelFields = new Set(model?.fields.map((field) => field.name));

    expect(insertColumns).toEqual([
      "id",
      "actionType",
      "entityType",
      "entityId",
      "actorUserId",
      "previousValue",
      "newValue",
      "metadata",
      "createdAt",
    ]);
    expect(insertColumns?.every((column) => modelFields.has(column))).toBe(true);
    expect(sqlText).not.toMatch(/\baction\b/i);
    expect(sqlText).not.toContain("request-1");
    expect(query.values).toEqual([
      expect.stringMatching(/^audit_/),
      "device_paired",
      "device",
      "device-1",
      "user-1",
      JSON.stringify(entry.previousValue),
      JSON.stringify(entry.newValue),
      JSON.stringify(entry.metadata),
    ]);
  });

  it("uses the Prisma fallback once when the canonical write fails", async () => {
    db.executeRaw.mockRejectedValueOnce(new Error("simulated canonical write failure"));

    await createAdminAuditLog(entry);

    expect(db.executeRaw).toHaveBeenCalledTimes(1);
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(db.create).toHaveBeenCalledWith({
      data: {
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorUserId: entry.actorUserId,
        previousValue: JSON.stringify(entry.previousValue),
        newValue: JSON.stringify(entry.newValue),
        metadata: JSON.stringify(entry.metadata),
      },
    });
  });
});
