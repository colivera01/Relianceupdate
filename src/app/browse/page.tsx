'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import { TrustScoreEducationCard } from '@/components/guidance/TrustScoreEducationCard';
import { ProofFirstCard } from '@/components/public/ProofFirstCard';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Search, SlidersHorizontal, X, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { useAuth } from '@/contexts/AuthContext';
import { tutorialGuides } from '@/lib/user-guidance';
import {
  PROMOTION_BROWSE_SECTION_EXPLAINER,
  PROMOTION_BROWSE_SECTION_TITLE,
  PROMOTION_PUBLIC_EXPLAINER,
  resolvePromotionZoneLimits,
} from '@/lib/promoted-listings';

const DISCOVERY_PAGE_SIZE = 12;

const PROOF_CARD_DISPLAY_RANK: Record<string, number> = {
  public_proof: 0,
  partial_proof: 1,
  service_offered_only: 2,
};

const CATEGORY_DECORATION: Record<string, { icon: string; description: string }> = {
  automotive: { icon: '🚗', description: 'Vehicle and transportation services' },
  'home services': { icon: '🏠', description: 'Home maintenance and improvement' },
  technology: { icon: '💻', description: 'Tech support and digital services' },
  'health & wellness': { icon: '💊', description: 'Personal wellness services' },
  beauty: { icon: '💄', description: 'Beauty and personal care services' },
  education: { icon: '📚', description: 'Learning and tutoring services' },
  uncategorized: { icon: '🧩', description: 'Services without a category label' },
  plumbing: { icon: '•', description: 'Drain, leak, and fixture services' },
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
  const [proofDemoEnabled, setProofDemoEnabled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const didHydrateFromUrl = useRef(false);
  const didAutoApplyDistanceSort = useRef(false);

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
    const nextProofDemoEnabled = params.get('proofDemo') === '1';

    setProofDemoEnabled(nextProofDemoEnabled);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
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
    if (!hasHydratedFromUrl) return;
    if (!hasEffectiveCoordinateOrigin) {
      didAutoApplyDistanceSort.current = false;
      return;
    }
    if (!didAutoApplyDistanceSort.current && sortBy === 'newest') {
      didAutoApplyDistanceSort.current = true;
      setSortBy('distance');
      setPage(1);
    }
  }, [hasEffectiveCoordinateOrigin, hasHydratedFromUrl, sortBy]);

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
    if (proofDemoEnabled) params.set('proofDemo', '1');

    const nextUrl = params.toString() ? `/browse?${params.toString()}` : '/browse';
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [hasCoordinateOrigin, hasHydratedFromUrl, originLat, originLng, proofDemoEnabled, radiusMiles, searchQuery, selectedCategory, sortBy]);

  const discoveryFilters = useMemo(
    () => ({
      q: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      sortBy,
      ...(hasEffectiveCoordinateOrigin ? { lat: effectiveOriginLat, lng: effectiveOriginLng } : {}),
      ...(hasEffectiveCoordinateOrigin && radiusMiles != null && radiusMiles > 0 ? { radiusMiles } : {}),
      ...(proofDemoEnabled ? { proofDemo: '1' } : {}),
      page,
      limit: DISCOVERY_PAGE_SIZE,
    }),
    [
      effectiveOriginLat,
      effectiveOriginLng,
      hasEffectiveCoordinateOrigin,
      proofDemoEnabled,
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
  const displayResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        const aRank = PROOF_CARD_DISPLAY_RANK[a.proofCard?.kind || 'service_offered_only'] ?? 2;
        const bRank = PROOF_CARD_DISPLAY_RANK[b.proofCard?.kind || 'service_offered_only'] ?? 2;
        return aRank - bRank;
      }),
    [results]
  );
  const promotedListings = data?.promotedListings || [];
  const hasCategoryFilter = selectedCategory !== 'all';
  const promotedDisplayLimit = resolvePromotionZoneLimits('BROWSE_FEATURED', {
    hasCategoryFilter,
    viewport: isMobileViewport ? 'mobile' : 'desktop',
  }).maxSlots;
  const visiblePromotedListings = promotedListings.slice(0, promotedDisplayLimit);
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 0;
  const totalCount = pagination?.total || 0;
  const hasCategoryData = categories.length > 0;
  const hasBrowseResults = results.length > 0;
  const categoryCardsLoading = categoriesLoading && categories.length === 0;
  const browseResultsLoading = isLoading && results.length === 0;

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
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)]">
      <section className="reliance-dark-shell relative overflow-hidden pb-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(53,214,165,0.12),transparent_18%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <PublicSiteHeader
            tone="dark"
            hideLogo
            className="mb-10"
            links={[
              { href: '/', label: 'Home' },
              { href: '/help', label: 'Help' },
            ]}
            ctaHref="/auth/register?type=user"
            ctaLabel="Create Account"
          />

          <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
            <div className="max-w-2xl">
              <h1 className="font-display text-5xl font-semibold leading-[0.96] text-white sm:text-6xl">
                Browse vendor services with reviews, videos, and <span className="text-[var(--reliance-blue-soft)]">clear provider details</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/72">
                Search services, compare providers, and see available trust signals before you decide who to contact.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {['Customer Reviews', 'Public Service Videos', 'Clear Promoted Labels'].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white/82 backdrop-blur-md"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5 text-white backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/58">Available now</div>
                <div className="mt-3 text-3xl font-semibold">{browseResultsLoading ? 'Loading' : totalCount}</div>
                <p className="mt-2 text-sm leading-6 text-white/68">Services customers can review right now.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5 text-white backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/58">Categories</div>
                <div className="mt-3 text-3xl font-semibold">{categoryCardsLoading ? 'Loading' : categories.length}</div>
                <p className="mt-2 text-sm leading-6 text-white/68">Service groups with customer-visible examples.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5 text-white backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/58">What you can compare</div>
                <div className="mt-3 text-lg font-semibold">Reviews, videos, and provider details</div>
                <p className="mt-2 text-sm leading-6 text-white/68">Promoted listings stay clearly labeled while regular results continue below.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="reliance-light-card -mt-24 rounded-[32px] p-6 sm:p-7 mb-10 relative z-10">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search services, providers, reviews, or videos"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-3.5 text-slate-900 focus:border-[var(--reliance-blue)] focus:ring-2 focus:ring-[var(--reliance-blue)]/15"
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
                className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-slate-900 focus:border-[var(--reliance-blue)] focus:ring-2 focus:ring-[var(--reliance-blue)]/15"
              >
                <option value="all">All Services Offered</option>
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
                className="flex-1 rounded-2xl bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]"
              >
                Search
              </Button>
              <Button
                onClick={() => setShowFilters((prev) => !prev)}
                aria-label="Toggle browse filters"
                className="rounded-2xl bg-[var(--reliance-midnight)] text-white hover:bg-[#10203a]"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Service Filters</h3>
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
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  {hasEffectiveCoordinateOrigin
                    ? 'Distance uses real saved or linked coordinates when providers have them.'
                    : 'Distance filters unlock automatically once a browse location is set.'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="reliance-light-card mb-10 rounded-[28px] p-5 shadow-sm">
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
                    : 'See nearby proof when location is available'}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {browserLocationActive
                    ? 'Reliance is using your current location for this browse session only.'
                    : savedLocationAssistActive
                    ? 'Reliance is using your saved address to calculate nearby distances for providers with stored coordinates.'
                    : savedLocationChecked
                    ? 'You can browse everything today. Add your address or use your current location to see real nearby distances when providers have coordinates.'
                    : 'Checking whether a saved address is available for this session.'}
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
                  className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                >
                  Stop using current location
                </button>
              </div>
            ) : savedLocationAssistActive ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={stopUsingSavedLocation}
                  className="text-sm font-semibold text-slate-700 hover:text-slate-950"
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
                  {isAuthenticated ? 'Manage saved address' : 'Add an address later'}
                </Link>
              </div>
            ) : (
              <Link href={isAuthenticated ? "/profile-settings" : "/auth/register?type=user"} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                {isAuthenticated ? 'Manage saved address' : 'Save an address later'}
              </Link>
            )}
          </div>
        </div>

        {visiblePromotedListings.length > 0 ? (
          <div className="mb-12 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Featured proof placement
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{PROMOTION_BROWSE_SECTION_TITLE}</h2>
                <p className="text-sm text-gray-700">
                  {PROMOTION_BROWSE_SECTION_EXPLAINER}
                </p>
              </div>
              <span className="text-xs font-medium text-amber-800">
                {PROMOTION_PUBLIC_EXPLAINER}
              </span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visiblePromotedListings.map((item) => (
                <ProofFirstCard
                  key={item.promotion?.campaignId || item.serviceId}
                  item={item}
                  proofHref={`/service/${item.serviceId}?returnTo=%2Fbrowse&returnLabel=Back%20to%20Browse%20Services`}
                  providerHref={`/vendors/${item.vendorId}?returnTo=%2Fbrowse&returnLabel=Back%20to%20Browse%20Services`}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-3xl font-semibold text-slate-950">Service Categories</h2>
          </div>
          {categoryCardsLoading ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="rounded-[26px] border-slate-200 bg-white">
                  <CardContent className="p-4 h-24 flex flex-col justify-center">
                    <div className="text-sm font-semibold text-slate-900">Loading categories</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      Reliance is checking which service-offered categories currently have customer-visible examples.
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : categoriesError && !hasCategoryData ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              We could not load category counts right now. You can still browse services and search services offered.
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
              No public categories are available yet. Check back as vendors publish more approved public content.
            </div>
          ) : (
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => {
                const decoration =
                  CATEGORY_DECORATION[category.label.toLowerCase()] ||
                  CATEGORY_DECORATION[category.key] ||
                  { icon: '*', description: 'More services are still being grouped here' };
                const decorationDescription =
                  category.key === 'plumbing' || category.label.toLowerCase() === 'plumbing'
                    ? 'Drain, leak, and fixture services'
                    : decoration.description;

                return (
                  <Card
                    key={category.key}
                    className={`text-center hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(7,16,38,0.14)] transition-all cursor-pointer group rounded-[26px] border-2 bg-white ${
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
                      <p className="text-xs text-gray-500">{decorationDescription}</p>
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
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-3xl font-semibold text-slate-950">Available Vendor Services</h2>
              <p className="text-sm text-gray-600">Compare completed work, public service videos, reviews, and provider fit.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TutorialEntryPoint guide={tutorialGuides.browseMarketplace} surface="light" />
              <div className="text-sm text-gray-600">
                {isFetching ? 'Refreshing...' : `Showing ${results.length} of ${totalCount}`}
              </div>
            </div>
          </div>

          <TrustScoreEducationCard className="mb-6" />

          {browseResultsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="rounded-[28px] border-slate-200 bg-white">
                  <div className="h-48 bg-[linear-gradient(135deg,#0d1b35,#123b78_60%,#1d6dff)] rounded-t-[28px]" />
                  <CardContent className="p-4">
                    <div className="text-sm font-semibold text-slate-900">Loading services</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">
                      Reliance is refreshing live service cards, customer reviews, and public service video availability.
                    </div>
                    <div className="mt-3 text-xs font-medium text-blue-700">
                      Reliance is active. Proof results are still loading.
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError && !hasBrowseResults ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              We could not load vendor services right now.
              {error instanceof Error ? ` ${error.message}` : ''}
            </div>
          ) : displayResults.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[28px] border">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
              <p className="text-gray-600 mb-4">
                {hasActiveFilters
                  ? 'Try changing your search or category filter to broaden results.'
                  : 'No services are available yet. Check back soon.'}
              </p>
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {hasActiveFilters ? 'Clear Filters' : 'Refresh Services'}
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayResults.map((item) => (
                <ProofFirstCard
                  key={item.serviceId}
                  item={item}
                  proofHref={`/service/${item.serviceId}?returnTo=%2Fbrowse&returnLabel=Back%20to%20Browse%20Services`}
                  providerHref={`/vendors/${item.vendorId}?returnTo=%2Fbrowse&returnLabel=Back%20to%20Browse%20Services`}
                  secondaryAction={
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      onClick={() => handleShareService(item.serviceId, item.serviceName)}
                    >
                      Share
                    </Button>
                  }
                />
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
            <div className="reliance-light-card rounded-[28px] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Ready to contact a provider?</h3>
                <p className="text-blue-700 text-sm">Create a free account to save proof examples, contact vendors, and manage service records.</p>
              </div>
              <Link href="/auth/register?type=user">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">Sign Up Now</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PublicSiteFooter />
    </div>
  );
}
