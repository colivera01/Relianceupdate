const CUSTOMER_SERVICE_REQUEST_KIND_PREFIXES = [
  'SERVICE_REQUEST_NEW_REQUEST_CUSTOMER_V1:',
  'SERVICE_REQUEST_ACCEPTED_CUSTOMER_V1:',
  'SERVICE_REQUEST_DECLINED_CUSTOMER_V1:',
  'SERVICE_REQUEST_COUNTEROFFER_CUSTOMER_V1:',
  'SERVICE_REQUEST_REMINDER_CUSTOMER_V1:',
] as const;

const CUSTOMER_NOTIFICATION_KIND_PREFIXES = [
  ...CUSTOMER_SERVICE_REQUEST_KIND_PREFIXES,
  'CUSTOMER_PERMISSION_REQUEST:',
  'CUSTOMER_CONSENT_REQUEST:',
  'CUSTOMER_RECORDING_NOTICE:',
] as const;

const CUSTOMER_NOTIFICATION_EXACT_KINDS = [
  'PRIVATE_PROOF_READY_ADMIN_AUDIT_V1',
  'PRIVATE_PROOF_AUDIT_REJECTED_V1',
  'CUSTOMER_CONSENT_REQUEST',
  'CUSTOMER_PERMISSION_REQUEST',
  'CUSTOMER_RECORDING_NOTICE',
] as const;

export type CustomerNotificationHistoryItem = {
  id: string;
  serviceOrderId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  readAt: string | null;
  href: string;
  serviceName: string;
  vendorName: string;
};

export function isCustomerFacingNotificationKind(kind: unknown): boolean {
  const value = String(kind || '');
  return (
    CUSTOMER_NOTIFICATION_EXACT_KINDS.includes(value as typeof CUSTOMER_NOTIFICATION_EXACT_KINDS[number]) ||
    CUSTOMER_NOTIFICATION_KIND_PREFIXES.some((prefix) => value.startsWith(prefix))
  );
}

export function customerNotificationKindWhere() {
  return {
    OR: [
      ...CUSTOMER_NOTIFICATION_EXACT_KINDS.map((kind) => ({ kind })),
      ...CUSTOMER_NOTIFICATION_KIND_PREFIXES.map((prefix) => ({ kind: { startsWith: prefix } })),
    ],
  };
}

