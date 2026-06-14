'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Heart, MapPin, Trash2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useFavorites, useRemoveFavorite } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';

export default function FavoritesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data, isLoading, isError, error, isFetching } = useFavorites({ page: 1, limit: 200 });
  const removeFavorite = useRemoveFavorite();
  const canLoadFavorites = authLoading || isAuthenticated;

  const favorites = data?.favorites || [];
  const filteredFavorites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const visibleFavorites = favorites.filter((item) => !pendingRemovalIds.includes(item.favoriteId));
    if (!query) return visibleFavorites;
    return visibleFavorites.filter((item) => {
      return (
        item.serviceName.toLowerCase().includes(query) ||
        item.vendorName.toLowerCase().includes(query) ||
        item.serviceDescription.toLowerCase().includes(query)
      );
    });
  }, [favorites, pendingRemovalIds, searchQuery]);
  const favoritesCountLabel =
    authLoading || (isLoading && !data) || (isFetching && !data)
      ? 'Loading...'
      : `${filteredFavorites.length} saved`;

  useEffect(() => {
    if (!pendingRemovalIds.length) return;
    const activeFavoriteIds = new Set(favorites.map((item) => item.favoriteId));
    setPendingRemovalIds((current) => current.filter((id) => activeFavoriteIds.has(id)));
  }, [favorites, pendingRemovalIds.length]);

  const handleRemove = async (favoriteId: string) => {
    setPendingRemovalIds((current) => (current.includes(favoriteId) ? current : [...current, favoriteId]));
    try {
      await removeFavorite.mutateAsync(favoriteId);
    } catch (error) {
      setPendingRemovalIds((current) => current.filter((id) => id !== favoriteId));
      throw error;
    }
  };
  const serviceReturnHref = '/favorites';
  const serviceReturnLabel = 'Back to My Favorites';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-6">
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold mb-6 text-gray-900">My Favorites</h1>
              <Badge variant="secondary" className="text-sm">
                {favoritesCountLabel}
              </Badge>
            </div>
            <Link href="/discover">
              <Button size="sm">Explore Proof</Button>
            </Link>
        </div>
      </div>

      <div>
        {!authLoading && !isAuthenticated ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 mb-10">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Sign in to use favorites</h2>
            <p className="text-sm text-blue-800 mb-4">
              Save vendors and public proof sources when you want to come back later.
            </p>
            <Link href="/auth/login?next=%2Ffavorites">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        ) : null}

        {canLoadFavorites ? (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-10">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search saved proof, services offered, or vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {authLoading || isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-gray-200 rounded-t-lg" />
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
            ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-10 text-red-700">
            Failed to load favorites.
            {error instanceof Error ? ` ${error.message}` : ''}
          </div>
            ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-12 mb-10">
            <Heart size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved proof yet</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery.trim() ? 'Try a different search.' : 'Save vendors, services offered, or public proof when you want to revisit them.'}
            </p>
            <Link href="/discover">
              <Button>Explore Proof</Button>
            </Link>
          </div>
            ) : (
          <div className="space-y-4 mb-10">
            {isFetching ? <p className="text-sm text-gray-500">Refreshing favorites...</p> : null}
            {filteredFavorites.map((item) => (
              <Card
                key={item.favoriteId}
                className="border border-gray-200 bg-white mb-4"
                data-testid={`favorites-row-${item.serviceId}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-48 h-28 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      <PublicMediaPreview
                        url={item.previewMediaUrl}
                        type={item.previewMediaType}
                        alt={item.serviceName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{item.serviceName}</h3>
                          <p className="text-sm text-gray-700">By {item.vendorName}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={pendingRemovalIds.includes(item.favoriteId)}
                          aria-label="Remove from favorites"
                          data-testid={`favorites-remove-${item.favoriteId}`}
                          onClick={() => handleRemove(item.favoriteId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {item.serviceDescription || 'No description available.'}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">{item.vendorCategory || item.vendorBusinessType || 'Service'}</Badge>
                        {item.location ? (
                          <span className="inline-flex items-center text-gray-600">
                            <MapPin className="h-4 w-4 mr-1" />
                            {item.location}
                          </span>
                        ) : null}
                        {typeof item.rating === 'number' && typeof item.reviewCount === 'number' ? (
                          <span className="text-gray-700">
                            {item.rating.toFixed(1)} rating ({item.reviewCount} reviews)
                          </span>
                        ) : null}
                        <span className="text-gray-600">Reference estimate: ${item.price.toFixed(2)}</span>
                        <span className="text-gray-500">
                          Favorited {new Date(item.favoritedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/service/${item.serviceId}?returnTo=${encodeURIComponent(serviceReturnHref)}&returnLabel=${encodeURIComponent(serviceReturnLabel)}`}
                        >
                          <Button size="sm">View Proof</Button>
                        </Link>
                        <Link href={`/vendors/${item.vendorId}`}>
                          <Button size="sm" variant="outline">View Vendor</Button>
                        </Link>
                        <Link href={`/booking/${item.serviceId}`}>
                          <Button size="sm" variant="outline">Request Service</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
