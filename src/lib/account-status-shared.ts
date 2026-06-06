export type AccountType = "user" | "vendor";
export type AccountStatus =
  | "active"
  | "suspended"
  | "banned"
  | "deactivated"
  | "archived_inactive"
  | "pending_approval";

const USER_RESTRICTED_STATUSES = new Set(["suspended", "banned", "deactivated", "archived_inactive"]);
const VENDOR_RESTRICTED_STATUSES = new Set([
  "suspended",
  "banned",
  "deactivated",
  "archived_inactive",
  "pending_approval",
]);

export function normalizeAccountStatus(status: unknown): string {
  return String(status || "active").trim().toLowerCase() || "active";
}

export function isUserAccountRestricted(status: unknown): boolean {
  return USER_RESTRICTED_STATUSES.has(normalizeAccountStatus(status));
}

export function isVendorAccountRestricted(status: unknown): boolean {
  return VENDOR_RESTRICTED_STATUSES.has(normalizeAccountStatus(status));
}

export function getRestrictedAccountMessage(accountType: AccountType, status: unknown): string {
  const normalized = normalizeAccountStatus(status);
  if (normalized === "banned") {
    return `${accountType === "vendor" ? "Vendor" : "Customer"} account unavailable. Contact support if you believe this is a mistake.`;
  }
  if (normalized === "pending_approval") {
    return "Vendor account pending approval. Public listing and vendor tools are not available yet.";
  }
  if (normalized === "deactivated") {
    return `${accountType === "vendor" ? "Vendor" : "Customer"} account deactivated. Contact support to reactivate access.`;
  }
  return `${accountType === "vendor" ? "Vendor" : "Customer"} account restricted. Contact support for help.`;
}