function parseEnvelope(value: unknown): Record<string, any> {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serviceRequestFallback(kind: string, vendorName: string, serviceName: string) {
  if (kind.startsWith('SERVICE_REQUEST_NEW_REQUEST_CUSTOMER_V1:')) {
    return {
      title: 'Service request sent',
      message: `Your ${serviceName} request was sent to ${vendorName}. It is not confirmed until the business responds.`,
    };
  }
  if (kind.startsWith('SERVICE_REQUEST_ACCEPTED_CUSTOMER_V1:')) {
    return { title: 'Service request accepted', message: `${vendorName} accepted your ${serviceName} request.` };
  }
  if (kind.startsWith('SERVICE_REQUEST_DECLINED_CUSTOMER_V1:')) {
    return { title: 'Service request declined', message: `${vendorName} could not accept your ${serviceName} request.` };
  }
  if (kind.startsWith('SERVICE_REQUEST_COUNTEROFFER_CUSTOMER_V1:')) {
    return { title: 'New appointment time proposed', message: `${vendorName} proposed another time for ${serviceName}. Review it in your Service Record.` };
  }
  return { title: 'Upcoming service reminder', message: `Your ${serviceName} appointment with ${vendorName} is coming up.` };
}

export function shapeCustomerNotification(row: any): CustomerNotificationHistoryItem {
  const kind = String(row?.kind || '');
  const serviceName = String(row?.booking?.service?.name || row?.booking?.title || 'service');
  const vendorName = String(row?.booking?.vendor?.businessName || row?.booking?.vendor?.name || 'your service provider');
  let copy: { title: string; message: string };

  if (kind.startsWith('SERVICE_REQUEST_')) {
    const envelope = parseEnvelope(row?.channelsJson);
    const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {};
    const fallback = serviceRequestFallback(kind, vendorName, serviceName);
    copy = {
      title: String(payload.subject || payload.headline || fallback.title),
      message: String(payload.bodyText || fallback.message),
    };
  } else if (kind === 'PRIVATE_PROOF_READY_ADMIN_AUDIT_V1') {
    copy = {
      title: 'Your Private Service Record is ready',
      message: `Reliance Audit approved the Service Video Package for ${serviceName}. Open the record to review it privately.`,
    };
  } else if (kind === 'PRIVATE_PROOF_AUDIT_REJECTED_V1') {
    copy = {
      title: 'Service Video review update',
      message: `The submitted Service Video Package for ${serviceName} was not released to your customer record. Your service provider can review the next step.`,
    };
  } else if (kind === 'CUSTOMER_RECORDING_NOTICE' || kind.startsWith('CUSTOMER_RECORDING_NOTICE:')) {
    copy = {
      title: 'Service Video recording notice',
      message: `${vendorName} plans to create a Private Service Video for ${serviceName}. Open the Service Record to review the current recording scope.`,
    };
  } else {
    copy = {
      title: 'Recording permission required',
      message: `Recording permission is required for ${serviceName}. The authorized recipient must use the secure link sent directly to them. Your Service Record shows the current permission status.`,
    };
  }

  const createdAt = safeIsoDate(row?.createdAt) || '';
  const readAt = safeIsoDate(row?.customerReadAt);

  return {
    id: String(row.id),
    serviceOrderId: String(row.bookingId),
    title: copy.title,
    message: copy.message,
    createdAt,
    read: Boolean(readAt),
    readAt,
    href: `/my-bookings/${encodeURIComponent(String(row.bookingId))}`,
    serviceName,
    vendorName,
  };
}

function customerOwnedWhere(userId: string) {
  return {
    booking: { userId },
    ...customerNotificationKindWhere(),
  };
}

export async function listCustomerNotificationHistory(db: any, input: { userId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(Number(input.limit || 100), 100));
  const where = customerOwnedWhere(input.userId);
  const [rows, totalCount, unreadCount] = await Promise.all([
    db.bookingNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        bookingId: true,
        kind: true,
        channelsJson: true,
        createdAt: true,
        customerReadAt: true,
        booking: {
          select: {
            title: true,
            service: { select: { name: true } },
            vendor: { select: { name: true, businessName: true } },
          },
        },
      },
    }),
    db.bookingNotification.count({ where }),
    db.bookingNotification.count({ where: { ...where, customerReadAt: null } }),
  ]);
  const notifications: CustomerNotificationHistoryItem[] = rows.map((row: any) => shapeCustomerNotification(row));
  return {
    notifications,
    totalCount: Number(totalCount || 0),
    unreadCount: Number(unreadCount || 0),
    shownCount: notifications.length,
    shownUnreadCount: notifications.filter((notification) => !notification.read).length,
    limit,
  };
}

export async function markCustomerNotificationRead(db: any, input: { userId: string; notificationId: string }) {
  const readAt = new Date();
  const changed = await db.bookingNotification.updateMany({
    where: {
      id: input.notificationId,
      ...customerOwnedWhere(input.userId),
      customerReadAt: null,
    },
    data: { customerReadAt: readAt },
  });
  if (Number(changed?.count || 0) === 1) {
    return { found: true as const, changed: true, readAt };
  }

  const owned = await db.bookingNotification.findFirst({
    where: { id: input.notificationId, ...customerOwnedWhere(input.userId) },
    select: { id: true, customerReadAt: true },
  });
  if (!owned) return { found: false as const, changed: false };
  return { found: true as const, changed: false, readAt: owned.customerReadAt };
}

export async function markAllCustomerNotificationsRead(db: any, input: { userId: string }) {
  const readAt = new Date();
  const result = await db.bookingNotification.updateMany({
    where: { ...customerOwnedWhere(input.userId), customerReadAt: null },
    data: { customerReadAt: readAt },
  });
  return { changed: Number(result?.count || 0), readAt };
}
