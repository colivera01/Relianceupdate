export type VendorPermissionExpiryRisk =
  | {
      kind: "EXPIRED";
      expiresAt: string;
      scheduledFor: string | null;
    }
  | {
      kind: "EXPIRES_BEFORE_SERVICE";
      expiresAt: string;
      scheduledFor: string;
    };

const PENDING_PERMISSION_STATES = new Set([
  "requested",
  "pending",
  "delivered",
  "sending",
  "delivery_failed",
  "expired",
]);

function validDate(value: unknown): Date | null {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Presentation-only warning for the existing 48-hour secure-link policy.
 * This does not extend a link, rotate it, or change the permission decision.
 */
export function resolveVendorPermissionExpiryRisk(input: {
  permissionRequired?: boolean;
  permissionStatus?: string | null;
  expiresAt?: Date | string | null;
  scheduledFor?: Date | string | null;
  now?: Date;
}): VendorPermissionExpiryRisk | null {
  if (input.permissionRequired !== true) return null;
  const state = String(input.permissionStatus || "").trim().toLowerCase();
  if (!PENDING_PERMISSION_STATES.has(state)) return null;

  const expiresAt = validDate(input.expiresAt);
  if (!expiresAt) return null;
  const now = input.now ?? new Date();
  const scheduledFor = validDate(input.scheduledFor);

  if (expiresAt.getTime() <= now.getTime()) {
    return {
      kind: "EXPIRED",
      expiresAt: expiresAt.toISOString(),
      scheduledFor: scheduledFor?.toISOString() ?? null,
    };
  }

  if (scheduledFor && scheduledFor.getTime() > expiresAt.getTime()) {
    return {
      kind: "EXPIRES_BEFORE_SERVICE",
      expiresAt: expiresAt.toISOString(),
      scheduledFor: scheduledFor.toISOString(),
    };
  }

  return null;
}
