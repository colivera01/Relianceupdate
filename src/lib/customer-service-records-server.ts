import { mapBookingToContract } from '@/lib/booking-shape';
import { deriveCustomerBookingLifecycle } from '@/lib/customer-booking-lifecycle';
import {
  CUSTOMER_RECORD_LIFECYCLES,
  customerRecordMatchesTab,
  deriveCustomerServiceRecordState,
  type CustomerRecordTab,
  type CustomerServiceRecordState,
} from '@/lib/customer-service-record-state';

const CUSTOMER_RECORD_TABS = new Set<CustomerRecordTab>([
  'upcoming',
  'completed',
  'needs_attention',
  'cancelled',
  'archived',
  'unclassified',
]);

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function normalized(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function mapLatestByBooking<T extends { bookingId: string }>(rows: T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    if (!result.has(String(row.bookingId))) result.set(String(row.bookingId), row);
  }
  return result;
}

function cancellationFromBooking(input: {
  booking: any;
  outcome?: any;
}): { actorLabel: string | null; reason: string | null; cancelledAt: Date | string | null } | null {
  const metadata = parseJsonRecord(input.booking.customerMetadata);
  const cancellation = parseJsonRecord(metadata.vendor_job_cancellation);
  const outcomeMetadata = parseJsonRecord(input.outcome?.metadata);
  const reason = String(
    cancellation.reason || outcomeMetadata.cancellationReason || ''
  ).trim() || null;
  const cancelledAt = cancellation.canceled_at || input.outcome?.finalizedAt || null;
  if (!reason && !cancelledAt && !['CANCELED', 'CANCELLED'].includes(normalized(input.booking.status))) {
    return null;
  }

  const source = normalized(cancellation.source);
  const cancelledByUserId = String(cancellation.canceled_by_user_id || input.outcome?.finalizedByUserId || '').trim();
  const cancelledByMembershipId = String(cancellation.canceled_by_membership_id || '').trim();
  let actorLabel: string | null = null;
  if (
    source === 'CUSTOMER_RECORDING_PERMISSION_DECLINE' ||
    source === 'CUSTOMER_CANCELLATION' ||
    cancelledByUserId === String(input.booking.userId) ||
    cancelledByUserId === 'verified-permission-recipient'
  ) {
    actorLabel = 'Customer';
  } else if (cancelledByMembershipId) {
    actorLabel = input.booking.vendor?.businessName || input.booking.vendor?.name || 'Service provider';
  }

  return { actorLabel, reason, cancelledAt: cancelledAt as Date | string | null };
}

function recordMatchesSearch(record: any, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    record.id,
    record.title,
    record.service?.name,
    record.vendor?.businessName,
    record.vendor?.name,
  ].some((value) => String(value || '').toLocaleLowerCase().includes(query));
}

function defaultTab(counts: CustomerServiceRecordCounts): CustomerRecordTab {
  if (counts.upcoming > 0) return 'upcoming';
  if (counts.completed > 0) return 'completed';
  if (counts.cancelled > 0) return 'cancelled';
  if (counts.archived > 0) return 'archived';
  if (counts.unclassified > 0) return 'unclassified';
  return 'upcoming';
}

export type CustomerServiceRecordCounts = {
  upcoming: number;
  completed: number;
  needs_attention: number;
  cancelled: number;
  archived: number;
  unclassified: number;
};

