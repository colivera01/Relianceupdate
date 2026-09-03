import { describe, expect, it, vi } from 'vitest';
import { changeCustomerServiceRecordOrganization } from '@/lib/customer-service-record-organization';

function database(input: {
  status?: string;
  owner?: string;
  completedPackage?: boolean;
  failFirstTransaction?: boolean;
} = {}) {
  const events: any[] = [];
  let transactionAttempts = 0;
  const booking = {
    id: 'booking-1',
    userId: input.owner || 'customer-1',
    status: input.status || 'COMPLETED',
  };
  const eventDelegate = {
    findFirst: vi.fn(async ({ where }: any) => {
      const matching = events.filter((event) =>
        event.bookingId === where.bookingId &&
        event.customerUserId === where.customerUserId &&
        (!where.requestId || event.requestId === where.requestId)
      );
      return [...matching].sort((a, b) => b.sequence - a.sequence)[0] || null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const event = { id: `event-${events.length + 1}`, ...data };
      events.push(event);
      return event;
    }),
  };
  const tx = {
    booking: { findUnique: vi.fn(async () => booking) },
    serviceVideoPackageEvidence: {
      findFirst: vi.fn(async () => input.completedPackage ? { id: 'package-1' } : null),
    },
    customerServiceRecordOrganizationEvent: eventDelegate,
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>, options: unknown) => {
      transactionAttempts += 1;
      if (input.failFirstTransaction && transactionAttempts === 1) {
        throw Object.assign(new Error('retry transaction'), { code: 'P2034' });
      }
      expect(options).toEqual({ isolationLevel: 'Serializable' });
      return callback(tx);
    }),
  };
  return { db, tx, events, get transactionAttempts() { return transactionAttempts; } };
}

function change(db: any, action: 'ARCHIVE' | 'RESTORE', requestId: string) {
  return changeCustomerServiceRecordOrganization({
    db,
    bookingId: 'booking-1',
    customerUserId: 'customer-1',
    action,
    requestId,
    now: new Date('2026-09-02T12:00:00.000Z'),
  });
}

describe('customer Service Record organization evidence', () => {
  it.each(['COMPLETED', 'CANCELLED'])('archives eligible %s lifecycle without changing Booking.status', async (status) => {
    const state = database({ status });
    const result = await change(state.db, 'ARCHIVE', 'request-1');
    expect(result.idempotent).toBe(false);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      bookingId: 'booking-1',
      customerUserId: 'customer-1',
      action: 'ARCHIVE',
      sequence: 1,
      requestId: 'request-1',
      evidenceVersion: 1,
    });
    expect((state.tx.booking as any).update).toBeUndefined();
  });

  it('accepts explicit completed package evidence for a historical review status', async () => {
    const state = database({ status: 'AWAITING_REVIEW', completedPackage: true });
    await expect(change(state.db, 'ARCHIVE', 'request-1')).resolves.toMatchObject({ idempotent: false });
  });

  it.each(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'UNRECOGNIZED'])('fails closed when %s is not archive eligible', async (status) => {
    const state = database({ status });
    await expect(change(state.db, 'ARCHIVE', 'request-1')).rejects.toThrow('CUSTOMER_ARCHIVE_LIFECYCLE_NOT_ELIGIBLE');
    expect(state.events).toHaveLength(0);
  });

  it('preserves ARCHIVE, RESTORE, ARCHIVE history and true lifecycle', async () => {
    const state = database({ status: 'CANCELLED' });
    await change(state.db, 'ARCHIVE', 'request-1');
    await change(state.db, 'RESTORE', 'request-2');
    await change(state.db, 'ARCHIVE', 'request-3');
    expect(state.events.map((event) => [event.action, event.sequence])).toEqual([
      ['ARCHIVE', 1],
      ['RESTORE', 2],
      ['ARCHIVE', 3],
    ]);
    expect(state.events[1].previousEventId).toBe(state.events[0].id);
    expect(state.events[2].previousEvidenceHash).toBe(state.events[1].evidenceHash);
  });

  it('returns the original evidence for an identical retry', async () => {
    const state = database();
    const first = await change(state.db, 'ARCHIVE', 'request-1');
    const retry = await change(state.db, 'ARCHIVE', 'request-1');
    expect(retry).toMatchObject({ idempotent: true, event: { id: first.event.id } });
    expect(state.events).toHaveLength(1);
  });

  it('fails closed when the same request ID carries a different action', async () => {
    const state = database();
    await change(state.db, 'ARCHIVE', 'request-1');
    await expect(change(state.db, 'RESTORE', 'request-1')).rejects.toThrow('CUSTOMER_ORGANIZATION_IDEMPOTENCY_CONFLICT');
    expect(state.events).toHaveLength(1);
  });

  it('treats duplicate state requests with new IDs as idempotent without duplicate events', async () => {
    const state = database();
    await change(state.db, 'ARCHIVE', 'request-1');
    const duplicate = await change(state.db, 'ARCHIVE', 'request-2');
    expect(duplicate.idempotent).toBe(true);
    expect(state.events).toHaveLength(1);
  });

  it('retries a serializable write conflict', async () => {
    const state = database({ failFirstTransaction: true });
    await expect(change(state.db, 'ARCHIVE', 'request-1')).resolves.toMatchObject({ idempotent: false });
    expect(state.transactionAttempts).toBe(2);
    expect(state.events).toHaveLength(1);
  });

  it('denies organization writes by the wrong customer', async () => {
    const state = database({ owner: 'another-customer' });
    await expect(change(state.db, 'ARCHIVE', 'request-1')).rejects.toThrow('CUSTOMER_SERVICE_RECORD_FORBIDDEN');
  });

  it('preserves legacy ARCHIVED rows and blocks unsafe restore', async () => {
    const state = database({ status: 'ARCHIVED' });
    await expect(change(state.db, 'RESTORE', 'request-1')).rejects.toThrow('LEGACY_ARCHIVE_RESTORE_UNAVAILABLE');
    expect(state.events).toHaveLength(0);
  });
});
