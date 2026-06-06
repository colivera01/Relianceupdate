import { prisma } from "@/server/db";
import {
  getRestrictedAccountMessage,
  isUserAccountRestricted,
  isVendorAccountRestricted,
  normalizeAccountStatus,
  type AccountStatus,
  type AccountType,
} from "@/lib/account-status-shared";

export class AccountStatusError extends Error {
  accountType: AccountType;
  accountStatus: string;
  code: string;
  statusCode: number;

  constructor(accountType: AccountType, accountStatus: string) {
    super(getRestrictedAccountMessage(accountType, accountStatus));
    this.name = "AccountStatusError";
    this.accountType = accountType;
    this.accountStatus = normalizeAccountStatus(accountStatus);
    this.code = `${accountType.toUpperCase()}_ACCOUNT_RESTRICTED`;
    this.statusCode = 403;
  }
}

export {
  getRestrictedAccountMessage,
  isUserAccountRestricted,
  isVendorAccountRestricted,
  normalizeAccountStatus,
  type AccountStatus,
  type AccountType,
};

export function accountStatusErrorBody(error: AccountStatusError) {
  return {
    success: false,
    code: error.code,
    error: error.message,
    message: error.message,
    accountType: error.accountType,
    accountStatus: error.accountStatus,
  };
}

export async function ensureUserAccountCanAct(userId: string): Promise<void> {
  const userDelegate = (prisma as any).user;
  if (!userDelegate?.findUnique) return;
  const user = await userDelegate.findUnique({
    where: { id: String(userId) },
    select: { id: true, accountStatus: true },
  });
  if (user && isUserAccountRestricted(user.accountStatus)) {
    throw new AccountStatusError("user", user.accountStatus);
  }
}

export async function ensureVendorAccountCanOperate(vendorId: string): Promise<void> {
  const vendorDelegate = (prisma as any).vendor;
  if (!vendorDelegate?.findUnique) return;
  const vendor = await vendorDelegate.findUnique({
    where: { id: String(vendorId) },
    select: { id: true, accountStatus: true },
  });
  if (vendor && isVendorAccountRestricted(vendor.accountStatus)) {
    throw new AccountStatusError("vendor", vendor.accountStatus);
  }
}
