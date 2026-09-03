import crypto from 'node:crypto';
import { deriveCustomerServiceRecordState } from '@/lib/customer-service-record-state';

export const CUSTOMER_SERVICE_RECORD_ORGANIZATION_EVIDENCE_VERSION = 1;
export const CUSTOMER_SERVICE_RECORD_ORGANIZATION_ACTIONS = ['ARCHIVE', 'RESTORE'] as const;
export type CustomerServiceRecordOrganizationAction =
  (typeof CUSTOMER_SERVICE_RECORD_ORGANIZATION_ACTIONS)[number];

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  );
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function normalizeCustomerOrganizationAction(
  value: unknown
): CustomerServiceRecordOrganizationAction | null {
  const normalized = String(value || '').trim().toUpperCase();
  return CUSTOMER_SERVICE_RECORD_ORGANIZATION_ACTIONS.includes(normalized as CustomerServiceRecordOrganizationAction)
    ? normalized as CustomerServiceRecordOrganizationAction
    : null;
}

export function buildCustomerOrganizationRequestHash(input: {
  bookingId: string;
  customerUserId: string;
  action: CustomerServiceRecordOrganizationAction;
  requestId: string;
}): string {
  return sha256(stableJson({
    action: input.action,
    bookingId: input.bookingId,
    customerUserId: input.customerUserId,
    requestId: input.requestId,
    version: CUSTOMER_SERVICE_RECORD_ORGANIZATION_EVIDENCE_VERSION,
  }));
}

export function buildCustomerOrganizationEvidenceHash(input: {
  bookingId: string;
  customerUserId: string;
  action: CustomerServiceRecordOrganizationAction;
  sequence: number;
  requestHash: string;
  previousEventId: string | null;
  previousEvidenceHash: string | null;
  actedAt: Date;
}): string {
  return sha256(stableJson({
    action: input.action,
    actedAt: input.actedAt.toISOString(),
    bookingId: input.bookingId,
    customerUserId: input.customerUserId,
    previousEvidenceHash: input.previousEvidenceHash,
    previousEventId: input.previousEventId,
    requestHash: input.requestHash,
    sequence: input.sequence,
    version: CUSTOMER_SERVICE_RECORD_ORGANIZATION_EVIDENCE_VERSION,
  }));
}

export async function changeCustomerServiceRecordOrganization(input: {
  db: any;
  bookingId: string;
  customerUserId: string;
  action: CustomerServiceRecordOrganizationAction;
  requestId: string;
  now?: Date;
}) {
  const requestHash = buildCustomerOrganizationRequestHash(input);
  const execute = () => input.db.$transaction(async (tx: any) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, userId: true, status: true },
    });
    if (!booking) throw new Error('CUSTOMER_SERVICE_RECORD_NOT_FOUND');
    if (String(booking.userId) !== input.customerUserId) throw new Error('CUSTOMER_SERVICE_RECORD_FORBIDDEN');

    const replay = await tx.customerServiceRecordOrganizationEvent.findFirst({
      where: {
        bookingId: input.bookingId,
        customerUserId: input.customerUserId,
        requestId: input.requestId,
      },
    });
    if (replay) {
      if (String(replay.requestHash) !== requestHash || String(replay.action) !== input.action) {
        throw new Error('CUSTOMER_ORGANIZATION_IDEMPOTENCY_CONFLICT');
      }
      return { event: replay, idempotent: true };
    }

    const latest = await tx.customerServiceRecordOrganizationEvent.findFirst({
      where: { bookingId: input.bookingId, customerUserId: input.customerUserId },
      orderBy: [{ sequence: 'desc' }, { actedAt: 'desc' }],
    });
    const completedPackage = await tx.serviceVideoPackageEvidence.findFirst({
      where: {
        bookingId: input.bookingId,
        isCurrent: true,
        status: {
          in: ['AWAITING_REVIEW', 'AWAITING_MANAGER_REVIEW', 'AWAITING_ADMIN_REVIEW', 'PRIVATE_APPROVED', 'ADMIN_REJECTED', 'REJECTED'],
        },
      },
      select: { id: true },
    });
    const currentState = deriveCustomerServiceRecordState({
      bookingStatus: booking.status,
      hasExplicitCompletedEvidence: Boolean(completedPackage),
      organizationEvents: latest ? [latest] : [],
    });

    if (currentState.organization === 'LEGACY_ARCHIVED') {
      throw new Error('LEGACY_ARCHIVE_RESTORE_UNAVAILABLE');
    }
    if (input.action === 'RESTORE' && !currentState.archived) {
      return { event: latest, idempotent: true };
    }
    if (input.action === 'ARCHIVE' && currentState.archived) {
      return { event: latest, idempotent: true };
    }
    if (input.action === 'ARCHIVE' && !currentState.archiveEligible) {
      throw new Error('CUSTOMER_ARCHIVE_LIFECYCLE_NOT_ELIGIBLE');
    }
    if (input.action === 'RESTORE' && !currentState.restoreEligible) {
      throw new Error('CUSTOMER_RESTORE_LIFECYCLE_NOT_ELIGIBLE');
    }

    const actedAt = input.now || new Date();
    const sequence = Number(latest?.sequence || 0) + 1;
    const evidenceHash = buildCustomerOrganizationEvidenceHash({
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      action: input.action,
      sequence,
      requestHash,
      previousEventId: latest?.id ? String(latest.id) : null,
      previousEvidenceHash: latest?.evidenceHash ? String(latest.evidenceHash) : null,
      actedAt,
    });
    const event = await tx.customerServiceRecordOrganizationEvent.create({
      data: {
        bookingId: input.bookingId,
        customerUserId: input.customerUserId,
        action: input.action,
        sequence,
        requestId: input.requestId,
        requestHash,
        previousEventId: latest?.id || null,
        previousEvidenceHash: latest?.evidenceHash || null,
        evidenceVersion: CUSTOMER_SERVICE_RECORD_ORGANIZATION_EVIDENCE_VERSION,
        evidenceHash,
        actedAt,
      },
    });
    return { event, idempotent: false };
  }, { isolationLevel: 'Serializable' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await execute();
    } catch (error: any) {
      const code = String(error?.code || '');
      if (code === 'P2002') {
        const replay = await input.db.customerServiceRecordOrganizationEvent.findFirst({
          where: {
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
            requestId: input.requestId,
          },
        });
        if (replay) {
          if (String(replay.requestHash) !== requestHash || String(replay.action) !== input.action) {
            throw new Error('CUSTOMER_ORGANIZATION_IDEMPOTENCY_CONFLICT');
          }
          return { event: replay, idempotent: true };
        }
      }
      if ((code === 'P2002' || code === 'P2034') && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('CUSTOMER_ORGANIZATION_CONCURRENCY_FAILED');
}
