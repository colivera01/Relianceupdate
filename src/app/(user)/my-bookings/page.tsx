'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, Building2, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCustomerUserId } from '@/lib/customer-user-id';
import type { CustomerRecordTab, CustomerServiceRecordState } from '@/lib/customer-service-record-state';
import { VendorFavoriteButton } from '@/components/favorites/VendorFavoriteButton';
import { CustomerLoadError } from '@/components/customer/CustomerLoadError';
import { useCustomerLoad } from '@/hooks/useCustomerLoad';
import { customerRecordsResponseSchema } from '@/lib/customer-load-contract';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { hasCustomerSchedulePassed } from '@/lib/customer-service-record-presentation';

type CustomerRecordRow = {
  id: string;
  title: string | null;
  booking_date: string | null;
  booking_time?: string | null;
  status: string;
  service: { id: string; name: string };
  vendor: { id: string; name: string };
  customer_record: CustomerServiceRecordState;
};

const TABS: Array<{ value: CustomerRecordTab; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY_COPY: Record<CustomerRecordTab, string> = {
  upcoming: 'No upcoming service records.',
  completed: 'No completed service records yet.',
  needs_attention: 'Nothing needs your attention.',
  cancelled: 'No cancelled service records.',
  archived: 'No archived service records.',
  unclassified: 'No Service Records have an unavailable status.',
};

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() || `customer-record-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseRecordTab(value: string | null): CustomerRecordTab | null {
  return TABS.some((tab) => tab.value === value) || value === 'unclassified'
    ? value as CustomerRecordTab
    : null;
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function MyServiceRecordsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const customerUserId = resolveCustomerUserId(user?.id);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseRecordTab(searchParams?.get('tab') || null);
  const search = String(searchParams?.get('q') || '').trim();
  const requestedBusinessId = String(searchParams?.get('businessId') || '').trim();
  const page = parsePage(searchParams?.get('page') || null);
  const [searchInput, setSearchInput] = useState(search);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CustomerRecordRow | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | null>(null);

  const updateQuery = useCallback((updates: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(searchParams?.toString() || '');
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    const basePath = pathname || '/my-bookings';
    const href = query ? `${basePath}?${query}` : basePath;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      updateQuery({ q: nextSearch || null, page: null }, true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, searchInput, updateQuery]);

  const params = new URLSearchParams({ view: 'customer_service_records', page: String(page), limit: '10' });
  if (activeTab) params.set('tab', activeTab);
  if (search) params.set('q', search);
  if (requestedBusinessId) params.set('businessId', requestedBusinessId);
  const load = useCustomerLoad(`/api/bookings?${params}`, customerUserId, !authLoading, customerRecordsResponseSchema, 'Unable to load your Service Records.');
  const records = (load.data?.bookings || []) as CustomerRecordRow[];
  const counts = load.data?.counts;
  const selectedTab = activeTab || load.data?.selectedTab;
  const businesses = load.data?.businesses || [];
  const selectedBusinessId = load.data?.selectedBusinessId || '';
  const totalPages = load.data?.pagination.totalPages || 0;
  const total = load.data?.pagination.total || 0;
  const currentPage = load.data?.pagination.page || page;
  const fetchRecords = load.reload;

  useEffect(() => {
    if (load.status === 'success' && requestedBusinessId && !load.data?.selectedBusinessId) {
      updateQuery({ businessId: null, page: null }, true);
    }
  }, [load.data?.selectedBusinessId, load.status, requestedBusinessId, updateQuery]);

  const changeOrganization = async (record: CustomerRecordRow, action: 'ARCHIVE' | 'RESTORE') => {
    const confirmation = action === 'ARCHIVE'
      ? 'Archive this Service Record?\n\nIt will move to Archived. Your Service Record and authorized video remain available.'
      : 'Restore this Service Record to My Service Records?';
    if (!window.confirm(confirmation)) return;
    setBusyId(record.id);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(record.id)}/organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId: createRequestId() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'Unable to update this Service Record.'));
      setActionMessage(String(body?.message || 'Service Record updated.'));
      await fetchRecords();
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : 'Unable to update this Service Record.');
    } finally {
      setBusyId(null);
    }
  };

  const openCancellation = (record: CustomerRecordRow) => {
    setCancelTarget(record);
    setCancellationReason('');
    setCancellationError(null);
  };

  const cancelRecord = async () => {
    if (!cancelTarget || busyId === cancelTarget.id) return;
    const reason = cancellationReason.trim();
    if (reason.length < 3) {
      setCancellationError('Enter a brief reason for cancelling this service.');
      return;
    }
    setBusyId(cancelTarget.id);
    setActionMessage(null);
    setCancellationError(null);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(cancelTarget.id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), refund_requested: false }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || 'Unable to cancel this service.'));
      setActionMessage('Service cancelled.');
      setCancelTarget(null);
      setCancellationReason('');
      await fetchRecords();
    } catch (caught) {
      setCancellationError(caught instanceof Error ? caught.message : 'Unable to cancel this service.');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) return <div className="px-4 py-12 text-sm text-white/70">Checking your account...</div>;
  if (!customerUserId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold text-white">Sign in to view your Service Records</h1>
        <Link href="/auth/login" className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Sign In</Link>
      </div>
    );
  }

  const visibleTabs = counts && counts.unclassified > 0
    ? [...TABS, { value: 'unclassified' as const, label: 'Other Records' }]
    : TABS;

  return (
    <main className="min-h-full px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-semibold uppercase text-blue-300">Customer Service Records</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">My Service Records</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Track upcoming services and keep completed, cancelled, and archived records organized.
          </p>
        </header>

        <section aria-label="Find and filter Service Records" className="border-b border-white/10 py-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
            <label className="relative block">
              <span className="sr-only">Search Service Records</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search service, business, or reference"
                className="h-10 w-full rounded-md border border-white/15 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-400"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Filter by business</span>
              <Building2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select
                value={selectedBusinessId}
                onChange={(event) => updateQuery({ businessId: event.target.value || null, page: null })}
                className="h-10 w-full rounded-md border border-white/15 bg-slate-950 pl-9 pr-9 text-sm text-white outline-none focus:border-blue-400"
              >
                <option value="">All Businesses</option>
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Service Record filters">
            {visibleTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selectedTab === tab.value}
                onClick={() => updateQuery({ tab: tab.value, page: null })}
                className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium ${selectedTab === tab.value ? 'border-blue-500 bg-blue-600 text-white' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'}`}
              >
                {tab.label} <span className="ml-1 text-xs opacity-75">{counts ? counts[tab.value] : <span aria-label="Count unavailable">--</span>}</span>
              </button>
            ))}
          </div>
        </section>

        {actionMessage ? <p className="mt-4 rounded-md border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{actionMessage}</p> : null}
        {load.error ? <CustomerLoadError message={load.error} onRetry={load.reload} /> : null}

        <section aria-live="polite" className="py-6">
          {load.status === 'loading' ? (
            <p className="text-sm text-white/65">Loading Service Records...</p>
          ) : load.status === 'error' ? null : records.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg font-medium text-white">{EMPTY_COPY[load.data!.selectedTab]}</p>
              {search ? <p className="mt-2 text-sm text-white/55">Try a different search.</p> : null}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {records.map((record) => {
                const state = record.customer_record;
                const detailHref = `/my-bookings/${encodeURIComponent(record.id)}`;
                return (
                  <article key={record.id} data-testid={`my-bookings-row-${record.id}`} className="rounded-md border border-white/12 bg-slate-950/65 p-5 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-blue-300">{state.lifecycleLabel}</p>
                        <h2 className="mt-1 truncate text-xl font-semibold">{record.service?.name || record.title || 'Service Record'}</h2>
                        <p className="mt-1 text-sm text-white/65">Business: {record.vendor?.name || 'Business unavailable'}</p>
                      </div>
                      {state.attention.required ? <span className="shrink-0 rounded-full bg-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-950">Needs Attention</span> : state.archived ? <span className="shrink-0 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-100">Archived</span> : null}
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-white/10 py-4 text-sm">
                      <div><dt className="text-white/45">Status</dt><dd className="mt-0.5 font-medium">{state.lifecycleLabel}</dd></div>
                      <div><dt className="text-white/45">Date</dt><dd className="mt-0.5 font-medium">{formatDate(record.booking_date)}</dd></div>
                      {state.lifecycle === 'COMPLETED' ? <div><dt className="text-white/45">Service Video:</dt><dd className="mt-0.5 font-medium">{state.video.label}</dd></div> : null}
                      {state.lifecycle === 'COMPLETED' ? <div><dt className="text-white/45">Review</dt><dd className="mt-0.5 font-medium">{state.review.label}</dd></div> : null}
                      {state.lifecycle === 'COMPLETED' && state.video.state === 'READY' ? <div><dt className="text-white/45">Visibility</dt><dd className="mt-0.5 font-medium">{state.visibility.label}</dd></div> : null}
                      <div><dt className="text-white/45">Reference</dt><dd className="mt-0.5 truncate font-mono text-xs">{record.id}</dd></div>
                    </dl>

                    {state.lifecycle === 'UPCOMING' && hasCustomerSchedulePassed(record.booking_date, record.booking_time) ? (
                      <p className="mt-4 rounded-md border border-blue-300/20 bg-blue-300/10 px-3 py-2 text-sm text-blue-100">
                        Scheduled date has passed. Status update pending.
                      </p>
                    ) : null}

                    {state.attention.required ? (
                      <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-sm">
                        <p className="font-semibold text-amber-100">{state.attention.reason}</p>
                        {state.attention.actionHref ? <Link href={state.attention.actionHref} className="mt-2 inline-flex font-semibold text-amber-200 underline">{state.attention.actionLabel}</Link> : null}
                      </div>
                    ) : null}

                    {state.cancellation ? (
                      <dl className="mt-4 space-y-1 text-sm text-white/70">
                        <div><dt className="inline font-medium text-white">Cancelled by: </dt><dd className="inline">{state.cancellation.actorLabel || 'Unavailable for this historical record'}</dd></div>
                        <div><dt className="inline font-medium text-white">Reason: </dt><dd className="inline">{state.cancellation.reason || 'Reason unavailable for this historical record'}</dd></div>
                        {state.cancellation.cancelledAt ? <div><dt className="inline font-medium text-white">Date: </dt><dd className="inline">{formatDate(state.cancellation.cancelledAt)}</dd></div> : null}
                      </dl>
                    ) : null}

                    {state.legacyRestoreBlocked ? <p className="mt-4 text-sm text-white/60">Some status details are unavailable for this older record. It remains available to view, but its prior lifecycle cannot be safely restored. <Link href="/customer/support" className="font-medium text-blue-300 underline">Contact Support</Link>.</p> : null}

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Link href={detailHref} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">View Service Record</Link>
                      {state.review.state === 'LEAVE_REVIEW' ? <Link href={`${detailHref}?action=review&returnTo=${encodeURIComponent('/my-bookings')}#your-review`} className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Leave a review</Link> : null}
                      {state.lifecycle === 'COMPLETED' && record.vendor?.id ? <VendorFavoriteButton vendorId={record.vendor.id} vendorName={record.vendor.name || 'Business'} tone="dark" /> : null}
                      {state.archiveEligible ? <button type="button" disabled={busyId === record.id} onClick={() => void changeOrganization(record, 'ARCHIVE')} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"><Archive className="h-4 w-4" /> Archive Service Record</button> : null}
                      {state.restoreEligible ? <button type="button" disabled={busyId === record.id} onClick={() => void changeOrganization(record, 'RESTORE')} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Restore to Service Records</button> : null}
                      {state.lifecycle === 'UPCOMING' && !state.archived ? <button type="button" disabled={busyId === record.id} onClick={() => openCancellation(record)} className="ml-auto rounded-md px-2 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50">Cancel service</button> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {load.status === 'success' && totalPages > 1 ? (
          <nav aria-label="Service Record pages" className="flex items-center justify-between border-t border-white/10 py-5">
            <p className="text-sm text-white/55">Page {currentPage} of {totalPages} · {total} records</p>
            <div className="flex gap-2">
              <button type="button" disabled={currentPage <= 1} onClick={() => updateQuery({ page: String(Math.max(1, currentPage - 1)) })} aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => updateQuery({ page: String(currentPage + 1) })} aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </nav>
        ) : null}

        <p className="pb-8 text-sm text-white/50">Need help with a Service Record? <Link href="/customer/support" className="font-medium text-blue-300 underline">Support &amp; Help</Link></p>
      </div>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => {
        if (open || (cancelTarget && busyId === cancelTarget.id)) return;
        setCancelTarget(null);
        setCancellationReason('');
        setCancellationError(null);
      }}>
        <DialogContent className="max-w-md border-slate-200 bg-white text-slate-950" onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.setTimeout(() => document.getElementById('cancellation-reason')?.focus(), 0);
        }}>
          <DialogHeader>
            <DialogTitle>Cancel this service?</DialogTitle>
            <DialogDescription>
              Tell us why you&apos;re cancelling {cancelTarget?.service?.name || 'this service'}.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="cancellation-reason" className="text-sm font-medium text-slate-800">Reason</label>
          <textarea
            id="cancellation-reason"
            value={cancellationReason}
            onChange={(event) => setCancellationReason(event.target.value)}
            rows={4}
            disabled={Boolean(cancelTarget && busyId === cancelTarget.id)}
            aria-describedby={cancellationError ? 'cancellation-error' : undefined}
            className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
          {cancellationError ? <p id="cancellation-error" role="alert" className="text-sm text-red-700">{cancellationError}</p> : null}
          <DialogFooter className="gap-2 sm:space-x-0">
            <button type="button" disabled={Boolean(cancelTarget && busyId === cancelTarget.id)} onClick={() => setCancelTarget(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Keep Service</button>
            <button type="button" disabled={Boolean(cancelTarget && busyId === cancelTarget.id)} onClick={() => void cancelRecord()} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{cancelTarget && busyId === cancelTarget.id ? 'Cancelling...' : 'Cancel Service'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function MyServiceRecordsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-12 text-sm text-white/70">Loading Service Records...</div>}>
      <MyServiceRecordsPageContent />
    </Suspense>
  );
}
