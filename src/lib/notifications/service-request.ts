import { prisma } from "@/server/db";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { readServiceRequestLifecycle } from "@/lib/service-request-lifecycle";

export const SERVICE_REQUEST_NOTIFICATION_PREFIX = "SERVICE_REQUEST_";

export type ServiceRequestNotificationEvent =
  | "NEW_REQUEST_CUSTOMER"
  | "NEW_REQUEST_VENDOR"
  | "ACCEPTED_CUSTOMER"
  | "DECLINED_CUSTOMER"
  | "COUNTEROFFER_CUSTOMER"
  | "COUNTER_ACCEPTED_VENDOR"
  | "COUNTER_DECLINED_VENDOR"
  | "CUSTOMER_CANCELED_VENDOR"
  | "REMINDER_CUSTOMER"
  | "REMINDER_VENDOR";

type Recipient = {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  membershipId?: string | null;
};

type NotificationPayload = {
  version: 1;
  event: ServiceRequestNotificationEvent;
  recipient: Recipient;
  subject: string;
  eyebrow: string;
  headline: string;
  bodyText: string;
  bodyHtml: string;
  smsText: string;
  targetUrl: string;
};

type ChannelResult = {
  channel: "email" | "sms";
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

function normalizedPhone(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return digits ? `+${digits}` : null;
}

function parseMetadata(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function appBaseUrl(value?: string | null) {
  return String(value || process.env.APP_BASE_URL || "https://beta.relianceonline.org")
    .trim()
    .replace(/\/+$/, "");
}

function scheduleLabel(value: Date | string | null | undefined) {
  if (!value) return "a time the vendor will confirm with you";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the requested appointment time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function isServiceRequestNotificationKind(kind: unknown) {
  return String(kind || "").startsWith(SERVICE_REQUEST_NOTIFICATION_PREFIX);
}

export function buildServiceRequestNotificationCopy(input: {
  event: ServiceRequestNotificationEvent;
  vendorName: string;
  customerName: string;
  serviceName: string;
  scheduledFor?: Date | string | null;
  reason?: string | null;
  serviceAddress?: string | null;
  targetUrl: string;
}) {
  const vendorName = input.vendorName || "The service provider";
  const customerName = input.customerName || "A customer";
  const serviceName = input.serviceName || "the requested service";
  const when = scheduleLabel(input.scheduledFor);
  const reason = String(input.reason || "").trim();
  const address = String(input.serviceAddress || "").trim();
  const reasonLine = reason ? ` Reason: ${reason}` : "";
  const addressLine = address ? ` Service address: ${address}.` : "";
  const linkLine = ` Open Reliance: ${input.targetUrl}`;

  switch (input.event) {
    case "NEW_REQUEST_CUSTOMER":
      return {
        subject: `Service request sent to ${vendorName}`,
        eyebrow: "Service request sent",
        headline: "Waiting for the business to respond",
        body: `Your request for ${serviceName} was sent to ${vendorName} for ${when}. This is a request, not a confirmed appointment. Reliance will notify you when the business accepts, declines, or proposes another time.`,
        sms: `Reliance: Your ${serviceName} request was sent to ${vendorName} for ${when}. It is not confirmed yet.${linkLine}`,
      };
    case "NEW_REQUEST_VENDOR":
      return {
        subject: `New service request: ${serviceName}`,
        eyebrow: "New customer request",
        headline: `${customerName} requested ${serviceName}`,
        body: `${customerName} requested ${serviceName} for ${when}.${addressLine} Accept, decline, or propose another time in Reliance.`,
        sms: `Reliance: New ${serviceName} request from ${customerName} for ${when}.${addressLine}${linkLine}`,
      };
    case "ACCEPTED_CUSTOMER":
      return {
        subject: `${vendorName} accepted your service request`,
        eyebrow: "Request accepted",
        headline: "Your appointment is scheduled",
        body: `${vendorName} accepted your ${serviceName} request for ${when}. You can review or cancel the Service Record in Reliance.`,
        sms: `Reliance: ${vendorName} accepted your ${serviceName} request for ${when}.${linkLine}`,
      };
    case "DECLINED_CUSTOMER":
      return {
        subject: `${vendorName} could not accept your service request`,
        eyebrow: "Request declined",
        headline: "The business could not accept this request",
        body: `${vendorName} declined your ${serviceName} request.${reasonLine} You may return to Reliance to choose another service.`,
        sms: `Reliance: ${vendorName} declined your ${serviceName} request.${reasonLine}${linkLine}`,
      };
    case "COUNTEROFFER_CUSTOMER":
      return {
        subject: `${vendorName} proposed a new service time`,
        eyebrow: "New time proposed",
        headline: "Review the business's proposed time",
        body: `${vendorName} proposed ${when} for ${serviceName}.${reasonLine} The appointment is not scheduled until you accept the new time.`,
        sms: `Reliance: ${vendorName} proposed ${when} for ${serviceName}.${reasonLine} Accept or decline in Reliance.${linkLine}`,
      };
    case "COUNTER_ACCEPTED_VENDOR":
      return {
        subject: `${customerName} accepted the proposed service time`,
        eyebrow: "Proposed time accepted",
        headline: `${serviceName} is scheduled`,
        body: `${customerName} accepted ${when} for ${serviceName}. The appointment is now scheduled in Reliance.`,
        sms: `Reliance: ${customerName} accepted ${when} for ${serviceName}.${linkLine}`,
      };
    case "COUNTER_DECLINED_VENDOR":
      return {
        subject: `${customerName} declined the proposed service time`,
        eyebrow: "Proposed time declined",
        headline: "The customer declined the proposed time",
        body: `${customerName} declined ${when} for ${serviceName}.${reasonLine} The Service Request is closed.`,
        sms: `Reliance: ${customerName} declined ${when} for ${serviceName}.${reasonLine}${linkLine}`,
      };
    case "CUSTOMER_CANCELED_VENDOR":
      return {
        subject: `${customerName} canceled a service request`,
        eyebrow: "Customer cancellation",
        headline: `${serviceName} was canceled`,
        body: `${customerName} canceled the ${serviceName} request scheduled for ${when}.${reasonLine}`,
        sms: `Reliance: ${customerName} canceled ${serviceName} for ${when}.${reasonLine}${linkLine}`,
      };
    case "REMINDER_VENDOR":
      return {
        subject: `Upcoming service: ${serviceName}`,
        eyebrow: "24-hour appointment reminder",
        headline: `${serviceName} is coming up`,
        body: `${customerName}'s ${serviceName} appointment is scheduled for ${when}.${addressLine}`,
        sms: `Reliance reminder: ${serviceName} for ${customerName} is scheduled for ${when}.${addressLine}${linkLine}`,
      };
    case "REMINDER_CUSTOMER":
    default:
      return {
        subject: `Upcoming service with ${vendorName}`,
        eyebrow: "24-hour appointment reminder",
        headline: `${serviceName} is coming up`,
        body: `Your ${serviceName} appointment with ${vendorName} is scheduled for ${when}.`,
        sms: `Reliance reminder: ${serviceName} with ${vendorName} is scheduled for ${when}.${linkLine}`,
      };
  }
}

async function enqueueOne(db: any, input: {
  bookingId: string;
  event: ServiceRequestNotificationEvent;
  dedupeKey: string;
  recipient: Recipient;
  vendorName: string;
  customerName: string;
  serviceName: string;
  scheduledFor?: Date | string | null;
  reason?: string | null;
  serviceAddress?: string | null;
  targetUrl: string;
}) {
  const copy = buildServiceRequestNotificationCopy(input);
  const payload: NotificationPayload = {
    version: 1,
    event: input.event,
    recipient: {
      ...input.recipient,
      phone: normalizedPhone(input.recipient.phone),
    },
    subject: copy.subject,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    bodyText: copy.body,
    bodyHtml: `<p>${escapeRelianceEmailHtml(copy.body)}</p>`,
    smsText: copy.sms,
    targetUrl: input.targetUrl,
  };
  const kind = `${SERVICE_REQUEST_NOTIFICATION_PREFIX}${input.event}_V1:${input.dedupeKey}:${input.recipient.key}`;
  return db.bookingNotification.upsert({
    where: { bookingId_kind: { bookingId: input.bookingId, kind } },
    create: {
      bookingId: input.bookingId,
      kind,
      status: "QUEUED",
      channelsJson: JSON.stringify({ payload, delivery: [] }),
      idempotencyKey: kind,
      maxAttempts: 4,
    },
    update: {},
  });
}

async function loadBookingForNotification(db: any, bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      title: true,
      clientName: true,
      vendorId: true,
      scheduledFor: true,
      createdAt: true,
      customerMetadata: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      vendor: {
        select: {
          id: true,
          name: true,
          businessName: true,
          email: true,
          phone: true,
          notifications_job: true,
        },
      },
      service: { select: { name: true } },
    },
  });
}