export type CustomerServiceRecordListResult = {
  records: Array<Record<string, unknown> & { customer_record: CustomerServiceRecordState }>;
  counts: CustomerServiceRecordCounts;
  selectedTab: CustomerRecordTab;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ResolvedCustomerServiceRecord = {
  source: any;
  contract: Record<string, unknown> & { customer_record: CustomerServiceRecordState };
  state: CustomerServiceRecordState;
};

export async function loadCustomerServiceRecords(input: {
  db: any;
  customerUserId: string;
  requestedTab?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
  bookingId?: string | null;
  includeAll?: boolean;
}): Promise<CustomerServiceRecordListResult> {
  const { db, customerUserId } = input;
  const safePage = Number.isFinite(input.page) && Number(input.page) > 0 ? Math.floor(Number(input.page)) : 1;
  const safeLimit = Number.isFinite(input.limit)
    ? Math.max(1, Math.min(Math.floor(Number(input.limit)), 50))
    : 10;

  const bookings = await db.booking.findMany({
    where: {
      userId: customerUserId,
      ...(input.bookingId ? { id: String(input.bookingId) } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      userId: true,
      vendorId: true,
      serviceId: true,
      title: true,
      clientName: true,
      amount: true,
      status: true,
      scheduledFor: true,
      date: true,
      createdAt: true,
      updatedAt: true,
      customerMetadata: true,
      service: { select: { id: true, name: true, description: true, price: true } },
      vendor: {
        select: {
          id: true,
          name: true,
          businessName: true,
          phone: true,
          email: true,
          city: true,
          state: true,
        },
      },
      mediaSessions: {
        where: { sessionType: 'JOB_SERVICE_VIDEO' },
        select: {
          vendorJobVideoStage: true,
          mediaAssets: {
            select: {
              mimeType: true,
              moderationStatus: true,
              visibilityStatus: true,
              archiveStatus: true,
            },
          },
        },
      },
    },
  });

  const bookingIds = bookings.map((booking: any) => String(booking.id));
  if (bookingIds.length === 0) {
    const counts = { upcoming: 0, completed: 0, needs_attention: 0, cancelled: 0, archived: 0, unclassified: 0 };
    return {
      records: [],
      counts,
      selectedTab: defaultTab(counts),
      pagination: { page: 1, limit: safeLimit, total: 0, totalPages: 0 },
    };
  }

  const [
    organizationEvents,
    consentRecords,
    packages,
    grants,
    reviews,
    visibilityDecisions,
    cancellationOutcomes,
    restrictions,
  ] = await Promise.all([
    db.customerServiceRecordOrganizationEvent.findMany({
      where: { customerUserId, bookingId: { in: bookingIds } },
      orderBy: [{ sequence: 'desc' }, { actedAt: 'desc' }],
      select: { id: true, bookingId: true, action: true, sequence: true, evidenceHash: true, actedAt: true },
    }),
    db.consentRecord.findMany({
      where: { bookingId: { in: bookingIds }, isCurrent: true },
      orderBy: [{ generation: 'desc' }, { requestedAt: 'desc' }],
      select: {
        id: true,
        bookingId: true,
        token: true,
        lifecycleStatus: true,
        status: true,
        verifiedDecision: true,
        expiresAt: true,
      },
    }),
    db.serviceVideoPackageEvidence.findMany({
      where: { bookingId: { in: bookingIds }, isCurrent: true },
      orderBy: [{ version: 'desc' }],
      select: { id: true, bookingId: true, status: true, adminAuditDecisionId: true, customerAccessGrantId: true },
    }),
    db.privateProofAccessGrant.findMany({
      where: { bookingId: { in: bookingIds }, customerUserId, status: 'ACTIVE', revokedAt: null },
      select: { id: true, bookingId: true, packageId: true, adminAuditDecisionId: true },
    }),
    db.review.findMany({
      where: { bookingId: { in: bookingIds }, userId: customerUserId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, bookingId: true, createdAt: true },
    }),
    db.serviceVideoPackageVisibilityDecision.findMany({
      where: { bookingId: { in: bookingIds }, customerUserId, isCurrent: true },
      orderBy: [{ version: 'desc' }],
      select: { id: true, bookingId: true, decision: true, publicationProposalId: true },
    }),
    db.vendorOperationalOutcome.findMany({
      where: { bookingId: { in: bookingIds }, outcomeType: 'BOOKING_CANCELED' },
      orderBy: [{ finalizedAt: 'desc' }],
      select: { bookingId: true, finalizedAt: true, finalizedByUserId: true, metadata: true },
    }),
    db.mediaLifecycleRestriction.findMany({
      where: {
        bookingId: { in: bookingIds },
        active: true,
        scope: { in: ['PUBLIC', 'ALL'] },
        outcome: { in: ['RESTRICTED', 'HELD'] },
      },
      select: { bookingId: true },
    }),
  ]);

  const packageByBooking = mapLatestByBooking<any>(packages);
  const packageIds = packages.map((pkg: any) => String(pkg.id));
  const adminDecisionIds = packages
    .map((pkg: any) => String(pkg.adminAuditDecisionId || '').trim())
    .filter(Boolean);
  const proposalIds = visibilityDecisions
    .map((decision: any) => String(decision.publicationProposalId || '').trim())
    .filter(Boolean);
  const [adminDecisions, proposals] = await Promise.all([
    adminDecisionIds.length
      ? db.serviceVideoAdminAuditDecisionEvidence.findMany({
          where: { id: { in: adminDecisionIds }, packageId: { in: packageIds } },
          select: { id: true, bookingId: true, packageId: true, decision: true },
        })
      : [],
    proposalIds.length
      ? db.serviceVideoPublicationProposal.findMany({
          where: { id: { in: proposalIds } },
          select: { id: true, bookingId: true, status: true },
        })
      : [],
  ]);

  const eventsByBooking = new Map<string, any[]>();
  for (const event of organizationEvents) {
    const list = eventsByBooking.get(String(event.bookingId)) || [];
    list.push(event);
    eventsByBooking.set(String(event.bookingId), list);
  }
  const consentByBooking = mapLatestByBooking<any>(consentRecords);
  const grantByBooking = mapLatestByBooking<any>(grants);
  const reviewByBooking = mapLatestByBooking<any>(reviews);
  const visibilityByBooking = mapLatestByBooking<any>(visibilityDecisions);
  const cancellationByBooking = mapLatestByBooking<any>(cancellationOutcomes);
  const adminByBooking = mapLatestByBooking<any>(adminDecisions);
  const proposalByBooking = mapLatestByBooking<any>(proposals);
  const restrictedBookings = new Set(restrictions.map((row: any) => String(row.bookingId)));

  const resolved: ResolvedCustomerServiceRecord[] = bookings.map((booking: any) => {
    const id = String(booking.id);
    const pkg = packageByBooking.get(id);
    const grant = grantByBooking.get(id);
    const adminDecision = adminByBooking.get(id);
    const visibilityDecision = visibilityByBooking.get(id);
    const proposal = proposalByBooking.get(id);
    const legacyLifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: booking.status,
      mediaSessions: booking.mediaSessions || [],
      hasSubmittedReview: Boolean(reviewByBooking.get(id)),
    });
    const cancellation = cancellationFromBooking({
      booking,
      outcome: cancellationByBooking.get(id),
    });
    const state = deriveCustomerServiceRecordState({
      bookingStatus: booking.status,
      hasExplicitCompletedEvidence: Boolean(pkg),
      organizationEvents: eventsByBooking.get(id) || [],
      currentConsent: consentByBooking.get(id) || null,
      adminAuditDecision: adminDecision?.decision || null,
      packageStatus: pkg?.status || null,
      activePrivateProofGrant: Boolean(
        grant && (!pkg || String(grant.packageId) === String(pkg.id))
      ),
      legacyCustomerVisibleVideo: legacyLifecycle.videoAvailableToCustomer,
      reviewSubmitted: Boolean(reviewByBooking.get(id)),
      currentVisibilityDecision: visibilityDecision?.decision || null,
      publicationStatus: proposal?.status || null,
      publicRestrictionActive: restrictedBookings.has(id),
      cancellation,
    });
    return {
      source: booking,
      contract: {
        ...mapBookingToContract(booking),
        customer_record: state,
      },
      state,
    };
  });

  const unclassified = resolved.filter((record) =>
    !record.state.archived && record.state.lifecycle === CUSTOMER_RECORD_LIFECYCLES.UNCLASSIFIED
  );
  if (unclassified.length > 0) {
    console.warn('[customer-service-records] unsupported customer lifecycle status', {
      records: unclassified.map((record) => ({
        bookingId: String(record.source.id),
        status: String(record.source.status || 'unknown'),
      })),
    });
  }

  const counts: CustomerServiceRecordCounts = {
    upcoming: resolved.filter((record) => customerRecordMatchesTab(record.state, 'upcoming')).length,
    completed: resolved.filter((record) => customerRecordMatchesTab(record.state, 'completed')).length,
    needs_attention: resolved.filter((record) => customerRecordMatchesTab(record.state, 'needs_attention')).length,
    cancelled: resolved.filter((record) => customerRecordMatchesTab(record.state, 'cancelled')).length,
    archived: resolved.filter((record) => customerRecordMatchesTab(record.state, 'archived')).length,
    unclassified: unclassified.length,
  };

  const requested = String(input.requestedTab || '').trim().toLowerCase() as CustomerRecordTab;
  const selectedTab = CUSTOMER_RECORD_TABS.has(requested) ? requested : defaultTab(counts);
  const matching = resolved
    .filter((record) => input.includeAll || customerRecordMatchesTab(record.state, selectedTab))
    .filter((record) => recordMatchesSearch(record.source, String(input.search || '')))
    .sort((left, right) => {
      const leftDate = new Date(left.source.scheduledFor || left.source.date || left.source.updatedAt).getTime();
      const rightDate = new Date(right.source.scheduledFor || right.source.date || right.source.updatedAt).getTime();
      return selectedTab === 'upcoming' ? leftDate - rightDate : rightDate - leftDate;
    });
  const total = matching.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);
  const effectivePage = totalPages === 0 ? 1 : Math.min(safePage, totalPages);
  const start = (effectivePage - 1) * safeLimit;

  return {
    records: (input.includeAll ? matching : matching.slice(start, start + safeLimit)).map((record) => record.contract),
    counts,
    selectedTab,
    pagination: {
      page: effectivePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}
