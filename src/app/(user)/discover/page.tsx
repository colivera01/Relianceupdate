'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, Heart, LocateFixed } from 'lucide-react';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { useAddFavorite, useFavoritesOptional, useRemoveFavorite } from '@/hooks/useFavorites';
import { ProofFirstCard } from '@/components/public/ProofFirstCard';
import { useAuth } from '@/contexts/AuthContext';
import { getClientSessionHeaders } from '@/lib/client-session';
import type { DiscoverServiceResult } from '@/types/api';

type CustomerLocationProfile = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationPreferenceEnabled?: boolean | null;
};

type LocationOrigin = {
  latitude: number;
  longitude: number;
};

const PROOF_CARD_DISPLAY_RANK: Record<string, number> = {
  public_proof: 0,
  partial_proof: 1,
  service_offered_only: 2,
};

function buildDiscoverUrl(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `/api/services/discover?${query}` : '/api/services/discover';
}

export default function UserDiscoverPage() {
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'name'>('newest');
  const [page, setPage] = useState(1);
  const [favoriteActionError, setFavoriteActionError] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerLocationProfile | null>(null);
  const [browserLocationOrigin, setBrowserLocationOrigin] = useState<LocationOrigin | null>(null);
  const [browserLocationLoading, setBrowserLocationLoading] = useState(false);
  const [browserLocationMessage, setBrowserLocationMessage] = useState<string | null>(null);
  const [nearbyServices, setNearbyServices] = useState<DiscoverServiceResult[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const DISCOVERY_PAGE_SIZE = 12;
  const proofDemoEnabled = searchParams?.get('proofDemo') === '1';

  const filters = useMemo(
    () => ({
      q: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      sortBy,
      ...(proofDemoEnabled ? { proofDemo: '1' } : {}),
      page,
      limit: DISCOVERY_PAGE_SIZE,
    }),
    [page, proofDemoEnabled, searchQuery, selectedCategory, sortBy]
  );

  const { data, isLoading, isError, error, isFetching } = useDiscoverServices(filters);
  const { data: categoryData } = useServiceCategories();
  const {
    data: favoritesData,
    isLoading: favoritesLoading,
    isError: favoritesError,
  } = useFavoritesOptional({ page: 1, limit: 200 });
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const categories = categoryData?.categories || [];
  const results = data?.results || [];
  const displayResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        const aRank = PROOF_CARD_DISPLAY_RANK[a.proofCard?.kind || 'service_offered_only'] ?? 2;
        const bRank = PROOF_CARD_DISPLAY_RANK[b.proofCard?.kind || 'service_offered_only'] ?? 2;
        return aRank - bRank;
      }),
    [results]
  );
  const displayNearbyServices = useMemo(
    () =>
      [...nearbyServices].sort((a, b) => {
        const aRank = PROOF_CARD_DISPLAY_RANK[a.proofCard?.kind || 'service_offered_only'] ?? 2;
        const bRank = PROOF_CARD_DISPLAY_RANK[b.proofCard?.kind || 'service_offered_only'] ?? 2;
        return aRank - bRank;
      }),
    [nearbyServices]
  );
  const favorites = favoritesData?.favorites || [];
  const favoriteByServiceId = new Map(favorites.map((item) => [item.serviceId, item.favoriteId]));
  const favoritesUnavailable = favoritesError;
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 0;
  const totalCount = pagination?.total || 0;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !authUser?.id) {
      setCustomerProfile(null);
      return;
    }

    let cancelled = false;
    const loadCustomerProfile = async () => {
      try {
        const res = await fetch('/api/customer/profile', {
          headers: {
            'Content-Type': 'application/json',
            ...getClientSessionHeaders(authUser.id),
          },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          setCustomerProfile(res.ok && json?.profile ? json.profile : null);
        }
      } catch {
        if (!cancelled) setCustomerProfile(null);
      }
    };

    void loadCustomerProfile();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authUser?.id, isAuthenticated]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    let cancelled = false;

    const resolveBrowserLocationIfAllowed = async () => {
      if (!navigator.geolocation || !navigator.permissions?.query) {
        return;
      }

      try {
        const permission = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        if (cancelled) return;

        if (permission.state !== 'granted') {
          return;
        }

        setBrowserLocationLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            const { latitude, longitude } = position.coords;
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
              setBrowserLocationOrigin({ latitude, longitude });
            }
            setBrowserLocationLoading(false);
          },
          () => {
            if (cancelled) return;
            setBrowserLocationLoading(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 5 * 60 * 1000,
          }
        );
      } catch {
        setBrowserLocationLoading(false);
      }
    };

    void resolveBrowserLocationIfAllowed();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedLocationOrigin =
    customerProfile?.locationPreferenceEnabled &&
    Number.isFinite(customerProfile?.latitude) &&
    Number.isFinite(customerProfile?.longitude)
      ? {
          latitude: Number(customerProfile.latitude),
          longitude: Number(customerProfile.longitude),
        }
      : null;

  const effectiveLocationOrigin = browserLocationOrigin || savedLocationOrigin;
  const effectiveLocationSource = browserLocationOrigin
    ? 'current'
    : savedLocationOrigin
      ? 'saved'
      : 'none';
  const nearbyDescription =
    effectiveLocationSource === 'current'
      ? 'Showing vendor services within 50 miles of your current location.'
      : effectiveLocationSource === 'saved'
        ? 'Showing vendor services within 50 miles of your saved address.'
        : 'Turn on location or add your address to see nearby vendor services.';

  useEffect(() => {
    if (!effectiveLocationOrigin) {
      setNearbyServices([]);
      setNearbyLoading(false);
      setNearbyError(null);
      return;
    }

    let cancelled = false;
    const loadNearbyServices = async () => {
      try {
        setNearbyLoading(true);
        setNearbyError(null);
        const res = await fetch(
          buildDiscoverUrl({
            sortBy: 'distance',
            limit: 4,
            lat: effectiveLocationOrigin.latitude,
            lng: effectiveLocationOrigin.longitude,
            radiusMiles: 50,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(json?.error || 'Nearby services could not load.'));
        }
        if (!cancelled) {
          setNearbyServices(Array.isArray(json?.results) ? json.results : []);
        }
      } catch (err) {
        if (!cancelled) {
          setNearbyServices([]);
          setNearbyError(err instanceof Error ? err.message : 'Nearby services could not load.');
        }
      } finally {
        if (!cancelled) setNearbyLoading(false);
      }
    };

    void loadNearbyServices();
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationOrigin?.latitude, effectiveLocationOrigin?.longitude]);

  const handleSearchSubmit = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedCategory('all');
    setSortBy('newest');
    setPage(1);
  };

  const handleUseCurrentLocation = () => {
    setBrowserLocationMessage(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setBrowserLocationMessage('Current location is not available in this browser.');
      return;
    }

    setBrowserLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setBrowserLocationMessage('Reliance could not read a usable current location.');
          setBrowserLocationLoading(false);
          return;
        }
        setBrowserLocationOrigin({ latitude, longitude });
        setBrowserLocationMessage(null);
        setBrowserLocationLoading(false);
      },
      (locationError) => {
        setBrowserLocationMessage(
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Location access was denied. You can still add or enable a saved address from Profile & Settings.'
            : 'Reliance could not access your current location right now.'
        );
        setBrowserLocationLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  };

  const handleToggleFavorite = async (serviceId: string) => {
    setFavoriteActionError(null);
    try {
      const favoriteId = favoriteByServiceId.get(serviceId);
      if (favoriteId) {
        await removeFavorite.mutateAsync(favoriteId);
        return;
      }
      await addFavorite.mutateAsync(serviceId);
    } catch (error: any) {
      setFavoriteActionError(error?.message || 'Failed to update favorite');
    }
  };
  const serviceReturnHref = '/discover';
  const serviceReturnLabel = 'Back to Explore Proof';

  const renderServiceCard = (item: DiscoverServiceResult) => {
    return (
      <ProofFirstCard
        key={item.serviceId}
        item={item}
        proofHref={`/service/${item.serviceId}?returnTo=${encodeURIComponent(serviceReturnHref)}&returnLabel=${encodeURIComponent(serviceReturnLabel)}`}
        providerHref={`/vendors/${item.vendorId}`}
        compact={Boolean(item.distanceMiles)}
        secondaryAction={
          <Button
            size="sm"
            variant="outline"
            data-testid={`discover-favorite-toggle-${item.serviceId}`}
            disabled={favoritesUnavailable || favoritesLoading || addFavorite.isPending || removeFavorite.isPending}
            onClick={() => handleToggleFavorite(item.serviceId)}
            className="border-white/15 bg-white/[0.04] px-3 text-white hover:bg-white/[0.08]"
            aria-label={favoriteByServiceId.has(item.serviceId) ? 'Remove from favorites' : 'Add to favorites'}
            title={favoritesUnavailable ? 'Favorites unavailable in current auth context' : undefined}
          >
            <Heart
              className={`h-4 w-4 ${favoriteByServiceId.has(item.serviceId) ? 'fill-current text-pink-300' : 'text-slate-200'}`}
            />
          </Button>
        }
      />
    );
  };

  return (
    <div className="pt-4 sm:pt-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-3 text-3xl font-semibold text-gray-900">Explore Proof</h1>
          <p className="max-w-3xl text-gray-600">See completed work, Public Service Videos, customer reviews, Reliance Trust Score, and Services Offered before choosing who to contact.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex w-full items-center justify-center gap-2 sm:w-auto">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="relative mb-10 flex flex-col gap-3 sm:block">
        <Search className="absolute left-3 top-6 h-5 w-5 -translate-y-1/2 text-gray-400 sm:top-1/2" />
        <input
          type="text"
          placeholder="Search completed work, providers, reviews, or services offered..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearchSubmit();
          }}
          className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500 sm:pr-24"
        />
        <Button onClick={handleSearchSubmit} className="h-10 w-full sm:absolute sm:right-2 sm:top-1/2 sm:h-8 sm:w-auto sm:-translate-y-1/2">
          Search
        </Button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-4 border mb-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Clear All
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Services Offered</option>
                {categories.map((category) => (
                  <option key={category.key} value={category.label}>
                    {category.label} ({category.serviceCount})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc' | 'name');
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Newest</option>
                <option value="name">Name</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Use search, category, reviews, videos, and Trust Score context to narrow visible providers. Nearby results use real location context when available.
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          {isFetching ? 'Refreshing...' : `Showing ${results.length} of ${totalCount} results`}
        </div>
      </div>
      {favoriteActionError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-10 text-sm text-amber-800">
          {favoriteActionError}
        </div>
      ) : null}

      <section className="mb-10 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Local proof</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Providers with proof near you</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">{nearbyDescription}</p>
            {browserLocationMessage ? (
              <p className="mt-2 text-sm font-medium text-amber-800">{browserLocationMessage}</p>
            ) : null}
          </div>
          {effectiveLocationSource === 'none' ? (
            <div className="reliance-mobile-actions flex flex-wrap gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={browserLocationLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <LocateFixed className="mr-2 h-4 w-4" />
                {browserLocationLoading ? 'Checking location...' : 'Use my location'}
              </Button>
              <Link href="/profile-settings">
                <Button type="button" variant="outline">
                  Add saved address
                </Button>
              </Link>
            </div>
          ) : null}
        </div>

        {effectiveLocationSource === 'none' ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm text-slate-700">
            Reliance will not show fake nearby results. Turn on location or add your address to see
            providers and Public Service Videos within 50 miles.
          </div>
        ) : nearbyLoading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="rounded-2xl border border-blue-100 bg-white p-4 animate-pulse">
                <div className="mb-3 h-32 rounded-lg bg-blue-100" />
                <div className="mb-2 h-4 w-3/4 rounded bg-blue-100" />
                <div className="h-3 w-1/2 rounded bg-blue-100" />
              </div>
            ))}
          </div>
        ) : nearbyError ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-amber-800">
            {nearbyError}
          </div>
        ) : displayNearbyServices.length === 0 ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm text-slate-700">
            No providers with matching public results were found within 50 miles of your{' '}
            {effectiveLocationSource === 'current' ? 'current location' : 'saved address'} yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {displayNearbyServices.map(renderServiceCard)}
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-lg" />
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-3" />
                <div className="h-3 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded mb-4 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-10 text-red-700">
          We could not load proof results.
          {error instanceof Error ? ` ${error.message}` : ''}
        </div>
      ) : displayResults.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No matching proof results</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search terms or filters.</p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayResults.map(renderServiceCard)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
} 
