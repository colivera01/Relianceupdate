import { prisma } from "@/server/db";

type AdminAuditEntry = {
  actionType: string;
  entityType: "vendor" | "service" | "review" | "review_window" | "consent" | "notification";
  entityId: string;
  actorUserId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

function isAdminAuditSchemaMismatch(error: unknown): boolean {
  const message = String((error as any)?.message || "");
  return (
    message.includes("Null constraint violation on the fields: (`action`)") ||
    message.includes("Invalid column name 'actionType'") ||
    message.includes("Invalid column name 'previousValue'") ||
    message.includes("Invalid column name 'newValue'")
  );
}

function sqlLiteral(value: string | null): string {
  if (value == null) return "NULL";
  return `N'${value.replace(/'/g, "''")}'`;
}

export async function createAdminAuditLog(entry: AdminAuditEntry): Promise<void> {
  const serializedPreviousValue = entry.previousValue ? JSON.stringify(entry.previousValue) : null;
  const serializedNewValue = entry.newValue ? JSON.stringify(entry.newValue) : null;
  const serializedMetadata = entry.metadata ? JSON.stringify(entry.metadata) : null;

  try {
    await (prisma as any).adminAuditLog.create({
      data: {
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorUserId: entry.actorUserId,
        previousValue: serializedPreviousValue,
        newValue: serializedNewValue,
        metadata: serializedMetadata,
      },
    });
    return;
  } catch (error) {
    if (!isAdminAuditSchemaMismatch(error)) {
      throw error;
    }
  }

  // Legacy DB compatibility: some environments still use `action` instead of `actionType`.
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const actionType = sqlLiteral(entry.actionType);
  const entityType = sqlLiteral(entry.entityType);
  const entityId = sqlLiteral(entry.entityId);
  const actorUserId = sqlLiteral(entry.actorUserId);
  const previousValue = sqlLiteral(serializedPreviousValue);
  const newValue = sqlLiteral(serializedNewValue);
  const metadata = sqlLiteral(serializedMetadata);
  const auditId = sqlLiteral(id);

  await (prisma as any).$executeRawUnsafe(`
IF OBJECT_ID(N'dbo.admin_audit_logs', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.admin_audit_logs', 'action') IS NOT NULL
     AND COL_LENGTH('dbo.admin_audit_logs', 'actionType') IS NOT NULL
  BEGIN
    INSERT INTO dbo.admin_audit_logs (
      id, action, actionType, entityType, entityId, actorUserId, metadata, createdAt
    )
    VALUES (
      ${auditId}, ${actionType}, ${actionType}, ${entityType}, ${entityId}, ${actorUserId}, ${metadata}, SYSUTCDATETIME()
    );
  END
  ELSE IF COL_LENGTH('dbo.admin_audit_logs', 'action') IS NOT NULL
  BEGIN
    INSERT INTO dbo.admin_audit_logs (
      id, action, entityType, entityId, actorUserId, metadata, createdAt
    )
    VALUES (
      ${auditId}, ${actionType}, ${entityType}, ${entityId}, ${actorUserId}, ${metadata}, SYSUTCDATETIME()
    );
  END
  ELSE IF COL_LENGTH('dbo.admin_audit_logs', 'actionType') IS NOT NULL
  BEGIN
    INSERT INTO dbo.admin_audit_logs (
      id, actionType, entityType, entityId, actorUserId, previousValue, newValue, metadata, createdAt
    )
    VALUES (
      ${auditId}, ${actionType}, ${entityType}, ${entityId}, ${actorUserId}, ${previousValue}, ${newValue}, ${metadata}, SYSUTCDATETIME()
    );
  END
END
`);
}
