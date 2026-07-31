'use client';

import { useEffect, useState } from 'react';
import { getAdminRequestHeaders } from '@/lib/admin-client';

type ReviewAuditPerson = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
};

type ReviewAuditBooking = {
  id?: string;
  status?: string | null;
  user?: ReviewAuditPerson;
} | null;

type ReviewAuditVendor = {
  id?: string;
  businessName?: string | null;
  name?: string | null;
} | null;

type ReviewAuditMediaSession = {
  id?: string;
  status?: string | null;
  title?: string | null;
} | null;

type ReviewAuditReview = {
  id?: string;
  rating?: number | null;
  comment?: string | null;
  submittedVia?: string | null;
  createdAt?: string | null;
} | null;

type ReviewAuditSentiment = {
  id?: string;
  sentiment?: string | null;
  score?: number | null;
  source?: string | null;
  createdAt?: string | null;
};

type ReviewAuditPromptEvent = {
  id?: string;
  eventType?: string | null;
  promptType?: string | null;
  channel?: string | null;
  deliveredAt?: string | null;
  createdAt?: string | null;
};

type ReviewAuditConsentEvent = {
  id?: string;
  eventType?: string | null;
  createdAt?: string | null;
};

type ReviewAuditConsentRecord = {
  id?: string;
  status?: string | null;
  consentType?: string | null;
  requestedAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  expiresAt?: string | null;
  events?: ReviewAuditConsentEvent[];
};

type ReviewAuditRow = {
  reviewWindowId: string;
  status: string;
  effectiveStatus?: string | null;
  lifecycleNote?: string | null;
  customerLifecycle?: {
    completedWorkMarked?: boolean;
    videoSubmitted?: boolean;
    videoApproved?: boolean;
    videoAvailableToCustomer?: boolean;
    videoPendingApproval?: boolean;
    reviewWindowOpen?: boolean;
    reviewSubmitted?: boolean;
    reviewEligible?: boolean;
    reviewSubmittedWithoutEligibleVideo?: boolean;
    videoState?: string | null;
  } | null;
  openedAt?: string | null;
  expiresAt?: string | null;
  closedAt?: string | null;
  booking?: ReviewAuditBooking;
  vendor?: ReviewAuditVendor;
  mediaSession?: ReviewAuditMediaSession;
  review?: ReviewAuditReview;
  sentiments?: ReviewAuditSentiment[];
  promptEvents?: ReviewAuditPromptEvent[];
  consentRecords?: ReviewAuditConsentRecord[];
};

