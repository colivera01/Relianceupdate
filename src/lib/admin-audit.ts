import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

type AdminAuditEntry = {
  actionType: string;
  entityType:
    | "vendor"
    | "service"
    | "review"
    | "review_window"
    | "consent"
    | "notification"
    | "booking"
    | "device"
    | "membership"
    | "user"
    | "content_report"
    | "promotion_campaign"
    | "promotion_package"
    | "ai_run";
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

export async function createAdminAuditLog(entry: AdminAuditEntry): Promise<void> {
  const serializedPreviousValue = entry.previousValue ? JSON.stringify(entry.previousValue) : null;
  const serializedNewValue = entry.newValue ? JSON.stringify(entry.newValue) : null;
  const serializedMetadata = entry.metadata ? JSON.stringify(entry.metadata) : null;

  // Use only the canonical schema here. SQL Server compiles column references
  // in every conditional branch, so a legacy identifier cannot safely share
  // this statement with the current table shape.
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    await (prisma as any).$executeRaw(Prisma.sql`
      INSERT INTO dbo.admin_audit_logs (
        id, actionType, entityType, entityId, actorUserId, previousValue, newValue, metadata, createdAt
      )
      VALUES (
        ${id}, ${entry.actionType}, ${entry.entityType}, ${entry.entityId}, ${entry.actorUserId},
        ${serializedPreviousValue}, ${serializedNewValue}, ${serializedMetadata}, SYSUTCDATETIME()
      )
    `);
    return;
  } catch (error) {
    // Preserve the model-backed fallback as defense in depth if the canonical
    // raw write fails independently of the supported table shape.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[admin-audit] canonical insert failed, falling back to Prisma create", {
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        error: (error as Error)?.message || String(error),
      });
    }
  }

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
}
