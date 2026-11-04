'use client';

import Link from 'next/link';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, Heart, MapPin, Search, Trash2 } from 'lucide-react';
import { favoriteKeys, useAllFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesSDK } from '@/sdk/favorites';
import type { FavoriteListItem } from '@/types/api';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { CustomerLoadError } from '@/components/customer/CustomerLoadError';
import { buildVendorProfileHref } from '@/lib/public-vendor-navigation';

type Filter = 'all' | 'service' | 'vendor';

export default function FavoritesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const query = useAllFavorites({ page, limit: 12, type: filter, search });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!query.data) return;
    const hiddenOnPage = query.data.items.filter((item) => removedIds.has(item.favoriteId)).length;
    const adjustedTotal = Math.max(0, query.data.pagination.total - hiddenOnPage);
    const lastAvailablePage = Math.max(1, Math.ceil(adjustedTotal / query.data.pagination.limit));
    if (page > lastAvailablePage) setPage(lastAvailablePage);
  }, [page, query.data, removedIds]);

  const remove = async (item: FavoriteListItem) => {
    setBusyId(item.favoriteId);
    setActionError(null);
    setActionStatus(null);
    setRefreshWarning(null);
    try {
      if (item.entityType === 'vendor') await favoritesSDK.removeVendorFavorite(item.favoriteId, user?.id);
      else await favoritesSDK.removeFavorite(item.favoriteId, user?.id);
      const name = item.entityType === 'vendor' ? item.vendorName : item.serviceName;
      setRemovedIds((current) => new Set(current).add(item.favoriteId));
      setActionStatus(`${name} was removed from Favorites.`);
      const currentPagination = query.data?.pagination;
      const lastPageAfterRemoval = currentPagination
        ? Math.max(1, Math.ceil(Math.max(0, currentPagination.total - 1) / currentPagination.limit))
        : page;
      if (page > lastPageAfterRemoval) {
        // Changing the query key performs the authoritative refresh for the
        // previous page. Mark any cached page stale first so returning to a
        // recently viewed page still performs a fresh server read.
        await queryClient.invalidateQueries({ queryKey: favoriteKeys.all, refetchType: 'none' });
        setPage(lastPageAfterRemoval);
        return;
      }
      const refreshed = await query.refetch();
      if (refreshed.isError) {
        setRefreshWarning('The item was removed, but Favorites could not refresh. The saved list will retry when you return.');
      }
    } catch {
      setActionError('Unable to remove this favorite. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <h1 className="text-3xl font-semibold text-slate-950">Favorites</h1>
        <p className="mt-3 text-slate-600">Sign in to see your saved services and businesses.</p>
        <Link href="/auth/login?next=%2Ffavorites" className="mt-5 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Sign In</Link>
      </div>
    );
  }

  const ready = !authLoading && Boolean(query.data);
  const rawItems = ready ? query.data!.items : [];
  const staleRemovedItems = rawItems.filter((item) => removedIds.has(item.favoriteId));
  const items = rawItems.filter((item) => !removedIds.has(item.favoriteId));
  const rawCounts = ready ? query.data!.counts : null;
  const counts = rawCounts ? {
    all: Math.max(0, rawCounts.all - staleRemovedItems.length),
    services: Math.max(0, rawCounts.services - staleRemovedItems.filter((item) => item.entityType !== 'vendor').length),
    vendors: Math.max(0, rawCounts.vendors - staleRemovedItems.filter((item) => item.entityType === 'vendor').length),
  } : null;
  const rawPagination = ready ? query.data!.pagination : { page: 1, totalPages: 0, total: 0, limit: 12 };
  const adjustedTotal = Math.max(0, rawPagination.total - staleRemovedItems.length);
  const adjustedTotalPages = adjustedTotal ? Math.ceil(adjustedTotal / rawPagination.limit) : 0;
  const pagination = {
    ...rawPagination,
    page: adjustedTotalPages ? Math.min(rawPagination.page, adjustedTotalPages) : 1,
    total: adjustedTotal,
    totalPages: adjustedTotalPages,
  };
  const empty = filter === 'service' ? 'No saved services yet.' : filter === 'vendor' ? 'No saved businesses yet.' : 'No favorites yet.';
  const tabs: ReadonlyArray<{ value: Filter; label: string; count: number | string }> = [
    { value: 'all', label: 'All', count: counts?.all ?? '--' },
    { value: 'service', label: 'Services', count: counts?.services ?? '--' },
    { value: 'vendor', label: 'Businesses', count: counts?.vendors ?? '--' },
  ];

  const selectFilter = (next: Filter) => {
    setFilter(next);
    setPage(1);
    setActionError(null);
    setActionStatus(null);
    setRefreshWarning(null);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[nextIndex];
    selectFilter(next.value);
    window.requestAnimationFrame(() => document.getElementById(`favorites-tab-${next.value}`)?.focus());
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12" aria-busy={authLoading || query.isPending}>
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Repeat business</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Favorites</h1>
            <p className="mt-2 text-sm text-slate-600">Save businesses you trust and public services you may want to use in the future.</p>
            <p className="mt-1 text-sm text-slate-500">Your completed work remains in <Link href="/my-bookings" className="font-semibold text-blue-700 underline">My Service Records</Link>.</p>
          </div>
          <Link href="/discover" className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Explore Work</Link>
        </div>
        <label className="relative mt-5 block max-w-xl">
          <span className="sr-only">Search Favorites</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" autoComplete="off" aria-controls="favorites-panel" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search saved services or businesses" className="w-full rounded-md border border-slate-300 py-2.5 pl-10 pr-3 text-sm" />
        </label>
      </header>

      <div role="tablist" aria-label="Favorite type" className="flex gap-2 border-b border-slate-200">
        {tabs.map(({ value, label, count }, index) => (
          <button
            key={value}
            id={`favorites-tab-${value}`}
            type="button"
            role="tab"
            aria-controls="favorites-panel"
            aria-selected={filter === value}
            tabIndex={filter === value ? 0 : -1}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            onClick={() => selectFilter(value)}
            className={`border-b-2 px-3 py-3 text-sm font-semibold ${filter === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            {label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{count}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {actionError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p> : null}
        {actionStatus ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{actionStatus}</p> : null}
        {refreshWarning ? <p role="status" className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{refreshWarning}</p> : null}
        {query.isFetching && query.data ? <p role="status" className="text-sm text-slate-500">Updating Favorites...</p> : null}
      </div>

      <div id="favorites-panel" role="tabpanel" aria-labelledby={`favorites-tab-${filter}`}>
        {authLoading || query.isPending ? (
          <p role="status" className="text-sm text-slate-600">Loading Favorites...</p>
        ) : query.isError && !query.data ? (
          <CustomerLoadError message="Unable to load Favorites." onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <Heart aria-hidden="true" className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900">{empty}</p>
            {search ? (
              <p className="mt-1 text-sm text-slate-500">No matches for &ldquo;{search}&rdquo;. Try a different search.</p>
            ) : filter === 'service' ? (
              <p className="mt-1 text-sm text-slate-500">Save a public service from <Link href="/discover" className="font-semibold text-blue-700 underline">Explore Work</Link> or a business&apos;s Services page.</p>
            ) : filter === 'vendor' ? (
              <p className="mt-1 text-sm text-slate-500">Save a business you&apos;d like to use again.</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Explore businesses and services to save things you&apos;d like to revisit.</p>
            )}
          </div>
        ) : (
          <section aria-label="Saved Favorites" className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => item.entityType === 'vendor'
              ? <VendorCard key={`vendor-${item.favoriteId}`} item={item} busy={busyId === item.favoriteId} onRemove={() => void remove(item)} />
              : <ServiceCard key={`service-${item.favoriteId}`} item={item} busy={busyId === item.favoriteId} onRemove={() => void remove(item)} />)}
          </section>
        )}
      </div>

      {pagination.totalPages > 1 ? (
        <nav aria-label="Favorite pages" className="flex items-center justify-between border-t border-slate-200 pt-5">
          <p aria-live="polite" className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} saved</p>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" aria-label="Next page" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function RemoveButton({ busy, itemName, onRemove }: { busy: boolean; itemName: string; onRemove: () => void }) {
  return (
    <button type="button" aria-label={busy ? `Removing ${itemName} from Favorites` : `Remove ${itemName} from Favorites`} disabled={busy} onClick={onRemove} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
      <Trash2 aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function VendorCard({ item, busy, onRemove }: { item: Extract<FavoriteListItem, { entityType: 'vendor' }>; busy: boolean; onRemove: () => void }) {
  const titleId = `favorite-title-${item.favoriteId}`;
  return (
    <article aria-labelledby={titleId} className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></span>
          <div><p className="text-xs font-semibold uppercase text-blue-700">Saved Business</p><h2 id={titleId} className="text-lg font-semibold text-slate-950">{item.vendorName}</h2></div>
        </div>
        <RemoveButton busy={busy} itemName={item.vendorName} onRemove={onRemove} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        {item.location ? <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="h-4 w-4" />{item.location}</span> : null}
        <span>{item.serviceCount} available {item.serviceCount === 1 ? 'service' : 'services'}</span>
        {item.rating != null && item.reviewCount != null ? <span>{item.rating.toFixed(1)} Vendor Rating · {item.reviewCount}</span> : null}
      </div>
      {item.isPubliclyListed ? (
        <div className="mt-5 flex gap-2"><Link href={buildVendorProfileHref(item.vendorId, '/favorites', 'Back to Favorites')} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">View Business</Link></div>
      ) : <p className="mt-5 text-sm text-slate-600">This saved Business is not currently available in Explore Work.</p>}
    </article>
  );
}

function ServiceCard({ item, busy, onRemove }: { item: Exclude<FavoriteListItem, { entityType: 'vendor' }>; busy: boolean; onRemove: () => void }) {
  const vendorEligible = item.publicListing.vendorEligible !== false;
  const titleId = `favorite-title-${item.favoriteId}`;
  return (
    <article aria-labelledby={titleId} className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-40 w-full shrink-0 overflow-hidden rounded-md bg-slate-100 sm:h-24 sm:w-32"><PublicMediaPreview url={item.previewMediaUrl} type={item.previewMediaType} alt={item.serviceName} className="h-full w-full object-cover" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase text-blue-700">{item.publicListing.serviceEligible ? 'Saved Public Service' : 'Saved Service'}</p><h2 id={titleId} className="break-words text-lg font-semibold text-slate-950">{item.serviceName}</h2><p className="text-sm text-slate-600">Offered by {item.vendorName}</p></div>
            <RemoveButton busy={busy} itemName={item.serviceName} onRemove={onRemove} />
          </div>
          {item.rating != null && item.reviewCount != null ? <p className="mt-2 text-sm text-slate-600">{item.rating.toFixed(1)} Vendor Rating · {item.reviewCount}</p> : null}
        </div>
      </div>
      {!item.publicListing.serviceEligible ? <p className="mt-5 text-sm text-slate-600">This saved Service is not currently available in Explore Work.</p> : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {item.publicListing.serviceEligible ? <Link href={`/service/${item.serviceId}?returnTo=${encodeURIComponent('/favorites')}&returnLabel=${encodeURIComponent('Back to Favorites')}`} className="rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white">View Service</Link> : null}
        {vendorEligible ? <Link href={buildVendorProfileHref(item.vendorId, '/favorites', 'Back to Favorites')} className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700">View Business</Link> : null}
        {item.publicListing.serviceEligible ? <Link href={`/booking/${item.serviceId}`} className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700">Request Service</Link> : null}
      </div>
    </article>
  );
}
