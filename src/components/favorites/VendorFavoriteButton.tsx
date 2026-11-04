'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useVendorFavorite } from '@/hooks/useFavorites';

export function VendorFavoriteButton({
  vendorId,
  vendorName,
  tone = 'light',
  className = '',
  previewMode = false,
}: {
  vendorId: string;
  vendorName: string;
  tone?: 'light' | 'dark';
  className?: string;
  previewMode?: boolean;
}) {
  const favorite = useVendorFavorite(vendorId);
  const serverSaved = favorite.data?.entityType === 'vendor';
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [favoriteIdOverride, setFavoriteIdOverride] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState(false);
  const saved = savedOverride ?? serverSaved;
  const busy = favorite.isLoading || favorite.add.isPending || favorite.remove.isPending;
  const base = tone === 'dark'
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';

  useEffect(() => {
    setSavedOverride(null);
    setFavoriteIdOverride(null);
  }, [favorite.data?.favoriteId, vendorId]);

  if (previewMode) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          disabled
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold opacity-80 ${base} ${className}`}
        >
          <Heart aria-hidden="true" className="h-4 w-4" /> Save {vendorName}
        </button>
        <span className={tone === 'dark' ? 'text-xs text-white/58' : 'text-xs text-slate-500'}>
          Customer control - disabled while previewing your own business.
        </span>
      </div>
    );
  }

  if (!favorite.isAuthenticated) {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(`/vendors/${vendorId}`)}`}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${base} ${className}`}
      >
        <Heart aria-hidden="true" className="h-4 w-4" /> Save {vendorName}
      </Link>
    );
  }

  const handleToggle = async () => {
    const previous = saved;
    const previousFavoriteId = favoriteIdOverride ?? favorite.data?.favoriteId ?? null;
    const nextSaved = !saved;
    setSavedOverride(nextSaved);
    setStatusMessage('');
    setStatusError(false);
    try {
      if (saved) {
        let favoriteId = previousFavoriteId;
        if (!favoriteId) {
          const refreshed = await favorite.refetch();
          favoriteId = refreshed.data?.entityType === 'vendor' ? refreshed.data.favoriteId : null;
        }
        if (!favoriteId) throw new Error('Saved business record is unavailable.');
        await favorite.remove.mutateAsync(favoriteId);
        setFavoriteIdOverride(null);
        setStatusMessage(`${vendorName} was removed from Favorites.`);
      } else {
        const result = await favorite.add.mutateAsync();
        setFavoriteIdOverride(result.favorite.favoriteId);
        setStatusMessage(`${vendorName} was saved to Favorites.`);
      }
      const refreshed = await favorite.refetch().catch(() => null);
      const refreshedSaved = refreshed?.data?.entityType === 'vendor';
      if (refreshed && !refreshed.isError && refreshedSaved === nextSaved) {
        setSavedOverride(null);
        setFavoriteIdOverride(null);
      }
    } catch {
      setSavedOverride(previous);
      setFavoriteIdOverride(previousFavoriteId);
      setStatusError(true);
      setStatusMessage('We could not update Favorites. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          aria-pressed={saved}
          onClick={() => void handleToggle()}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-55 ${base} ${className}`}
        >
          <Heart aria-hidden="true" className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          {busy ? 'Updating...' : saved ? 'Saved to Favorites' : `Save ${vendorName}`}
        </button>
        {saved ? (
          <Link
            href="/favorites"
            className={tone === 'dark' ? 'text-xs font-semibold text-blue-100 underline-offset-4 hover:underline' : 'text-xs font-semibold text-blue-700 underline-offset-4 hover:underline'}
          >
            View Favorites
          </Link>
        ) : null}
      </div>
      {statusMessage ? (
        <span
          role={statusError ? 'alert' : 'status'}
          aria-live="polite"
          className={statusError
            ? tone === 'dark'
              ? 'text-xs font-medium text-red-300'
              : 'text-xs font-medium text-red-800'
            : tone === 'dark'
              ? 'text-xs text-emerald-200'
              : 'text-xs text-emerald-700'}
        >
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}
