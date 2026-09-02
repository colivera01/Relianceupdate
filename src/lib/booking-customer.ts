import { resolveCanonicalCustomerRecipient } from "@/lib/customer-recipient";

type BookingCustomerSource = {
  clientName?: string | null;
  customerMetadata?: string | null;
  currentRecipientEmailHash?: string | null;
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function clean(value: unknown): string {
  return String(value || "").trim();
}

/** Work-order fields are authoritative; the linked account is only a fallback. */
export function resolveBookingCustomer(booking: BookingCustomerSource) {
  const metadata = parseMetadata(booking.customerMetadata);
  const recipient = resolveCanonicalCustomerRecipient({
    customerMetadata: metadata,
    linkedAccountEmail: booking.user?.email,
    currentRecipientEmailHash: booking.currentRecipientEmailHash,
  });
  return {
    id: clean(booking.user?.id) || null,
    name:
      clean(metadata.client_name) ||
      clean(booking.clientName) ||
      clean(booking.user?.name) ||
      null,
    email: recipient.email,
    phone: clean(metadata.client_phone) || clean(booking.user?.phone) || null,
  };
}