function bookingNames(booking: any) {
  const metadata = parseMetadata(booking.customerMetadata);
  const customFields = metadata.custom_fields && typeof metadata.custom_fields === "object"
    ? metadata.custom_fields as Record<string, unknown>
    : {};
  return {
    vendorName: String(booking.vendor?.businessName || booking.vendor?.name || "Service provider"),
    customerName: String(booking.clientName || booking.user?.name || "Customer"),
    customerPhone: String(metadata.client_phone || "").trim() || null,
    serviceName: String(booking.service?.name || booking.title || "Service"),
    serviceAddress: String(customFields.service_address || metadata.service_address || "").trim() || null,
  };
}

async function activeManagers(db: any, vendorId: string) {
  return db.vendorMembership.findMany({
    where: { vendorId, role: "MANAGER", status: "ACTIVE" },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}

async function createDurableManagerNotice(db: any, input: {
  bookingId: string;
  vendorId: string;
  notificationId: string;
  event: ServiceRequestNotificationEvent;
  dedupeKey: string;
  membershipId: string;
  title: string;
  message: string;
}) {
  const notificationType = `VENDOR_${input.event}_V1`;
  const sourceId = `service-request:${input.bookingId}:${input.event}:${input.dedupeKey}`;
  return db.vendorManagerNotification.upsert({
    where: {
      sourceAdminDecisionId_recipientMembershipId_notificationType: {
        sourceAdminDecisionId: sourceId,
        recipientMembershipId: input.membershipId,
        notificationType,
      },
    },
    create: {
      vendorId: input.vendorId,
      bookingId: input.bookingId,
      packageId: `service-request:${input.bookingId}`,
      sourceAdminDecisionId: sourceId,
      sourceBookingNotificationId: input.notificationId,
      recipientMembershipId: input.membershipId,
      notificationType,
      title: input.title,
      message: input.message,
      targetUrl: `/vendor/jobs/${encodeURIComponent(input.bookingId)}`,
    },
    update: {},
  });
}

export async function enqueueServiceRequestCustomerEvent(input: {
  db: any;
  bookingId: string;
  event: Exclude<ServiceRequestNotificationEvent, "NEW_REQUEST_VENDOR" | "COUNTER_ACCEPTED_VENDOR" | "COUNTER_DECLINED_VENDOR" | "CUSTOMER_CANCELED_VENDOR" | "REMINDER_VENDOR">;
  actorUserId: string;
  baseUrl?: string;
  reason?: string | null;
  scheduledFor?: Date | string | null;
  dedupeKey?: string;
}) {
  const booking = await loadBookingForNotification(input.db, input.bookingId);
  if (!booking) return [];
  const names = bookingNames(booking);
  const notification = await enqueueOne(input.db, {
    bookingId: booking.id,
    event: input.event,
    dedupeKey: input.dedupeKey || input.event.toLowerCase(),
    recipient: {
      key: `customer:${booking.userId}`,
      name: booking.user?.name || booking.clientName || null,
      email: booking.user?.email || null,
      phone: names.customerPhone || booking.user?.phone || null,
    },
    ...names,
    scheduledFor: input.scheduledFor === undefined ? booking.scheduledFor : input.scheduledFor,
    reason: input.reason,
    targetUrl: `${appBaseUrl(input.baseUrl)}/my-bookings/${encodeURIComponent(booking.id)}`,
  });
  return [notification];
}

export async function enqueueServiceRequestVendorEvent(input: {
  db: any;
  bookingId: string;
  event: "NEW_REQUEST_VENDOR" | "COUNTER_ACCEPTED_VENDOR" | "COUNTER_DECLINED_VENDOR" | "CUSTOMER_CANCELED_VENDOR" | "REMINDER_VENDOR";
  actorUserId: string;
  baseUrl?: string;
  reason?: string | null;
  scheduledFor?: Date | string | null;
  dedupeKey?: string;
}) {
  const booking = await loadBookingForNotification(input.db, input.bookingId);
  if (!booking) return [];
  const names = bookingNames(booking);
  const managers = await activeManagers(input.db, booking.vendorId);
  const recipients = managers.length
    ? managers.map((manager: any) => ({
        key: `manager:${manager.id}`,
        membershipId: manager.id,
        name: manager.user?.name || null,
        email: booking.vendor?.notifications_job === false ? null : manager.user?.email || null,
        phone: booking.vendor?.notifications_job === false ? null : manager.user?.phone || null,
      }))
    : [{
        key: `vendor:${booking.vendorId}`,
        membershipId: null,
        name: booking.vendor?.businessName || booking.vendor?.name || null,
        email: booking.vendor?.notifications_job === false ? null : booking.vendor?.email || null,
        phone: booking.vendor?.notifications_job === false ? null : booking.vendor?.phone || null,
      }];
  const dedupeKey = input.dedupeKey || input.event.toLowerCase();
  const notifications = [];
  for (const recipient of recipients) {
    const targetUrl = `${appBaseUrl(input.baseUrl)}/vendor/jobs/${encodeURIComponent(booking.id)}`;
    const notification = await enqueueOne(input.db, {
      bookingId: booking.id,
      event: input.event,
      dedupeKey,
      recipient,
      ...names,
      scheduledFor: input.scheduledFor === undefined ? booking.scheduledFor : input.scheduledFor,
      reason: input.reason,
      targetUrl,
    });
    notifications.push(notification);
    if (recipient.membershipId) {
      const copy = buildServiceRequestNotificationCopy({
        event: input.event,
        ...names,
        scheduledFor: input.scheduledFor === undefined ? booking.scheduledFor : input.scheduledFor,
        reason: input.reason,
        targetUrl,
      });
      await createDurableManagerNotice(input.db, {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        notificationId: notification.id,
        event: input.event,
        dedupeKey,
        membershipId: recipient.membershipId,
        title: copy.headline,
        message: copy.body,
      });
    }
  }
  return notifications;
}

export async function enqueueNewServiceRequestNotifications(input: {
  db: any;
  bookingId: string;
  actorUserId: string;
  baseUrl?: string;
}) {
  const customer = await enqueueServiceRequestCustomerEvent({
    ...input,
    event: "NEW_REQUEST_CUSTOMER",
    dedupeKey: "created",
  });
  const vendor = await enqueueServiceRequestVendorEvent({
    ...input,
    event: "NEW_REQUEST_VENDOR",
    dedupeKey: "created",
  });
  return [...customer, ...vendor];
}

function maskedDestination(channel: "email" | "sms", recipient: Recipient) {
  if (channel === "email") {
    const value = String(recipient.email || "");
    const [local, domain] = value.split("@");
    return local && domain ? `${local.slice(0, 2)}***@${domain}` : null;
  }
  const value = String(recipient.phone || "");
  return value ? `***${value.slice(-4)}` : null;
}

function parseEnvelope(value: unknown): { payload: NotificationPayload | null; delivery: ChannelResult[] } {
  const parsed = parseMetadata(value);
  const payload = parsed.payload && typeof parsed.payload === "object"
    ? parsed.payload as NotificationPayload
    : null;
  const delivery = Array.isArray(parsed.delivery) ? parsed.delivery as ChannelResult[] : [];
  return { payload, delivery };
}

export async function dispatchServiceRequestNotification(input: {
  notificationId: string;
  actorUserId: string;
  db?: any;
}) {
  const db = input.db || prisma;
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await db.bookingNotification.updateMany({
    where: {
      id: input.notificationId,
      OR: [
        { status: "QUEUED" },
        { status: "FAILED" },
        { status: "SENDING", lastAttemptAt: { lt: staleBefore } },
      ],
      deadLetteredAt: null,
    },
    data: {
      status: "SENDING",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
      leaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  if (Number(claimed?.count || 0) !== 1) {
    return db.bookingNotification.findUnique({ where: { id: input.notificationId } });
  }
  const row = await db.bookingNotification.findUnique({ where: { id: input.notificationId } });
  const envelope = parseEnvelope(row?.channelsJson);
  if (!row || !envelope.payload) {
    return db.bookingNotification.update({
      where: { id: input.notificationId },
      data: { status: "FAILED", lastError: "service_request_notification_payload_missing", leaseExpiresAt: null },
    });
  }
  const payload = envelope.payload;
  const previousSuccess = new Set(envelope.delivery.filter((item) => item.success).map((item) => item.channel));
  const env = readNotificationEnv();
  const results: ChannelResult[] = [];
  if (previousSuccess.has("email")) {
    results.push(envelope.delivery.find((item) => item.channel === "email" && item.success)!);
  } else if (env.emailEnabled && payload.recipient.email) {
    const result = await sendEmail({
      to: payload.recipient.email,
      subject: payload.subject,
      text: `${payload.bodyText}\n\n${payload.targetUrl}`,
      html: buildRelianceEmailHtml({
        eyebrow: payload.eyebrow,
        headline: payload.headline,
        greeting: payload.recipient.name ? `Hi ${escapeRelianceEmailHtml(payload.recipient.name)},` : "Hi,",
        bodyHtml: payload.bodyHtml,
        secondaryHtml: `<p><a href="${escapeRelianceEmailHtml(payload.targetUrl)}">Open Reliance</a></p>`,
      }),
    });
    results.push({ channel: "email", attempted: true, success: result.ok, providerMessageId: result.providerMessageId, errorMessage: result.errorMessage });
  } else {
    results.push({ channel: "email", attempted: false, success: false, errorMessage: payload.recipient.email ? "email_disabled" : "email_unavailable" });
  }
  if (previousSuccess.has("sms")) {
    results.push(envelope.delivery.find((item) => item.channel === "sms" && item.success)!);
  } else if (env.smsEnabled && payload.recipient.phone) {
    const result = await sendSms({ to: payload.recipient.phone, body: payload.smsText });
    results.push({ channel: "sms", attempted: true, success: result.ok, providerMessageId: result.providerMessageId, errorCode: result.errorCode, errorMessage: result.errorMessage });
  } else {
    results.push({ channel: "sms", attempted: false, success: false, errorMessage: payload.recipient.phone ? "sms_disabled" : "sms_unavailable" });
  }
  const attemptNumber = Number(row.attemptCount || 1);
  for (const result of results) {
    if (previousSuccess.has(result.channel)) continue;
    await db.bookingNotificationAttempt.create({
      data: {
        notificationId: row.id,
        consentRecordId: null,
        channel: result.channel,
        destinationMasked: maskedDestination(result.channel, payload.recipient),
        status: result.attempted ? (result.success ? "SENT" : "FAILED") : "SKIPPED",
        attemptNumber,
        providerMessageId: result.providerMessageId || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
      },
    });
    if (result.attempted) {
      await logNotificationAttempt(input.actorUserId, row.bookingId, {
        kind: payload.event.toLowerCase(),
        channel: result.channel,
        recipient: (result.channel === "email" ? payload.recipient.email : payload.recipient.phone) || "unavailable",
        success: result.success,
        providerMessageId: result.providerMessageId,
        fallbackLink: payload.targetUrl,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    }
  }
  const attemptedFailures = results.filter((item) => item.attempted && !item.success);
  const successes = results.filter((item) => item.success);
  const status = attemptedFailures.length ? "FAILED" : successes.length ? "SENT" : "SKIPPED";
  return db.bookingNotification.update({
    where: { id: row.id },
    data: {
      status,
      channelsJson: JSON.stringify({ payload, delivery: results }),
      lastError: attemptedFailures.map((item) => item.errorMessage || `${item.channel}_failed`).join("; ").slice(0, 2000) || null,
      sentAt: successes.length ? new Date() : null,
      nextAttemptAt: status === "FAILED" ? new Date(Date.now() + 15 * 60 * 1000) : null,
      leaseExpiresAt: null,
    },
  });
}

export async function dispatchServiceRequestNotifications(rows: Array<{ id: string }>, actorUserId: string, db?: any) {
  const results = [];
  for (const row of rows) {
    results.push(await dispatchServiceRequestNotification({ notificationId: row.id, actorUserId, db }));
  }
  return results;
}

export async function enqueueServiceRequestAppointmentReminders(input: {
  db: any;
  now?: Date;
  baseUrl?: string;
}) {
  const now = input.now || new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const bookings: any[] = [];
  let cursor: string | null = null;
  // The worker runs every five minutes. Page deterministically through the
  // entire 24-hour window so already-upserted early appointments cannot starve
  // later reminders. The cap is a safety bound; another run continues safely.
  for (let page = 0; page < 50; page += 1) {
    const batch: any[] = await input.db.booking.findMany({
      where: {
        status: "CONFIRMED",
        scheduledFor: { gt: now, lte: end },
      },
      select: { id: true, createdAt: true, scheduledFor: true, customerMetadata: true },
      orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    bookings.push(...batch);
    if (batch.length < 100) break;
    cursor = String(batch[batch.length - 1].id);
  }
  const queued = [];
  for (const booking of bookings) {
    const lifecycle = readServiceRequestLifecycle(booking.customerMetadata, {
      requestedAt: booking.createdAt,
      scheduledFor: booking.scheduledFor,
    });
    if (!lifecycle.history.length || !["VENDOR_ACCEPTED", "SCHEDULED"].includes(lifecycle.state)) continue;
    const reminderKey = `24h:${booking.scheduledFor?.toISOString?.() || String(booking.scheduledFor || "unscheduled")}`;
    queued.push(...await enqueueServiceRequestCustomerEvent({
      db: input.db,
      bookingId: booking.id,
      event: "REMINDER_CUSTOMER",
      actorUserId: "service-request-reminder-worker",
      baseUrl: input.baseUrl,
      scheduledFor: booking.scheduledFor,
      dedupeKey: reminderKey,
    }));
    queued.push(...await enqueueServiceRequestVendorEvent({
      db: input.db,
      bookingId: booking.id,
      event: "REMINDER_VENDOR",
      actorUserId: "service-request-reminder-worker",
      baseUrl: input.baseUrl,
      scheduledFor: booking.scheduledFor,
      dedupeKey: reminderKey,
    }));
  }
  return queued;
}
