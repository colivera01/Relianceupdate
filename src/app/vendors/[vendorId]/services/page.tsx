'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Search, SlidersHorizontal } from 'lucide-react';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PUBLIC_DB_UNAVAILABLE_CODE, PUBLIC_DB_UNAVAILABLE_MESSAGE } from '@/lib/transient-db-errors';

type PublicService = {
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  durationLabel?: string | null;
  price: number | null;
  previewMediaUrl: string | null;
  previewMediaType: 'image' | 'video' | null;
};

type PublicVendorPayload = {
  success: boolean;
  vendor?: {
    vendorId: string;
    vendorName: string;
    category: string | null;
    location: string | null;
  };
  publicServices?: PublicService[];
  dataStatus?: {
    publicMedia?: 'available' | 'temporarily_unavailable';
  };
  error?: string;
  code?: string;
};

type MediaFilter = 'all' | 'with-media' | 'without-media';
type SortOrder = 'name' | 'price-low' | 'price-high';

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_200;

function formatPrice(value: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default function PublicVendorServicesPage() {
  const params = useParams();
  const vendorId = String(params?.vendorId || '');
  const { user } = useAuth();
  const [payload, setPayload] = useState<PublicVendorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('name');

  const isSignedIn = Boolean(user?.id);
  const isVendorAccount = user?.userType === 'vendor' || user?.userType === 'both';
  const accountHref =
    user?.userType === 'admin'
      ? '/admin/dashboard'
      : isVendorAccount
        ? '/vendor/dashboard'
        : isSignedIn
          ? '/user-dashboard'
          : '/auth/login';
  const accountLabel =
    user?.userType === 'admin'
      ? 'Admin Dashboard'
      : isVendorAccount
        ? 'Vendor Workspace'
        : isSignedIn
          ? 'My Account'
          : 'Sign In';

  const loadServices = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    setError(null);

    try {
      for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
        const response = await fetch(`/api/vendors/${vendorId}/public`, { cache: 'no-store' });
        const json = (await response.json().catch(() => ({}))) as PublicVendorPayload;
        const retryable = response.status === 503 || json?.code === PUBLIC_DB_UNAVAILABLE_CODE;

        if (response.ok && json?.success !== false) {
          setPayload(json);
          return;
        }

        if (retryable && attempt < RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

        throw new Error(
          retryable
            ? PUBLIC_DB_UNAVAILABLE_MESSAGE
            : json?.error || `Unable to load services (${response.status})`,
        );
      }
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load public services.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const services = payload?.publicServices || [];
  const publicMediaTemporarilyUnavailable = payload?.dataStatus?.publicMedia === 'temporarily_unavailable';
  const visibleServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = services.filter((service) => {
      const matchesQuery =
        !normalizedQuery ||
        `${service.serviceName} ${service.serviceDescription}`.toLowerCase().includes(normalizedQuery);
      const hasMedia = Boolean(service.previewMediaUrl);
      const matchesMedia =
        mediaFilter === 'all' ||
        (mediaFilter === 'with-media' && hasMedia) ||
        (mediaFilter === 'without-media' && !hasMedia);
      return matchesQuery && matchesMedia;
    });

    return [...filtered].sort((left, right) => {
      if (sortOrder === 'price-low') {
        const leftPrice = typeof left.price === 'number' ? left.price : Number.POSITIVE_INFINITY;
        const rightPrice = typeof right.price === 'number' ? right.price : Number.POSITIVE_INFINITY;
        return leftPrice - rightPrice || left.serviceName.localeCompare(right.serviceName);
      }
      if (sortOrder === 'price-high') {
        const leftPrice = typeof left.price === 'number' ? left.price : Number.NEGATIVE_INFINITY;
        const rightPrice = typeof right.price === 'number' ? right.price : Number.NEGATIVE_INFINITY;
        return rightPrice - leftPrice || left.serviceName.localeCompare(right.serviceName);
      }
      return left.serviceName.localeCompare(right.serviceName);
    });
  }, [mediaFilter, query, services, sortOrder]);

  const vendor = payload?.vendor || null;
  const vendorHref = `/vendors/${vendorId}`;
  const footerLinks = isVendorAccount
    ? [
        { href: '/vendor/dashboard', label: 'Vendor Dashboard' },
        { href: '/vendor/profile', label: 'Profile & Settings' },
        { href: '/vendor/services', label: 'Manage Services' },
      ]
    : isSignedIn
      ? [{ href: accountHref, label: accountLabel }]
      : undefined;

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)]">
      <section className="reliance-dark-shell relative overflow-hidden pb-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(36,107,255,0.22),transparent_24%),radial-gradient(circle_at_18%_4%,rgba(53,214,165,0.10),transparent_18%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-4 pt-6 sm:px-6 lg:px-8">
          <PublicSiteHeader
            tone="dark"
            className="mb-10"
            ctaHref="/browse"
            ctaLabel="Explore Proof"
            secondaryHref={accountHref}
            secondaryLabel={accountLabel}
          />

          <Link
            href={vendorHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/14"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to provider profile
          </Link>

          <div className="mt-9 max-w-4xl">
            <div className="reliance-kicker border border-white/10 bg-white/10 text-white/76">
              Public-approved services
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-white sm:text-6xl">
              {vendor?.vendorName ? `${vendor.vendorName} services` : 'Services offered'}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
              Search every currently published customer offering, compare reference prices, and open a service to review its public work and availability.
            </p>
            {!loading && vendor ? (
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-white/72">
                <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">
                  {services.length} public service{services.length === 1 ? '' : 's'}
                </span>
                {vendor.category ? (
                  <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">{vendor.category}</span>
                ) : null}
                {vendor.location ? (
                  <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">{vendor.location}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-6" aria-live="polite">
            <div className="h-28 animate-pulse rounded-[28px] bg-white/8" />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-[28rem] animate-pulse rounded-[28px] bg-white/8" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-6 text-amber-950">
            <p className="font-semibold">Public services are temporarily unavailable</p>
            <p className="mt-2 text-sm leading-6">{error}</p>
            <button
              type="button"
              onClick={() => void loadServices()}
              className="mt-5 rounded-full border border-amber-300 bg-white px-5 py-2 text-sm font-semibold transition hover:bg-amber-100"
            >
              Try again
            </button>
          </div>
        ) : !vendor ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 text-slate-700">
            This public provider profile is not available.
          </div>
        ) : (
          <>
            {publicMediaTemporarilyUnavailable ? (
              <div role="status" className="mb-7 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
                Public media previews could not be loaded right now. The service list and prices are current, but media availability cannot be confirmed until the temporary connection issue clears.
              </div>
            ) : null}
            <section className="reliance-light-card rounded-[30px] px-5 py-5 sm:px-6" aria-label="Filter services">
              <div className="grid gap-4 lg:grid-cols-[1fr_0.72fr_0.72fr]">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Search services</span>
                  <span className="mt-2 flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                    <Search className="mr-3 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by service or description"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Public media</span>
                  <select
                    value={mediaFilter}
                    disabled={publicMediaTemporarilyUnavailable}
                    onChange={(event) => setMediaFilter(event.target.value as MediaFilter)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="all">All services</option>
                    <option value="with-media">With public media</option>
                    <option value="without-media">Without public media</option>
                  </select>
                </label>

                <label className="block">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    Sort
                  </span>
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="name">Name A-Z</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                  </select>
                </label>
              </div>
              <p className="mt-4 text-sm text-slate-600" aria-live="polite">
                Showing {visibleServices.length} of {services.length} public service{services.length === 1 ? '' : 's'}.
              </p>
            </section>

            {services.length === 0 ? (
              <div className="mt-7 rounded-[28px] border border-slate-200 bg-white px-6 py-8 text-slate-700">
                This provider does not have any published customer services yet.
              </div>
            ) : visibleServices.length === 0 ? (
              <div className="mt-7 rounded-[28px] border border-slate-200 bg-white px-6 py-8 text-slate-700">
                <p className="font-semibold text-slate-950">No services match these filters.</p>
                <p className="mt-2 text-sm">Try a broader search or show all media availability.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setMediaFilter('all');
                    setSortOrder('name');
                  }}
                  className="mt-4 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <section className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Public services">
                {visibleServices.map((service) => {
                  const price = formatPrice(service.price);
                  const returnTo = `/vendors/${vendorId}/services`;
                  return (
                    <article
                      key={service.serviceId}
                      className="reliance-light-card group flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 shadow-none transition duration-300 hover:-translate-y-1 hover:border-blue-300/40 hover:shadow-[0_24px_55px_rgba(0,0,0,0.24)]"
                    >
                      <PublicMediaPreview
                        url={service.previewMediaUrl}
                        type={service.previewMediaType}
                        alt={service.serviceName}
                        className="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                        videoLabel="Public service video available"
                      />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="font-display text-2xl font-semibold text-slate-950">{service.serviceName}</div>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                          {service.serviceDescription || 'No public description is available yet.'}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                          {service.durationLabel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Typical duration: {service.durationLabel}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                            {publicMediaTemporarilyUnavailable
                              ? 'Media status unavailable'
                              : service.previewMediaUrl
                                ? 'Public media available'
                                : 'Service offered'}
                          </span>
                          {price ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">Reference price {price}</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Request an estimate</span>
                          )}
                        </div>
                        <Link
                          href={`/service/${service.serviceId}?returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent('Back to all services')}`}
                          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-4 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110"
                        >
                          View service &amp; public work
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>

      <PublicSiteFooter
        accountHeading={isVendorAccount ? 'Vendor workspace' : isSignedIn ? 'Account' : undefined}
        accountLinksOverride={footerLinks}
      />
    </div>
  );
}
