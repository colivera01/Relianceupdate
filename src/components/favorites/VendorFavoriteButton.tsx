'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useVendorFavorite } from '@/hooks/useFavorites';

export function VendorFavoriteButton({
  vendorId,
  vendorName,
  tone = 'light',
  className = '',
}: {
  vendorId: string;
  vendorName: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const favorite = useVendorFavorite(vendorId);
  const saved = favorite.data?.entityType === 'vendor';
  const busy = favorite.isLoading || favorite.add.isPending || favorite.remove.isPending;
  const base = tone === 'dark'
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';

  if (!favorite.isAuthenticated) {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(`/vendors/${vendorId}`)}`}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${base} ${className}`}
      >
        <Heart className="h-4 w-4" /> Save {vendorName}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={saved}
      onClick={() => {
        if (saved) favorite.remove.mutate(favorite.data!.favoriteId);
        else favorite.add.mutate();
      }}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-55 ${base} ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
      {saved ? 'Saved Business' : `Save ${vendorName}`}
    </button>
  );
}
