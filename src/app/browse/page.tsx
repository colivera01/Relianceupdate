'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal, X, MapPin, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { useAuth } from '@/contexts/AuthContext';

const DISCOVERY_PAGE_SIZE = 12;

const CATEGORY_DECORATION: Record<string, { icon: string; description: string }> = {
  automotive: { icon: '🚗', description: 'Vehicle and transportation services' },
  'home services': { icon: '🏠', description: 'Home maintenance and improvement' },
  technology: { icon: '💻', description: 'Tech support and digital services' },
  'health & wellness': { icon: '💊', description: 'Personal wellness services' },
  beauty: { icon: '💄', description: 'Beauty and personal care services' },
  education: { icon: '📚', description: 'Learning and tutoring services' },
  uncategorized: { icon: '🧩', description: 'Services without a category label' },
};

type BrowseSort = 'newest' | 'name' | 'distance';

function normalizeSortBy(value: string | null): BrowseSort {
  if (value === 'distance') return value;
  if (value === 'name') return value;
  return 'newest';
}

function parseOptionalNumber(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistanceMiles(value: number): string {
  return `${value.toFixed(1)} miles away`;
}

function hasCustomerProfileAccess(userType: string | undefined): boolean {
  return userType === 'customer' || userType === 'both';
}

export default function PublicBrowsePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<BrowseSort>('newest');
  const [originLat, setOriginLat] = useState<number | null>(null);
  const [originLng, setOriginLng] = useState<number | null>(null);
  const [browserLocationOrigin, setBrowserLocationOrigin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [browserLocationLoading, setBrowserLocationLoading] = useState(false);
  const [browserLocationMessage, setBrowserLocationMessage] = useState<string | null>(null);
  const [savedLocationOrigin, setSavedLocationOrigin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savedLocationDisabled, setSavedLocationDisabled] = useState(false);
  const [savedLocationChecked, setSavedLocationChecked] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasHydratedFromUrl, setHasHydratedFromUrl] = useState(false);
  const didHydrateFromUrl = useRef(false);

  useEffect(() => {
    if (didHydrateFromUrl.current || typeof window === 'undefined') return;
    didHydrateFromUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const category = String(params.get('category') || '').trim();
    const q = String(params.get('q') || '').trim();
    const nextLat = parseOptionalNumber(params.get('lat'));
    const nextLng = parseOptionalNumber(params.get('lng'));
    const nextRadiusMiles = parseOptionalNumber(params.get('radiusMiles'));
    const nextSortBy = normalizeSortBy(params.get('sortBy'));

    if (category) {
      setSelectedCategory(category);
      setPage(1);
    }
    if (q) {
      setSearchInput(q);
      setSearchQuery(q);
      setPage(1);
    }
    if (nextSortBy !== 'newest' && (nextSortBy !== 'distance' || (nextLat != null && nextLng != null))) {
      setSortBy(nextSortBy);
      setPage(1);
    }
    if (nextLat != null && nextLng != null) {
      setOriginLat(nextLat);
      setOriginLng(nextLng);
    }
    if (nextRadiusMiles != null && nextRadiusMiles > 0) {
      setRadiusMiles(nextRadiusMiles);
    }
    setHasHydratedFromUrl(true);
  }, []);

  const hasCoordinateOrigin = originLat != null && originLng != null;
  const browserLocationActive = !hasCoordinateOrigin && browserLocationOrigin != null;
  const savedLocationAssistActive =
    !hasCoordinateOrigin && !browserLocationActive && !savedLocationDisabled && savedLocationOrigin != null;
  const effectiveOriginLat = hasCoordinateOrigin
    ? originLat
    : browserLocationActive
    ? browserLocationOrigin.latitude
    : savedLocationAssistActive
    ? savedLocationOrigin.latitude
    : null;
  const effectiveOriginLng = hasCoordinateOrigin
    ? originLng
    : browserLocationActive
    ? browserLocationOrigin.longitude
    : savedLocationAssistActive
    ? savedLocationOrigin.longitude
    : null;
  const hasEffectiveCoordinateOrigin = effectiveOriginLat != null && effectiveOriginLng != null;
  const canRequestBrowserLocation =
    savedLocationChecked && !hasCoordinateOrigin && !browserLocationActive && !savedLocationAssistActive;

  useEffect(() => {
    if (authLoading || !hasHydratedFromUrl) return;
    if (!isAuthenticated || !user || !hasCustomerProfileAccess(user.userType)) {
      setSavedLocationChecked(true);
      return;
    }

    let cancelled = false;
    setSavedLocationChecked(false);
    fetch('/api/customer/profile', {
      headers: {
        Authorization: 'Bearer temp-jwt-token',
        'x-user-id': user.id,
      },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const profile = payload?.profile;
        const latitude = Number(profile?.latitude);
        const longitude = Number(profile?.longitude);
        if (
          profile?.locationPreferenceEnabled === true &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude)
        ) {
          setSavedLocationOrigin({ latitude, longitude });
        } else {
          setSavedLocationOrigin(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSavedLocationOrigin(null);
      })
      .finally(() => {
        if (!cancelled) setSavedLocationChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, hasHydratedFromUrl, isAuthenticated, user]);

  useEffect(() => {
    if (!hasHydratedFromUrl || typeof window === 'undefined') return;

    const params = new URLSearchParams();
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) params.set('q', trimmedSearch);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (sortBy !== 'newest') params.set('sortBy', sortBy);
    if (hasCoordinateOrigin) {
      params.set('lat', String(originLat));
      params.set('lng', String(originLng));
    }
    if (hasCoordinateOrigin && radiusMiles != null && radiusMiles > 0) {
      params.set('radiusMiles', String(radiusMiles));
    }

    const nextUrl = params.toString() ? `/browse?${params.toString()}` : '/browse';
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [hasCoordinateOrigin, hasHydratedFromUrl, originLat, originLng, radiusMiles, searchQuery, selectedCategory, sortBy]);

  const discoveryFilters = useMemo(
    () => ({
      q: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      sortBy,
      ...(hasEffectiveCoordinateOrigin ? { lat: effectiveOriginLat, lng: effectiveOriginLng } : {}),
      ...(hasEffectiveCoordinateOrigin && radiusMiles != null && radiusMiles > 0 ? { radiusMiles } : {}),
      page,
      limit: DISCOVERY_PAGE_SIZE,
    }),
    [
      effectiveOriginLat,
      effectiveOriginLng,
      hasEffectiveCoordinateOrigin,
      radiusMiles,
      searchQuery,
      selectedCategory,
      sortBy,
      page,
    ]
  );

  const { data, isLoading, isError, error, isFetching } = useDiscoverServices(discoveryFilters);
  const {
    data: categoryData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useServiceCategories();

  const categories = categoryData?.categories || [];
  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedCategory !== 'all';
  const hasSelectedCategoryOption =
    selectedCategory === 'all' ||
    categories.some((category) => category.label === selectedCategory);

  const results = data?.results || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 0;
  const totalCount = pagination?.total || 0;

  const handleSearchSubmit = () => {
    setPage(1);
    setSearchQuery(searchInput);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedCategory('all');
    setSortBy('newest');
    setOriginLat(null);
    setOriginLng(null);
    setBrowserLocationOrigin(null);
    setBrowserLocationMessage(null);
    setSavedLocationDisabled(true);
    setRadiusMiles(null);
    setPage(1);
  };

  const stopUsingSavedLocation = () => {
    setSavedLocationDisabled(true);
    setRadiusMiles(null);
    if (sortBy === 'distance') setSortBy('newest');
    setPage(1);
  };

  const stopUsingBrowserLocation = () => {
    setBrowserLocationOrigin(null);
    setBrowserLocationMessage(null);
    setRadiusMiles(null);
    if (sortBy === 'distance') setSortBy('newest');
    setPage(1);
  };

  const handleUseCurrentLocation = () => {
    setBrowserLocationMessage(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setBrowserLocationMessage('Current location is not available in this browser. You can keep browsing normally.');
      return;
    }

    setBrowserLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setBrowserLocationMessage('We could not read a usable location. You can keep browsing normally.');
          setBrowserLocationLoading(false);
          return;
        }

        setBrowserLocationOrigin({ latitude, longitude });
        setBrowserLocationMessage(null);
        setSavedLocationDisabled(true);
        setPage(1);
        setBrowserLocationLoading(false);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setBrowserLocationMessage(
          denied
            ? 'Location access was denied. You can still browse normally.'
            : 'We could not access your location. You can keep browsing or use a saved address instead.'
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

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setPage(1);
    setShowFilters(false);
  };

  const handleShareService = (serviceId: string, serviceName: string) => {
    const url = `${window.location.origin}/service/${serviceId}`;
    const text = `Check out ${serviceName} on Reliance!`;

    if (navigator.share) {
      navigator.share({ title: serviceName, text, url }).catch(() => {
        // Ignore share cancellation.
      });
      return;
    }

    navigator.clipboard.writeText(`${text} ${url}`).catch(() => {
      // Clipboard unavailable in some contexts.
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-white">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-3">
                <img src="/reliance-logo.png" alt="Reliance" className="h-8 w-8" />
                <span className="text-xl font-bold text-gray-900">RELIANCE</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/register?type=user">
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  Sign Up
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-white/80 px-4 py-1 text-sm font-medium text-blue-700 shadow-sm mb-5">
            Trusted local proof, all in one place
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-950 mb-4">Browse Local Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Browse trusted local professionals backed by real reviews and proof of completed work.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {['Real Reviews', 'Proof Available', 'Trusted Vendors'].map((label) => (
              <span
                key={label}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-lg shadow-blue-100/60 border border-blue-100 p-6 mb-10">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="What service do you need?"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                data-testid="browse-category-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {!hasSelectedCategoryOption && selectedCategory !== 'all' ? (
                  <option value={selectedCategory}>{selectedCategory}</option>
                ) : null}
                {categories.map((category) => (
                  <option key={category.key} value={category.label}>
                    {category.label} ({category.serviceCount})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSearchSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Search
              </Button>
              <Button
                onClick={() => setShowFilters((prev) => !prev)}
                aria-label="Toggle browse filters"
                className="bg-gray-700 hover:bg-gray-800 text-white"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Browse Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear All
                </button>
              </div>
              <div className={`grid gap-4 ${hasEffectiveCoordinateOrigin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as BrowseSort);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    {hasEffectiveCoordinateOrigin ? <option value="distance">Distance</option> : null}
                  </select>
                </div>
                {hasEffectiveCoordinateOrigin ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Distance</label>
                    <select
                      data-testid="browse-radius-select"
                      value={radiusMiles ?? 'any'}
                      onChange={(e) => {
                        const nextRadius = e.target.value === 'any' ? null : Number(e.target.value);
                        setRadiusMiles(Number.isFinite(nextRadius) ? nextRadius : null);
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="any">Any distance</option>
                      <option value="5">Within 5 miles</option>
                      <option value="10">Within 10 miles</option>
                      <option value="25">Within 25 miles</option>
                      <option value="50">Within 50 miles</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Filter providers by how far they are from your browse location.
                    </p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                  {hasEffectiveCoordinateOrigin
                    ? 'Distance uses real saved or linked coordinates when providers have them.'
                    : 'More filters coming soon.'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-10 rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <div className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                savedLocationAssistActive || browserLocationActive ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}>
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {browserLocationActive
                    ? 'Showing providers near your current location'
                    : savedLocationAssistActive
                    ? 'Showing results near your saved address'
                    : 'Location-aware browsing is available when ready'}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {browserLocationActive
                    ? 'Reliance is using your current location for this browse session only.'
                    : savedLocationAssistActive
                    ? 'Reliance is using your saved service area preference to calculate real nearby distances for vendors with stored coordinates.'
                    : savedLocationChecked
                    ? 'You can browse everything today. Save an address and enable your saved-address preference to see real nearby distances when providers have coordinates.'
                    : 'Checking whether saved-location assistance is available for this session.'}
                </p>
                {browserLocationMessage ? (
                  <p className="mt-2 text-sm font-medium text-amber-700">{browserLocationMessage}</p>
                ) : null}
              </div>
            </div>
            {browserLocationActive ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={stopUsingBrowserLocation}
                  className="text-sm font-semibold text-gray-700 hover:text-gray-900"
                >
                  Stop using current location
                </button>
              </div>
            ) : savedLocationAssistActive ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={stopUsingSavedLocation}
                  className="text-sm font-semibold text-gray-700 hover:text-gray-900"
                >
                  Stop for this session
                </button>
                <Link href="/profile-settings" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                  Manage saved address
                </Link>
              </div>
            ) : canRequestBrowserLocation ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={browserLocationLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {browserLocationLoading ? 'Checking location...' : 'Use my location'}
                </Button>
                <Link href={isAuthenticated ? "/profile-settings" : "/auth/register?type=user"} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                  {isAuthenticated ? 'Manage saved address' : 'Save an address later'}
                </Link>
              </div>
            ) : (
              <Link href={isAuthenticated ? "/profile-settings" : "/auth/register?type=user"} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                {isAuthenticated ? 'Manage saved address' : 'Save an address later'}
              </Link>
            )}
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Popular Categories</h2>
            <span className="text-xs font-medium text-blue-700">
              Live category counts
            </span>
          </div>
          {categoriesLoading ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 h-24" />
                </Card>
              ))}
            </div>
          ) : categoriesError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              We could not load category counts right now. You can still browse and search services.
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
              No public categories are available yet. Check back as vendors publish more approved public content.
            </div>
          ) : (
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => {
                const decoration =
                  CATEGORY_DECORATION[category.label.toLowerCase()] ||
                  CATEGORY_DECORATION[category.key] ||
                  CATEGORY_DECORATION.uncategorized;
                return (
                  <Card
                    key={category.key}
                    className={`text-center hover:-translate-y-1 hover:shadow-xl transition-all cursor-pointer group border-2 bg-white ${
                      selectedCategory === category.label
                        ? 'border-blue-500 bg-blue-50/80 shadow-md shadow-blue-100'
                        : 'border-white hover:border-blue-200'
                    }`}
                    onClick={() => handleCategoryClick(category.label)}
                  >
                    <CardContent className="p-4">
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                        {decoration.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{category.label}</h3>
                      <p className="text-sm text-gray-600 mb-1">{category.serviceCount} services</p>
                      <p className="text-xs text-gray-500">{decoration.description}</p>
                      {selectedCategory === category.label ? (
                        <p className="text-[11px] mt-2 text-blue-700 font-medium">Selected filter</p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Trusted Services</h2>
              <p className="text-sm text-gray-600">Compare vendors by reviews, proof, and service fit.</p>
            </div>
            <div className="text-sm text-gray-600">
              {isFetching ? 'Refreshing...' : `Showing ${results.length} of ${totalCount}`}
            </div>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-lg" />
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-3" />
                    <div className="h-3 bg-gray-200 rounded mb-2" />
                    <div className="h-3 bg-gray-200 rounded mb-4 w-4/5" />
                    <div className="h-3 bg-gray-200 rounded mb-2 w-1/2" />
                    <div className="h-9 bg-gray-200 rounded mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              We could not load marketplace results right now.
              {error instanceof Error ? ` ${error.message}` : ''}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
              <p className="text-gray-600 mb-4">
                {hasActiveFilters
                  ? 'Try changing your search or category filter to broaden results.'
                  : 'No public services are available yet. Check back soon.'}
              </p>
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {hasActiveFilters ? 'Clear Filters' : 'Refresh Browse'}
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((item) => (
                <Card key={item.serviceId} className="hover:-translate-y-1 hover:shadow-xl transition-all h-full flex flex-col border-blue-50">
                  <div className="relative">
                    {item.previewMediaUrl ? (
                      <img
                        src={item.previewMediaUrl}
                        alt={item.serviceName}
                        className="w-full h-48 object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-48 rounded-t-lg bg-gray-100 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                          <span className="text-xs">No public media preview</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      {item.publicListing.hasPublicMedia ? (
                        <Badge className="bg-blue-600 text-white hover:bg-blue-600">Proof available</Badge>
                      ) : (
                        <Badge className="bg-white/90 text-gray-700 hover:bg-white">Verified listing</Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900 leading-snug">{item.serviceName}</h3>
                      {item.vendorCategory ? (
                        <Badge variant="outline" className="text-xs">
                          {item.vendorCategory}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.serviceDescription || 'No description yet.'}</p>
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
                        {formatDistanceMiles(item.distanceMiles)}
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-900">
                        <div className="font-semibold">
                          {typeof item.rating === 'number' ? `${item.rating.toFixed(1)} stars` : 'New listing'}
                        </div>
                        <div className="text-blue-700">
                          {typeof item.reviewCount === 'number'
                            ? `${item.reviewCount} review${item.reviewCount === 1 ? '' : 's'}`
                            : 'Reviews pending'}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-800">
                        <div className="font-semibold">
                          {item.publicListing.hasPublicMedia ? 'Proof ready' : 'Vendor details'}
                        </div>
                        <div className="text-slate-600">
                          {item.publicListing.hasPublicMedia ? 'Public media' : 'Profile available'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {typeof item.reviewCount === 'number'
                          ? `${item.reviewCount} public review${item.reviewCount === 1 ? '' : 's'}`
                          : 'Public service listing'}
                      </div>
                      {item.publicListing.hasPublicMedia ? (
                        <Badge className="bg-blue-100 text-blue-800">Public media</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">No public media</Badge>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <Link href={`/service/${item.serviceId}`} className="block">
                        <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                          View Service
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
                          onClick={() => handleShareService(item.serviceId, item.serviceName)}
                        >
                          Share
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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

        <div className="mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Ready to contact a provider?</h3>
                <p className="text-blue-700 text-sm">Create a free account to message vendors and book services directly.</p>
              </div>
              <Link href="/auth/register?type=user">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">Sign Up Now</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
