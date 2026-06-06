import { describe, expect, it } from "vitest";
import {
  AccountStatusError,
  accountStatusErrorBody,
  isUserAccountRestricted,
  isVendorAccountRestricted,
} from "./account-status";

describe("account status enforcement helpers", () => {
  it("treats suspended, banned, and deactivated users as restricted", () => {
    expect(isUserAccountRestricted("active")).toBe(false);
    expect(isUserAccountRestricted("suspended")).toBe(true);
    expect(isUserAccountRestricted("banned")).toBe(true);
    expect(isUserAccountRestricted("deactivated")).toBe(true);
  });

  it("keeps pending approval vendor accounts out of normal operation", () => {
    expect(isVendorAccountRestricted("active")).toBe(false);
    expect(isVendorAccountRestricted("pending_approval")).toBe(true);
    expect(isVendorAccountRestricted("suspended")).toBe(true);
  });

  it("returns honest restricted account response bodies", () => {
    const error = new AccountStatusError("vendor", "banned");

    expect(accountStatusErrorBody(error)).toMatchObject({
      success: false,
      code: "VENDOR_ACCOUNT_RESTRICTED",
      accountType: "vendor",
      accountStatus: "banned",
    });
  });
});
