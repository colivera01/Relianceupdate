// Typed contract checks for stabilized active domains.
// These checks are intentionally lightweight and framework-free so they can run
// in any environment (or be imported by future test runners).

export type BookingContract = {
  id: string;
  user_id: string;
  vendor_id: string;
  service_id: string;
  title: string | null;
  client_name: string | null;
  booking_date: string | null;
  booking_time: string | null;
  status: string;
  total_price: number;
  created_at: string;
  updated_at: string;
  service: {
    id: string;
    name: string;
    description: string;
    price: number;
  } | null;
  vendor: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    location: string | null;
  } | null;
};

export type BookingListResponse = {
  bookings: BookingContract[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type BookingDetailResponse = {
  booking: BookingContract;
};

export type BookingCancelResponse = {
  success: boolean;
  message: string;
  booking: BookingContract | null;
  cancellation_reason?: string;
  refund_requested?: boolean;
};

export type MediaSessionResponse = {
  session: {
    id: string;
    status: string;
    sessionType?: string;
  };
};

export type MediaUploadInitResponse = {
  assetId: string;
  blobKey: string;
  sasUrl?: string;
  uploadUrl?: string;
};

export type MediaUploadCompleteResponse = {
  asset: {
    id: string;
    mimeType?: string;
    bytes?: number | string;
  };
};

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

export function assertBookingContract(value: unknown): value is BookingContract {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.vendor_id === 'string' &&
    typeof value.service_id === 'string' &&
    typeof value.status === 'string' &&
    typeof value.total_price === 'number' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

export function assertBookingListResponse(value: unknown): value is BookingListResponse {
  if (!isObject(value) || !Array.isArray(value.bookings) || !isObject(value.pagination)) return false;
  return value.bookings.every(assertBookingContract);
}

export function assertBookingDetailResponse(value: unknown): value is BookingDetailResponse {
  if (!isObject(value) || !isObject(value.booking)) return false;
  return assertBookingContract(value.booking);
}

export function assertBookingCancelResponse(value: unknown): value is BookingCancelResponse {
  if (!isObject(value) || typeof value.success !== 'boolean' || typeof value.message !== 'string') return false;
  if (value.booking === null) return true;
  return assertBookingContract(value.booking);
}

export function assertMediaSessionResponse(value: unknown): value is MediaSessionResponse {
  return isObject(value) && isObject(value.session) && typeof value.session.id === 'string' && typeof value.session.status === 'string';
}

export function assertMediaUploadInitResponse(value: unknown): value is MediaUploadInitResponse {
  return isObject(value) && typeof value.assetId === 'string' && typeof value.blobKey === 'string';
}

export function assertMediaUploadCompleteResponse(value: unknown): value is MediaUploadCompleteResponse {
  return isObject(value) && isObject(value.asset) && typeof value.asset.id === 'string';
}

// Compile-time shape checks (typed contract tests).
const _bookingContractExample: BookingContract = {
  id: 'bk_1',
  user_id: 'u_1',
  vendor_id: 'v_1',
  service_id: 's_1',
  title: 'Service Job',
  client_name: 'Client',
  booking_date: '2026-01-01',
  booking_time: '09:00:00',
  status: 'pending',
  total_price: 100,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  service: { id: 's_1', name: 'Service', description: '', price: 100 },
  vendor: { id: 'v_1', name: 'Vendor', phone: null, email: null, location: null },
};

export const contractTypeCheckSamples = {
  booking: _bookingContractExample,
};
