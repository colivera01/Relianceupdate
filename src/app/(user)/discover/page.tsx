'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, SlidersHorizontal, X, ChevronLeft, ChevronRight, Heart, LocateFixed } from 'lucide-react';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { useAddFavorite, useFavoritesOptional, useRemoveFavorite } from '@/hooks/useFavorites';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { CustomerTrustSignalCard } from '@/components/public/CustomerTrustSignalCard';
import { getCustomerReviewCopy } from '@/lib/customer-review-copy';
import { getCustomerTrustScoreCopy } from '@/lib/customer-trust-score-copy';
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

  const filters = useMemo(
    () => ({
      q: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      sortBy,
      page,
      limit: DISCOVERY_PAGE_SIZE,
    }),
    [searchQuery, selectedCategory, sortBy, page]
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
      ? 'Showing public proof and services offered within 50 miles of your current location.'
      : effectiveLocationSource === 'saved'
        ? 'Showing public proof and services offered within 50 miles of your saved address.'
        : 'Turn on location or add your address to see public proof near you.';

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
    const trustCopy = getCustomerTrustScoreCopy({
      hasPublicMedia: item.publicListing.hasPublicMedia,
      reviewCount: item.reviewCount,
      trustScore: item.trustScore,
    });
    const reviewCopy = getCustomerReviewCopy({
      rating: item.rating,
      reviewCount: item.reviewCount,
    });

    return (
      <Card key={item.serviceId} className="hover:shadow-lg transition-shadow mb-4">
        <div className="relative">
          <PublicMediaPreview
            url={item.previewMediaUrl}
            type={item.previewMediaType}
            alt={item.serviceName}
            className="w-full h-48 object-cover rounded-t-lg"
            emptyLabel="No public service video yet"
            videoLabel="Service video available"
          />
        </div>

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-lg text-gray-900">{item.serviceName}</h3>
            {item.vendorCategory ? <Badge variant="outline" className="text-xs">{item.vendorCategory}</Badge> : null}
          </div>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {item.serviceDescription || 'No description yet.'}
          </p>
          <p className="text-sm text-gray-900 font-medium mb-1">Vendor: {item.vendorName}</p>
          {item.vendorBusinessType ? (
            <p className="text-xs text-gray-600 mb-1">Business Type: {item.vendorBusinessType}</p>
          ) : null}
          {item.location ? (
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <MapPin className="h-4 w-4 mr-1" />
              {item.location}
            </div>
          ) : null}
          {typeof item.distanceMiles === 'number' ? (
            <div className="mb-2 inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {item.distanceMiles.toFixed(1)} mi away
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl bg-blue-50 px-3 py-2 text-blue-900">
              <div className="font-semibold">{reviewCopy.headline}</div>
              <div className="text-blue-700">{reviewCopy.detail}</div>
            </div>
            <CustomerTrustSignalCard copy={trustCopy} />
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="text-base font-bold text-gray-900">${item.price.toFixed(2)}</div>
            {item.publicListing.hasPublicMedia ? (
              <Badge className="bg-blue-100 text-blue-800">Public service video</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-700">No public video yet</Badge>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Link
              href={`/service/${item.serviceId}?returnTo=${encodeURIComponent(serviceReturnHref)}&returnLabel=${encodeURIComponent(serviceReturnLabel)}`}
              className="block"
            >
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                View Proof
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Link href={`/vendors/${item.vendorId}`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full">
                  View Vendor
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                data-testid={`discover-favorite-toggle-${item.serviceId}`}
                disabled={favoritesUnavailable || favoritesLoading || addFavorite.isPending || removeFavorite.isPending}
                onClick={() => handleToggleFavorite(item.serviceId)}
                className="px-3"
                aria-label={favoriteByServiceId.has(item.serviceId) ? 'Remove from favorites' : 'Add to favorites'}
                title={favoritesUnavailable ? 'Favorites unavailable in current auth context' : undefined}
              >
                <Heart
                  className={`h-4 w-4 ${favoriteByServiceId.has(item.serviceId) ? 'fill-current text-pink-600' : 'text-gray-600'}`}
                />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="pt-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">Explore Public Proof</h1>
          <p className="text-gray-600">Compare completed work, public reviews, service videos, and provider details in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="relative mb-10">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Search services offered, vendors, or public proof..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearchSubmit();
          }}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Button onClick={handleSearchSubmit} className="absolute right-2 top-1/2 -translate-y-1/2 h-8">
          Search
        </Button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-4 border mb-10">
          <div className="flex items-center justify-between mb-4">
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
            Use search, category, and proof context to narrow visible providers. Public proof near you uses real location context when available.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {isFetching ? 'Refreshing...' : `Showing ${results.length} of ${totalCount} proof sources`}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Public proof near you</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Proof Available Near You</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">{nearbyDescription}</p>
            {browserLocationMessage ? (
              <p className="mt-2 text-sm font-medium text-amber-800">{browserLocationMessage}</p>
            ) : null}
          </div>
          {effectiveLocationSource === 'none' ? (
            <div className="flex flex-wrap gap-3">
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
            public proof within 50 miles.
          </div>
        ) : nearbyLoading ? (
          <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        ) : nearbyServices.length === 0 ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm text-slate-700">
            No public proof or services offered were found within 50 miles of your{' '}
            {effectiveLocationSource === 'current' ? 'current location' : 'saved address'} yet.
          </div>
        ) : (
          <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {nearbyServices.map(renderServiceCard)}
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
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
          Failed to load discover results.
          {error instanceof Error ? ` ${error.message}` : ''}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No public proof found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search terms or filters.</p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {results.map(renderServiceCard)}
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
