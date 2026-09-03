'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Heart, MapPin, Search, Trash2 } from 'lucide-react';
import { useAllFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesSDK } from '@/sdk/favorites';
import type { FavoriteListItem } from '@/types/api';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';

type Filter = 'all' | 'service' | 'vendor';

export default function FavoritesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useAllFavorites({ page, limit: 12, type: filter, search });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const remove = async (item: FavoriteListItem) => {
    setBusyId(item.favoriteId);
    setActionError(null);
    try {
      if (item.entityType === 'vendor') await favoritesSDK.removeVendorFavorite(item.favoriteId, user?.id);
      else await favoritesSDK.removeFavorite(item.favoriteId, user?.id);
      await query.refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Unable to remove this favorite.');
    } finally {
      setBusyId(null);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return <main className="mx-auto max-w-4xl py-12"><h1 className="text-3xl font-semibold text-slate-950">Favorites</h1><p className="mt-3 text-slate-600">Sign in to see your Saved Services and Saved Vendors.</p><Link href="/auth/login?next=%2Ffavorites" className="mt-5 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Sign In</Link></main>;
  }

  const items = query.data?.items || [];
  const counts = query.data?.counts || { all: 0, services: 0, vendors: 0 };
  const pagination = query.data?.pagination || { page: 1, totalPages: 0, total: 0, limit: 12 };
  const empty = filter === 'service' ? 'No saved services yet.' : filter === 'vendor' ? 'No saved businesses yet.' : 'No favorites yet.';

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold uppercase text-blue-700">Repeat business</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">Favorites</h1><p className="mt-2 text-sm text-slate-600">Keep Services and Vendors you may want to use again.</p></div>
          <Link href="/discover" className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Explore Proof</Link>
        </div>
        <label className="relative mt-5 block max-w-xl"><span className="sr-only">Search Favorites</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search Saved Services or Vendors" className="w-full rounded-md border border-slate-300 py-2.5 pl-10 pr-3 text-sm" /></label>
      </header>

      <div role="tablist" aria-label="Favorite type" className="flex gap-2 border-b border-slate-200">
        {([
          ['all', 'All', counts.all],
          ['service', 'Services', counts.services],
          ['vendor', 'Vendors', counts.vendors],
        ] as const).map(([value, label, count]) => <button key={value} role="tab" aria-selected={filter === value} onClick={() => { setFilter(value); setPage(1); }} className={`border-b-2 px-3 py-3 text-sm font-semibold ${filter === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{count}</span></button>)}
      </div>

      {actionError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p> : null}
      {authLoading || query.isLoading ? <p className="text-sm text-slate-600">Loading Favorites...</p> : query.isError ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">Unable to load Favorites.</p> : items.length === 0 ? <div className="py-12 text-center"><Heart className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-900">{empty}</p>{search ? <p className="mt-1 text-sm text-slate-500">Try a different search.</p> : null}</div> : (
        <section className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => item.entityType === 'vendor'
            ? <VendorCard key={`vendor-${item.favoriteId}`} item={item} busy={busyId === item.favoriteId} onRemove={() => void remove(item)} />
            : <ServiceCard key={`service-${item.favoriteId}`} item={item} busy={busyId === item.favoriteId} onRemove={() => void remove(item)} />)}
        </section>
      )}

      {pagination.totalPages > 1 ? <nav aria-label="Favorite pages" className="flex items-center justify-between border-t border-slate-200 pt-5"><p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} saved</p><div className="flex gap-2"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button aria-label="Next page" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></nav> : null}
    </main>
  );
}

function RemoveButton({ busy, onRemove }: { busy: boolean; onRemove: () => void }) {
  return <button type="button" aria-label="Remove from Favorites" disabled={busy} onClick={onRemove} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>;
}

function VendorCard({ item, busy, onRemove }: { item: Extract<FavoriteListItem, { entityType: 'vendor' }>; busy: boolean; onRemove: () => void }) {
  return <article className="rounded-md border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-blue-700">Saved Vendor</p><h2 className="text-lg font-semibold text-slate-950">{item.vendorName}</h2></div></div><RemoveButton busy={busy} onRemove={onRemove} /></div><div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">{item.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{item.location}</span> : null}<span>{item.serviceCount} available {item.serviceCount === 1 ? 'service' : 'services'}</span>{item.rating != null && item.reviewCount != null ? <span>{item.rating.toFixed(1)} Vendor Rating · {item.reviewCount}</span> : null}</div><div className="mt-5 flex gap-2"><Link href={`/vendors/${item.vendorId}?returnTo=${encodeURIComponent('/favorites')}&returnLabel=${encodeURIComponent('Back to Favorites')}`} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">View Business</Link></div></article>;
}

function ServiceCard({ item, busy, onRemove }: { item: Exclude<FavoriteListItem, { entityType: 'vendor' }>; busy: boolean; onRemove: () => void }) {
  return <article className="rounded-md border border-slate-200 bg-white p-5"><div className="flex gap-4"><div className="h-24 w-32 shrink-0 overflow-hidden rounded-md bg-slate-100"><PublicMediaPreview url={item.previewMediaUrl} type={item.previewMediaType} alt={item.serviceName} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase text-blue-700">Saved Service</p><h2 className="truncate text-lg font-semibold text-slate-950">{item.serviceName}</h2><p className="text-sm text-slate-600">{item.vendorName}</p></div><RemoveButton busy={busy} onRemove={onRemove} /></div>{item.rating != null && item.reviewCount != null ? <p className="mt-2 text-sm text-slate-600">{item.rating.toFixed(1)} Vendor Rating · {item.reviewCount}</p> : null}</div></div><div className="mt-5 flex flex-wrap gap-2">{item.publicListing.serviceEligible ? <Link href={`/service/${item.serviceId}?returnTo=${encodeURIComponent('/favorites')}&returnLabel=${encodeURIComponent('Back to Favorites')}`} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">View Service</Link> : null}<Link href={`/vendors/${item.vendorId}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">View Business</Link>{item.publicListing.serviceEligible ? <Link href={`/booking/${item.serviceId}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Request Service</Link> : null}</div></article>;
}