const INITIAL_FILTERS = {
  bookingId: '',
  vendorId: '',
  customer: '',
  reviewWindowStatus: '',
  sentiment: '',
  consentStatus: '',
  dateFrom: '',
  dateTo: '',
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatLabel(value?: string | null) {
  if (!value) return 'Not recorded';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded border bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

export default function ReviewAuditPage() {
  const [rows, setRows] = useState<ReviewAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewAuditRow | null>(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set('limit', '10');
    params.set('includeDetails', '0');
    params.set('includeTotal', '0');

    const res = await fetch(`/api/admin/review-audit?${params.toString()}`, {
      headers: getAdminRequestHeaders(),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || 'Failed to load review audit');
      setRows([]);
    } else {
      setRows(Array.isArray(json?.rows) ? json.rows : []);
    }
    setLoading(false);
  };

  const openDetail = async (row: ReviewAuditRow) => {
    setSelected(row);
    setDetailLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('reviewWindowId', row.reviewWindowId);
      params.set('includeDetails', '1');
      params.set('limit', '1');
      const res = await fetch(`/api/admin/review-audit?${params.toString()}`, {
        headers: getAdminRequestHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load review audit detail');
      }
      const detailRow = Array.isArray(json?.rows) ? json.rows[0] : null;
      if (detailRow) {
        setSelected(detailRow);
      }
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Failed to load review audit detail');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-7xl p-4 space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">Review Audit</h1>
      <p className="text-sm text-gray-600">Customer review-window, consent, sentiment, and outcome history.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded border bg-white p-3">
        <input placeholder="Booking ID" className="rounded border px-2 py-1 text-sm" value={filters.bookingId} onChange={(e) => setFilters((f) => ({ ...f, bookingId: e.target.value }))} />
        <input placeholder="Vendor ID" className="rounded border px-2 py-1 text-sm" value={filters.vendorId} onChange={(e) => setFilters((f) => ({ ...f, vendorId: e.target.value }))} />
        <input placeholder="Customer contact/user" className="rounded border px-2 py-1 text-sm" value={filters.customer} onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))} />
        <input placeholder="Window status" className="rounded border px-2 py-1 text-sm" value={filters.reviewWindowStatus} onChange={(e) => setFilters((f) => ({ ...f, reviewWindowStatus: e.target.value }))} />
        <input placeholder="Sentiment" className="rounded border px-2 py-1 text-sm" value={filters.sentiment} onChange={(e) => setFilters((f) => ({ ...f, sentiment: e.target.value }))} />
        <input placeholder="Consent status" className="rounded border px-2 py-1 text-sm" value={filters.consentStatus} onChange={(e) => setFilters((f) => ({ ...f, consentStatus: e.target.value }))} />
        <input type="date" className="rounded border px-2 py-1 text-sm" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
        <input type="date" className="rounded border px-2 py-1 text-sm" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
        <button onClick={load} className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Apply Filters</button>
        <button
          onClick={() => {
            setFilters(INITIAL_FILTERS);
            setSelected(null);
            setError(null);
            setTimeout(() => {
              load();
            }, 0);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {loading ? <div className="rounded border bg-white p-6 text-sm text-gray-500">Loading review audit records...</div> : null}
      {error ? <div className="rounded border bg-red-50 p-6 text-sm text-red-700">{error}</div> : null}
      {!loading && !error ? (
        <div className="space-y-2">
          <div className="rounded border bg-white px-3 py-2 text-xs text-gray-600">
            Showing the 10 most recent matching rows first. Click a row to load full detail.
          </div>
          {rows.length === 0 ? <div className="rounded border bg-white p-6 text-sm text-gray-500">No rows found for the current filters.</div> : null}
          {rows.map((row) => (
            <button
              key={row.reviewWindowId}
              onClick={() => openDetail(row)}
              className="w-full rounded border bg-white p-3 text-left hover:bg-gray-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Window {row.reviewWindowId}</p>
                  <p className="text-xs text-gray-600">Booking {row.booking?.id} - Vendor {row.vendor?.businessName || row.vendor?.name || row.vendor?.id}</p>
                </div>
                <div className="space-y-1 text-right text-xs text-gray-700">
                  <div>Window: {formatLabel(row.status)}</div>
                  <div>Lifecycle: {formatLabel(row.effectiveStatus)}</div>
                </div>
              </div>
              {row.lifecycleNote ? (
                <p className="mt-2 text-xs text-gray-600">{row.lifecycleNote}</p>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Review Audit Detail</h2>
              <button onClick={() => setSelected(null)} className="text-sm text-gray-600 hover:text-gray-900">Close</button>
            </div>
            <div className="space-y-4">
              {detailLoading ? (
                <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Loading the full review audit history. Core window details are already visible below.
                </div>
              ) : null}
              <div className="space-y-4">
                <DetailSection title="Window overview">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Window ID" value={selected.reviewWindowId} />
                    <DetailItem label="Window status" value={formatLabel(selected.status)} />
                    <DetailItem label="Lifecycle truth" value={formatLabel(selected.effectiveStatus)} />
                    <DetailItem label="Opened" value={formatDateTime(selected.openedAt)} />
                  <DetailItem
                    label="Legacy expiry field (not enforced)"
                    value={formatDateTime(selected.expiresAt)}
                  />
                    <DetailItem label="Closed" value={formatDateTime(selected.closedAt)} />
                    <DetailItem label="Media session" value={selected.mediaSession?.id || 'Not linked'} />
                    <DetailItem label="Media status" value={formatLabel(selected.mediaSession?.status)} />
                    <DetailItem label="Media title" value={selected.mediaSession?.title || 'Not recorded'} />
                  </div>
                </DetailSection>

                <div className="grid gap-4 lg:grid-cols-2">
                  <DetailSection title="Customer and booking">
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailItem label="Booking ID" value={selected.booking?.id || 'Not recorded'} />
                      <DetailItem label="Booking status" value={formatLabel(selected.booking?.status)} />
                      <DetailItem label="Customer name" value={selected.booking?.user?.name || 'Not recorded'} />
                      <DetailItem label="Customer email" value={selected.booking?.user?.email || 'Not recorded'} />
                      <DetailItem label="Customer phone" value={selected.booking?.user?.phone || 'Not recorded'} />
                    </div>
                  </DetailSection>

                  <DetailSection title="Vendor">
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailItem label="Vendor ID" value={selected.vendor?.id || 'Not recorded'} />
                      <DetailItem label="Business name" value={selected.vendor?.businessName || selected.vendor?.name || 'Not recorded'} />
                    </div>
                  </DetailSection>
                </div>

                <DetailSection title="Lifecycle truth">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Completed work marked" value={selected.customerLifecycle?.completedWorkMarked ? 'Yes' : 'No'} />
                    <DetailItem label="Video submitted" value={selected.customerLifecycle?.videoSubmitted ? 'Yes' : 'No'} />
                    <DetailItem label="Video approved" value={selected.customerLifecycle?.videoApproved ? 'Yes' : 'No'} />
                    <DetailItem label="Video available to customer" value={selected.customerLifecycle?.videoAvailableToCustomer ? 'Yes' : 'No'} />
                    <DetailItem label="Video pending approval" value={selected.customerLifecycle?.videoPendingApproval ? 'Yes' : 'No'} />
                    <DetailItem label="Review eligible" value={selected.customerLifecycle?.reviewEligible ? 'Yes' : 'No'} />
                    <DetailItem label="Review submitted" value={selected.customerLifecycle?.reviewSubmitted ? 'Yes' : 'No'} />
                    <DetailItem label="Optional review available" value={selected.customerLifecycle?.reviewWindowOpen ? 'Yes' : 'No'} />
                    <DetailItem label="Video state" value={formatLabel(selected.customerLifecycle?.videoState)} />
                  </div>
                  {selected.lifecycleNote ? (
                    <div className="rounded border bg-gray-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Lifecycle note</p>
                      <p className="mt-1 text-sm text-gray-900">{selected.lifecycleNote}</p>
                    </div>
                  ) : null}
                </DetailSection>

                <DetailSection title="Consent history">
                  {selected.consentRecords && selected.consentRecords.length > 0 ? (
                    <div className="space-y-3">
                      {selected.consentRecords.map((record) => (
                        <div key={record.id || `${record.status}-${record.requestedAt}`} className="rounded border bg-gray-50 p-3">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <DetailItem label="Consent type" value={formatLabel(record.consentType)} />
                            <DetailItem label="Status" value={formatLabel(record.status)} />
                            <DetailItem label="Requested" value={formatDateTime(record.requestedAt)} />
                            <DetailItem label="Accepted" value={formatDateTime(record.acceptedAt)} />
                            <DetailItem label="Declined" value={formatDateTime(record.declinedAt)} />
                        <DetailItem
                          label="Legacy expiry field (not enforced)"
                          value={formatDateTime(record.expiresAt)}
                        />
                          </div>
                          <div className="mt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Consent events</p>
                            {record.events && record.events.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                                {record.events.map((event) => (
                                  <li key={event.id || `${event.eventType}-${event.createdAt}`}>
                                    {formatLabel(event.eventType)} | {formatDateTime(event.createdAt)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-gray-500">No consent events were recorded.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No consent records were linked to this review window.</p>
                  )}
                </DetailSection>

                <div className="grid gap-4 lg:grid-cols-2">
                  <DetailSection title="Sentiment history">
                    {selected.sentiments && selected.sentiments.length > 0 ? (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {selected.sentiments.map((item) => (
                          <li key={item.id || `${item.sentiment}-${item.createdAt}`} className="rounded border bg-gray-50 px-3 py-2">
                            {formatLabel(item.sentiment)} | Score {String(item.score ?? 'Not scored')} | Source {formatLabel(item.source)} | {formatDateTime(item.createdAt)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No sentiment events were recorded for this window yet.</p>
                    )}
                  </DetailSection>

                  <DetailSection title="Prompt history">
                    {selected.promptEvents && selected.promptEvents.length > 0 ? (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {selected.promptEvents.map((item) => (
                          <li key={item.id || `${item.eventType}-${item.createdAt}`} className="rounded border bg-gray-50 px-3 py-2">
                            {formatLabel(item.eventType)} | {formatLabel(item.promptType)} | {formatLabel(item.channel)} | {formatDateTime(item.deliveredAt || item.createdAt)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No prompt events were recorded for this review window.</p>
                    )}
                  </DetailSection>
                </div>

                <DetailSection title="Submitted review">
                  {selected.review ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailItem label="Review ID" value={selected.review.id || 'Not recorded'} />
                      <DetailItem label="Rating" value={selected.review.rating != null ? String(selected.review.rating) : 'Not recorded'} />
                      <DetailItem label="Submitted via" value={formatLabel(selected.review.submittedVia)} />
                      <DetailItem label="Created" value={formatDateTime(selected.review.createdAt)} />
                      <div className="md:col-span-2 rounded border bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Review text</p>
                        <p className="mt-1 text-sm text-gray-900">{selected.review.comment || 'No written review comment was submitted.'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No submitted review is attached to this window yet.</p>
                  )}
                </DetailSection>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
