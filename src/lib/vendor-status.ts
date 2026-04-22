import { prisma } from "@/server/db";

export type VendorApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export async function trySetVendorApprovalStatus(
  vendorId: string,
  status: VendorApprovalStatus
): Promise<void> {
  const safeVendorId = String(vendorId).replace(/'/g, "''");
  const safeStatus = String(status).replace(/'/g, "''");

  try {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE [vendors] SET [status] = '${safeStatus}' WHERE [id] = '${safeVendorId}'`
    );
  } catch {
    // Some environments may not yet have a vendor status column.
    // Membership status remains the enforced access source-of-truth.
  }
}
