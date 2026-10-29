import {
  cleanPublicServiceDescription,
  cleanPublicServiceName,
  cleanPublicServicePrice,
} from '@/lib/launch-content-cleanup';
import { dateAndTimeInZone, DEFAULT_SERVICE_TIME_ZONE } from '@/lib/booking-schedule';

type BookingLike = {
  id: string;
  userId: string;
  vendorId: string;
  serviceId: string;
  title: string | null;
  clientName: string | null;
  amount: any;
  /** DB `NVARCHAR(MAX)` JSON — expected shape: `{ user_notes?, client_email?, client_phone?, custom_fields? }` */
  customerMetadata?: unknown;
  status: string;
  scheduledFor: Date | null;
  date: Date | null;
  createdAt: Date;
  updatedAt: Date;
  service?: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
  };
  vendor?: {
    id: string;
    name: string;
    businessName?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
  };
};

function customerMetadataToContract(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return customerMetadataToContract(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length > 0) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function mapBookingToContract(booking: BookingLike) {
  // A request without a chosen appointment intentionally has no service date.
  // Never substitute the record creation time; that makes an unscheduled request
  // look like a confirmed appointment in customer-facing Service Records.
  const at = booking.scheduledFor || booking.date;
  const customerMetadata = customerMetadataToContract(booking.customerMetadata);
  const serviceTimeZone = String(customerMetadata?.service_time_zone || '').trim() || DEFAULT_SERVICE_TIME_ZONE;
  const localSchedule = at ? dateAndTimeInZone(at, serviceTimeZone) : null;
  const safeStatus = String(booking.status || 'PENDING').toLowerCase();
  const servicePrice = booking.service?.price ?? 0;
  const amountRaw = booking.amount;
  const amountNum =
    amountRaw !== null && amountRaw !== undefined && String(amountRaw).trim() !== ''
      ? Number(amountRaw)
      : NaN;
  const total = Number.isFinite(amountNum) ? amountNum : Number(servicePrice);
  const vendorDisplayName = booking.vendor?.businessName || booking.vendor?.name || '';

  return {
    id: booking.id,
    user_id: booking.userId,
    vendor_id: booking.vendorId,
    service_id: booking.serviceId,
    title: booking.title,
    client_name: booking.clientName,
    booking_date: localSchedule?.date || null,
    booking_time: localSchedule ? `${localSchedule.time}:00` : null,
    scheduled_for: at?.toISOString() || null,
    service_time_zone: serviceTimeZone,
    status: safeStatus,
    total_price: total,
    created_at: booking.createdAt.toISOString(),
    updated_at: booking.updatedAt.toISOString(),
    service: booking.service
      ? {
          id: booking.service.id,
          name: cleanPublicServiceName(booking.service.name, vendorDisplayName),
          description: cleanPublicServiceDescription(
            booking.service.description || '',
            vendorDisplayName
          ),
          price:
            cleanPublicServicePrice(
              booking.service.price,
              booking.service.name,
              booking.service.description || ''
            ) ?? Number(booking.service.price),
        }
      : null,
    vendor: booking.vendor
      ? {
          id: booking.vendor.id,
          name: booking.vendor.businessName || booking.vendor.name,
          phone: booking.vendor.phone || null,
          email: booking.vendor.email || null,
          location: [booking.vendor.city, booking.vendor.state].filter(Boolean).join(', ') || null,
        }
      : null,
    customer_metadata: customerMetadata,
  };
}
