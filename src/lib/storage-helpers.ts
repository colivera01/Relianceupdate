// src/lib/storage-helpers.ts
// Storage calculation and alert helpers

import { prisma } from "@/server/db";
import { createAdminNotificationWithEmail } from "@/lib/admin-notifications";
import { countableMediaAssetWhere } from "@/lib/metrics-exclusion";

export interface StorageUsage {
  usedBytes: bigint;
  limitBytes: bigint;
  percentUsed: number;
  isOverLimit: boolean;
}

/**
 * Calculate storage usage for a vendor
 * usedBytes = SUM(bytes) WHERE vendorId = X AND deletedAt IS NULL
 */
export async function calculateStorageUsage(vendorId: string): Promise<StorageUsage> {
  const vendor = await (prisma as any).vendor.findUnique({
    where: { id: vendorId },
    select: {
      storageLimitBytes: true,
      isOverLimit: true,
      overLimitSince: true,
    },
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const limitBytes = vendor.storageLimitBytes || BigInt(1073741824); // Default 1GB

  // Calculate used storage (only non-deleted assets)
  const storageAggregate = await (prisma as any).mediaAsset.aggregate({
    where: countableMediaAssetWhere({ vendorId }),
    _sum: {
      bytes: true,
    },
  });

  const usedBytes = storageAggregate._sum.bytes || BigInt(0);
  const percentUsed = limitBytes > 0 
    ? Number((usedBytes * BigInt(100)) / limitBytes) 
    : 0;
  const isOverLimit = usedBytes >= limitBytes;

  // Update vendor's over-limit status if changed
  if (vendor.isOverLimit !== isOverLimit) {
    await (prisma as any).vendor.update({
      where: { id: vendorId },
      data: {
        isOverLimit,
        overLimitSince: isOverLimit && !vendor.overLimitSince ? new Date() : vendor.overLimitSince,
      },
    });
  }

  return {
    usedBytes,
    limitBytes,
    percentUsed,
    isOverLimit,
  };
}

/**
 * Check if storage threshold alert should be sent and create it if needed
 * Thresholds: 80, 95, 100
 */
export async function checkAndCreateStorageAlerts(
  vendorId: string,
  usage: StorageUsage
): Promise<void> {
  const thresholds = [80, 95, 100];
  const crossedThresholds: number[] = [];

  for (const threshold of thresholds) {
    if (usage.percentUsed >= threshold) {
      // Check if alert already exists for this threshold
      const existingAlert = await (prisma as any).vendorStorageAlert.findFirst({
        where: {
          vendorId,
          threshold,
        },
      });

      if (!existingAlert) {
        // Create alert record
        await (prisma as any).vendorStorageAlert.create({
          data: {
            vendorId,
            threshold,
          },
        });

        crossedThresholds.push(threshold);
      }
    }
  }

  // Create admin notifications for crossed thresholds
  if (crossedThresholds.length > 0) {
    const vendor = await (prisma as any).vendor.findUnique({
      where: { id: vendorId },
      select: { businessName: true, name: true },
    });

    const vendorName = vendor?.businessName || vendor?.name || vendorId;

    for (const threshold of crossedThresholds) {
      let title: string;
      let message: string;
      let type: string;

      if (threshold === 100) {
        title = "Storage Limit Reached";
        message = `${vendorName} has reached 100% storage capacity. Uploads are blocked.`;
        type = "STORAGE_LIMIT_REACHED";
      } else if (threshold === 95) {
        title = "Storage Critical Alert";
        message = `${vendorName} is at ${usage.percentUsed.toFixed(1)}% storage capacity (${threshold}% threshold).`;
        type = "STORAGE_ALERT";
      } else {
        title = "Storage Warning";
        message = `${vendorName} is at ${usage.percentUsed.toFixed(1)}% storage capacity (${threshold}% threshold).`;
        type = "STORAGE_ALERT";
      }

      await createAdminNotificationWithEmail({
        vendorId,
        type,
        title,
        message,
        metadata: {
          threshold,
          percentUsed: usage.percentUsed,
          usedBytes: usage.usedBytes.toString(),
          limitBytes: usage.limitBytes.toString(),
        },
        surfaceHref: "/admin/notifications",
        actorUserId: "system",
      });
    }
  }
}

