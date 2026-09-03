import { prisma } from '@/server/db';
import { loadAuthorizedPrivateProof } from '@/lib/service-video-evidence';

export type CustomerReviewEligibilityCode =
  | 'ELIGIBLE'
  | 'BOOKING_NOT_FOUND'
  | 'WRONG_CUSTOMER'
  | 'SERVICE_NOT_COMPLETED'
  | 'PRIVATE_PROOF_REQUIRED'
  | 'REVIEW_ALREADY_EXISTS';

export type CustomerReviewEligibility = {
  eligible: boolean;
  code: CustomerReviewEligibilityCode;
  message: string;
  bookingId: string;
  vendorId: string | null;
  existingReviewId: string | null;
  mediaSessionId: string | null;
};

export function deriveCustomerReviewEligibility(input: {
  bookingId: string;
  vendorId?: string | null;
  ownsBooking: boolean;
  serviceCompleted: boolean;
  privateProofAvailable: boolean;
  existingReviewId?: string | null;
  mediaSessionId?: string | null;
}): CustomerReviewEligibility {
  const base = {
    bookingId: input.bookingId,
    vendorId: input.vendorId || null,
    existingReviewId: input.existingReviewId || null,
    mediaSessionId: input.mediaSessionId || null,
  };
  if (!input.ownsBooking) {
    return { ...base, eligible: false, code: 'WRONG_CUSTOMER', message: 'This Service Record does not belong to this customer.' };
  }
  if (!input.serviceCompleted) {
    return { ...base, eligible: false, code: 'SERVICE_NOT_COMPLETED', message: 'A Customer Review is available after the service is completed.' };
  }
  if (!input.privateProofAvailable || !input.mediaSessionId) {
    return { ...base, eligible: false, code: 'PRIVATE_PROOF_REQUIRED', message: 'Review will be available when your Service Video is approved.' };
  }
  if (input.existingReviewId) {
    return { ...base, eligible: false, code: 'REVIEW_ALREADY_EXISTS', message: 'A Customer Review already exists for this Service Record.' };
  }
  return { ...base, eligible: true, code: 'ELIGIBLE', message: 'You can leave a Customer Review now.' };
}

export async function loadCustomerReviewEligibility(input: {
  bookingId: string;
  customerUserId: string;
  db?: any;
}): Promise<CustomerReviewEligibility> {
  const db = input.db || prisma;
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, userId: true, vendorId: true, status: true },
  });
  if (!booking) {
    return {
      eligible: false,
      code: 'BOOKING_NOT_FOUND',
      message: 'Service Record not found.',
      bookingId: input.bookingId,
      vendorId: null,
      existingReviewId: null,
      mediaSessionId: null,
    };
  }

  const ownsBooking = String(booking.userId) === String(input.customerUserId);
  if (!ownsBooking) {
    return deriveCustomerReviewEligibility({
      bookingId: String(booking.id),
      vendorId: String(booking.vendorId),
      ownsBooking: false,
      serviceCompleted: false,
      privateProofAvailable: false,
    });
  }

  const [existingReview, privateProof] = await Promise.all([
    db.review.findFirst({
      where: { bookingId: input.bookingId, userId: input.customerUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    loadAuthorizedPrivateProof({
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      db,
    }),
  ]);
  const finalStage = privateProof?.stages.find(
    (stage: any) => String(stage.stage || '').toUpperCase() === 'COMPLETED'
  );
  const bookingStatus = String(booking.status || '').trim().toUpperCase();
  const serviceCompleted = ['COMPLETED', 'COMPLETE'].includes(bookingStatus) ||
    (Boolean(privateProof?.package) && ['ARCHIVED', 'AWAITING_REVIEW', 'AWAITING_MANAGER_REVIEW'].includes(bookingStatus));

  return deriveCustomerReviewEligibility({
    bookingId: String(booking.id),
    vendorId: String(booking.vendorId),
    ownsBooking: true,
    serviceCompleted,
    privateProofAvailable: Boolean(privateProof),
    existingReviewId: existingReview?.id ? String(existingReview.id) : null,
    mediaSessionId: finalStage?.mediaSessionId ? String(finalStage.mediaSessionId) : null,
  });
}
