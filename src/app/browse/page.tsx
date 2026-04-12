'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal, X, MapPin, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';

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

type BrowseSort = 'newest' | 'price_asc' | 'price_desc' | 'name';

export default function PublicBrowsePage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<BrowseSort>('newest');
  const [page, setPage] = useState(1);

  const discoveryFilters = useMemo(
    () => ({
      q: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      sortBy,
      page,
      limit: DISCOVERY_PAGE_SIZE,
    }),
    [searchQuery, selectedCategory, sortBy, page]
  );

  const { data, isLoading, isError, error, isFetching } = useDiscoverServices(discoveryFilters);
  const {
    data: categoryData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useServiceCategories();

  const categories = categoryData?.categories || [];
  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedCategory !== 'all';

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
    setPage(1);
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
    <div className="min-h-screen bg-gray-50">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Browse Local Services</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find trusted local professionals using public-safe, moderation-filtered marketplace results.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
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
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
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
              <div className="grid md:grid-cols-2 gap-4">
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
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Distance filter is not available yet in backend discovery.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold text-gray-900">Popular Categories</h2>
            <span className="text-xs text-gray-500">
              Counts are backend-derived public inventory
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
                    className={`text-center hover:shadow-lg transition-all cursor-pointer group border-2 ${
                      selectedCategory === category.label
                        ? 'border-blue-500 bg-blue-50/60 shadow-md'
                        : 'border-transparent'
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
            <h2 className="text-2xl font-bold text-gray-900">Public Services</h2>
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
                <Card key={item.serviceId} className="hover:shadow-lg transition-shadow h-full flex flex-col">
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

                    {typeof item.rating === 'number' && typeof item.reviewCount === 'number' ? (
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">{item.rating.toFixed(1)}★</span>{' '}
                        <span className="text-gray-500">({item.reviewCount} review{item.reviewCount === 1 ? '' : 's'})</span>
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between mt-3">
                      <div className="text-base font-bold text-gray-900">${item.price.toFixed(2)}</div>
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
