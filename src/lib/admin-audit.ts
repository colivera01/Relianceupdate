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

export async function createAdminAuditLog(entry: AdminAuditEntry): Promise<void> {
  await (prisma as any).adminAuditLog.create({
    data: {
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorUserId: entry.actorUserId,
      previousValue: entry.previousValue ? JSON.stringify(entry.previousValue) : null,
      newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    },
  });
}
