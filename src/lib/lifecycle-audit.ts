import { createAdminAuditLog } from "@/lib/admin-audit";

/**
 * Best-effort audit emitter for operational lifecycle events.
 *
 * The lifecycle endpoints (job assign/start/stage/approve/reject, device
 * pairing, membership acceptance, etc.) are user-facing and must not fail
 * because the audit log table is unavailable or schema-skewed. We always
 * `console.warn` on failure so the event is still observable in dev logs,
 * and silently swallow the error in production.
 */
export type LifecycleAuditEntry = Parameters<typeof createAdminAuditLog>[0];

export async function recordLifecycleAudit(entry: LifecycleAuditEntry): Promise<void> {
  try {
    await createAdminAuditLog(entry);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[lifecycle-audit] write failed (non-fatal)", {
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorUserId: entry.actorUserId,
        error: (error as Error)?.message || String(error),
      });
    }
  }
}
