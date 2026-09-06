import { coreAdminAuditRejectionCategoryLabel } from "@/lib/core-admin-audit-categories";

const CORE_VENDOR_AUDIT_PASSED_NOTIFICATION_KIND = "VENDOR_CORE_AUDIT_PASSED_V1";
const CORE_VENDOR_AUDIT_REJECTED_NOTIFICATION_KIND = "VENDOR_CORE_AUDIT_REJECTED_V1";

export type VendorManagerNotificationView = {
  id: string;
  type: "audit";
  title: string;
  message: string;
  time: string;
  read: boolean;
  readAt: string | null;
  priority: "high" | "medium";
  href: string;
  historical: boolean;
};

export async function createVendorManagerAuditNotifications(tx: any, input: {
  vendorId: string;
  bookingId: string;
  packageId: string;
  sourceAdminDecisionId: string;
  sourceBookingNotificationId: string;
  notificationType: string;
  title: string;
  message: string;
}) {
  const managers = await tx.vendorMembership.findMany({
    where: { vendorId: input.vendorId, role: "MANAGER", status: "ACTIVE" },
    select: { id: true },
  });
  for (const manager of managers) {
    await tx.vendorManagerNotification.upsert({
      where: {
        sourceAdminDecisionId_recipientMembershipId_notificationType: {
          sourceAdminDecisionId: input.sourceAdminDecisionId,
          recipientMembershipId: manager.id,
          notificationType: input.notificationType,
        },
      },
      create: {
        vendorId: input.vendorId,
        bookingId: input.bookingId,
        packageId: input.packageId,
        sourceAdminDecisionId: input.sourceAdminDecisionId,
        sourceBookingNotificationId: input.sourceBookingNotificationId,
        recipientMembershipId: manager.id,
        notificationType: input.notificationType,
        title: input.title,
        message: input.message,
        targetUrl: `/vendor/jobs/${encodeURIComponent(input.bookingId)}`,
      },
      update: {},
    });
  }
  return managers.length;
}

function toDurableView(row: any): VendorManagerNotificationView {
  return {
    id: String(row.id),
    type: "audit",
    title: String(row.title),
    message: String(row.message),
    time: new Date(row.createdAt).toISOString(),
    read: Boolean(row.readAt),
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    priority: String(row.notificationType) === CORE_VENDOR_AUDIT_REJECTED_NOTIFICATION_KIND ? "high" : "medium",
    href: String(row.targetUrl),
    historical: false,
  };
}

export async function listUnreadVendorManagerNotifications(
  db: any,
  input: { vendorId: string; membershipId: string; limit?: number },
) {
  const rows = await db.vendorManagerNotification.findMany({
    where: {
      vendorId: input.vendorId,
      recipientMembershipId: input.membershipId,
      presentationState: "UNREAD",
      readAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit || 10, 1), 50),
  });
  return rows.map(toDurableView);
}

export async function listVendorManagerNotificationHistory(
  db: any,
  input: { vendorId: string; membershipId: string; limit?: number },
) {
  const take = Math.min(Math.max(input.limit || 50, 1), 100);
  const durable = await db.vendorManagerNotification.findMany({
    where: { vendorId: input.vendorId, recipientMembershipId: input.membershipId },
    orderBy: { createdAt: "desc" },
    take,
  });
  const durableSourceIds = new Set(
    durable.map((row: any) => String(row.sourceBookingNotificationId || "")).filter(Boolean),
  );
  const legacyRows = await db.bookingNotification.findMany({
    where: {
      kind: { in: [CORE_VENDOR_AUDIT_PASSED_NOTIFICATION_KIND, CORE_VENDOR_AUDIT_REJECTED_NOTIFICATION_KIND] },
      booking: { vendorId: input.vendorId },
    },
    include: {
      booking: { select: { id: true, title: true, service: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  const legacyBookingIds = legacyRows.map((row: any) => String(row.bookingId));
  const decisions = legacyBookingIds.length
    ? await db.serviceVideoAdminAuditDecisionEvidence.findMany({
        where: { bookingId: { in: legacyBookingIds } },
        orderBy: { decidedAt: "desc" },
      })
    : [];
  const decisionByBooking = new Map<string, any>();
  for (const decision of decisions) {
    const bookingId = String(decision.bookingId);
    if (!decisionByBooking.has(bookingId)) decisionByBooking.set(bookingId, decision);
  }
  const legacy: VendorManagerNotificationView[] = legacyRows
    .filter((row: any) => !durableSourceIds.has(String(row.id)))
    .flatMap((row: any) => {
      const decision = decisionByBooking.get(String(row.bookingId));
      if (!decision) return [];
      const passed = String(decision.decision).toUpperCase() === "PASS";
      const serviceName = row.booking?.service?.name || row.booking?.title || "Service Order";
      return [{
        id: `legacy:${row.id}`,
        type: "audit" as const,
        title: passed ? "Reliance Audit Passed" : "Reliance Audit Failed",
        message: passed
          ? `${serviceName}: Private Proof was released to the customer. No video was made Public.`
          : `${serviceName}: ${coreAdminAuditRejectionCategoryLabel(decision.rejectionCategory)}. ${decision.reason || "The Reliance work record is permanently closed."}`,
        time: new Date(decision.decidedAt || row.createdAt).toISOString(),
        read: true,
        readAt: null,
        priority: passed ? "medium" as const : "high" as const,
        href: `/vendor/jobs/${encodeURIComponent(row.bookingId)}`,
        historical: true,
      }];
    });
  return [...durable.map(toDurableView), ...legacy]
    .sort((left, right) => Date.parse(right.time) - Date.parse(left.time))
    .slice(0, take);
}

export async function markVendorManagerNotificationRead(
  db: any,
  input: { id: string; vendorId: string; membershipId: string; now?: Date },
) {
  if (input.id.startsWith("legacy:")) return { historical: true, changed: false };
  const now = input.now || new Date();
  const changed = await db.vendorManagerNotification.updateMany({
    where: {
      id: input.id,
      vendorId: input.vendorId,
      recipientMembershipId: input.membershipId,
      presentationState: "UNREAD",
      readAt: null,
    },
    data: { presentationState: "READ", viewedAt: now, readAt: now },
  });
  if (Number(changed.count || 0) === 1) return { historical: false, changed: true, readAt: now };
  const existing = await db.vendorManagerNotification.findFirst({
    where: { id: input.id, vendorId: input.vendorId, recipientMembershipId: input.membershipId },
    select: { readAt: true },
  });
  if (!existing) throw new Error("VENDOR_MANAGER_NOTIFICATION_NOT_FOUND");
  return { historical: false, changed: false, readAt: existing.readAt };
}
