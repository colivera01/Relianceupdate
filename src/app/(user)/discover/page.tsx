'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, SlidersHorizontal, X, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { useAddFavorite, useFavoritesOptional, useRemoveFavorite } from '@/hooks/useFavorites';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { CustomerTrustSignalCard } from '@/components/public/CustomerTrustSignalCard';
import { getCustomerReviewCopy } from '@/lib/customer-review-copy';
import { getCustomerTrustScoreCopy } from '@/lib/customer-trust-score-copy';

export default function UserDiscoverPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'name'>('newest');
  const [page, setPage] = useState(1);
  const [favoriteActionError, setFavoriteActionError] = useState<string | null>(null);
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
  const serviceReturnLabel = 'Back to Discover';

  return (
    <div className="pt-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">Browse Services</h1>
          <p className="text-gray-600">Compare services, public reviews, and service videos in one place.</p>
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
          placeholder="Search for services or vendors..."
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
                <option value="all">All Services</option>
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
            Search, category, and price filters are available here. Add location-aware browsing from the public marketplace if you want distance-based results.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {isFetching ? 'Refreshing...' : `Showing ${results.length} of ${totalCount} services`}
        </div>
      </div>
      {favoriteActionError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-10 text-sm text-amber-800">
          {favoriteActionError}
        </div>
      ) : null}

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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search terms or filters.</p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {results.map((item) => {
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
          })}
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
