export const PERMISSION_LINK_TTL_HOURS = 48;

export type PermissionState =
  | "not_sent"
  | "sending"
  | "delivered"
  | "delivery_failed"
  | "pending"
  | "allowed"
  | "declined"
  | "expired"
  | "wrong_recipient"
  | "recipient_mismatch"
  | "superseded"
  | "no_digital_channel";

export function derivePermissionState(input: {
  status: string;
  expiresAt?: Date | string | null;
  now?: Date;
  verifiedDecision?: boolean;
}): PermissionState {
  const status = String(input.status || "").trim().toLowerCase();
  if (status === "accepted") return input.verifiedDecision === false ? "pending" : "allowed";
  if (status === "declined") return "declined";
  if (status === "wrong_recipient") return "wrong_recipient";
  if (status === "recipient_mismatch") return "recipient_mismatch";
  if (status === "superseded" || status === "revoked") return "superseded";
  if (status === "delivery_failed") return "delivery_failed";
  if (status === "no_digital_channel") return "no_digital_channel";
  if (status === "sending") return "sending";
  if (status === "delivered") return "delivered";
  if (status === "not_sent") return "not_sent";
  if (status === "expired") return "expired";

  if (input.expiresAt) {
    const expiresAt = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= (input.now ?? new Date()).getTime()) {
      return "expired";
    }
  }
  return "pending";
}

export function canMakePermissionDecision(input: {
  linkActive: boolean;
  sessionVerified: boolean;
}): boolean {
  return input.linkActive && input.sessionVerified;
}

export function transitionPermissionState(
  current: PermissionState,
  next: PermissionState
): PermissionState {
  if (["allowed", "declined", "wrong_recipient", "superseded"].includes(current)) {
    throw new Error("Permission decision is already final");
  }
  const allowedTransitions: Record<string, PermissionState[]> = {
    not_sent: ["sending", "no_digital_channel", "superseded"],
    sending: ["delivered", "delivery_failed", "pending", "superseded"],
    delivered: ["pending", "allowed", "declined", "wrong_recipient", "expired", "superseded"],
    delivery_failed: ["sending", "pending", "expired", "superseded"],
    pending: ["allowed", "declined", "wrong_recipient", "expired", "superseded"],
    expired: ["sending", "superseded"],
    no_digital_channel: ["superseded"],
    recipient_mismatch: ["superseded"],
  };
  if (!allowedTransitions[current]?.includes(next)) {
    throw new Error(`Invalid permission transition: ${current} -> ${next}`);
  }
  return next;
}
