'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Play, Search, ShieldCheck, Star, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeroArtwork } from '@/components/public/PublicHeroArtwork';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { useDiscoverServices, useServiceCategories } from '@/hooks/useServices';
import { cleanPublicServiceDescription } from '@/lib/launch-content-cleanup';

const HOME_MARKETPLACE_PREVIEW_LIMIT = 4;

const trustPillars = [
  {
    title: 'Customer Reviews',
    description: 'Public customer feedback remains visible as its own signal.',
    icon: Star,
  },
  {
    title: 'Verified Service Videos',
    description: 'Approved public service videos add visual accountability.',
    icon: Video,
  },
  {
    title: 'Reliance Trust Score',
    description: 'Platform-generated performance scoring stays separate from reviews.',
    icon: ShieldCheck,
  },
];

const trustMetrics = [
  { label: 'Workflow completion', value: 'Measured' },
  { label: 'Video verification', value: 'Verified' },
  { label: 'Dispute-free completion', value: 'Tracked' },
  { label: 'Operational reliability', value: 'Weighted' },
];

function isPlaceholderMarketplacePreview(url: string | null | undefined) {
  const normalized = String(url || '').trim().toLowerCase();
  if (!normalized) return true;
  return normalized.includes('interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
}

export default function HomePage() {
  const {
    data: marketplaceData,
    isLoading: marketplaceLoading,
    isError: marketplaceError,
  } = useDiscoverServices({
    sortBy: 'newest',
    limit: HOME_MARKETPLACE_PREVIEW_LIMIT,
  });
  const {
    data: categoryData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useServiceCategories();

  const marketplaceResults = marketplaceData?.results || [];
  const featuredService =
    marketplaceResults.find((item) => Boolean(item.previewMediaUrl) && Boolean(item.previewMediaType)) ||
    marketplaceResults[0] ||
    null;
  const secondaryServices = marketplaceResults
    .filter((item) => item.serviceId !== featuredService?.serviceId)
    .slice(0, 3);
  const categoryPreview = (categoryData?.categories || []).slice(0, 5);
  const totalPublicServices = marketplaceData?.pagination?.total ?? categoryData?.meta?.countedServices ?? 0;
  const hasCuratedHeroMedia =
    Boolean(featuredService?.previewMediaUrl) &&
    Boolean(featuredService?.previewMediaType) &&
    !isPlaceholderMarketplacePreview(featuredService?.previewMediaUrl);
  const heroServiceName = featuredService?.serviceName || 'See trusted work before you book';
  const heroVendorName = featuredService?.vendorName || 'Reliance marketplace';

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] text-white">
      <section className="reliance-dark-shell reliance-grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(53,214,165,0.14),transparent_20%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
          <PublicSiteHeader
            tone="dark"
            hideLogo
            links={[
              { href: '/', label: 'Home' },
              { href: '/browse', label: 'Services' },
              { href: '/help', label: 'How It Works' },
            ]}
            className="mb-10"
            ctaLabel="Find a Service"
            ctaHref="/browse"
          />

          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-7 -mt-1">
                <div className="flex h-[19rem] w-full max-w-[35rem] items-end justify-center overflow-visible sm:h-[20rem] lg:h-[21rem] lg:max-w-[37rem]">
                  <div className="relative -translate-y-5 w-[25rem] max-w-full sm:w-[27rem] lg:w-[29rem]">
                    <div className="aspect-[864/618] w-full">
                      <div className="pointer-events-none absolute inset-[-8%] bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.26),rgba(130,167,255,0.2)_34%,rgba(36,107,255,0.18)_58%,transparent_78%)] blur-2xl" />
                      <div
                        role="img"
                        aria-label="Reliance"
                        className="relative z-[1] h-full w-full bg-[linear-gradient(145deg,#ffffff_4%,#edf4ff_22%,#a8c6ff_48%,#5c95ff_74%,#246bff_100%)] [mask-image:url('/reliance-logo-tight.png')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/reliance-logo-tight.png')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/48">
                  Customer Reviews + Verified Service Videos + Trust Score
                </div>
              </div>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.96] text-white sm:text-6xl lg:text-7xl">
                Trust Beyond <span className="text-[var(--reliance-blue-soft)]">Reviews</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/76 sm:text-xl">
                Reliance helps customers compare real public reviews, verified service videos,
                and the Reliance Trust Score without changing how the underlying platform works.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/browse">
                  <Button className="h-12 rounded-full bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-6 text-white shadow-[0_22px_50px_rgba(36,107,255,0.32)] hover:brightness-110">
                    <Search className="mr-2 h-4 w-4" />
                    Explore Services
                  </Button>
                </Link>
                <Link href="/auth/register?type=user">
                  <Button
                    variant="outline"
                    className="h-12 rounded-full border-white/16 bg-white/6 px-6 text-white backdrop-blur-md hover:bg-white/10 hover:text-white"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Join Reliance
                  </Button>
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {trustPillars.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg"
                  >
                    <item.icon className="h-5 w-5 text-[var(--reliance-blue-soft)]" />
                    <div className="mt-3 text-sm font-semibold">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-white/68">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <div className="reliance-glass rounded-[32px] border border-white/10 p-5 shadow-[0_30px_80px_rgba(4,9,20,0.38)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/62">
                      Featured Service Story
                    </div>
                    <div className="mt-2 font-display text-2xl text-white">
                      {heroServiceName}
                    </div>
                  </div>
                  <Badge className="bg-[var(--reliance-blue)] text-white hover:bg-[var(--reliance-blue)]">
                    {marketplaceLoading ? 'Loading live listings' : `${totalPublicServices} public services`}
                  </Badge>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(6,17,31,0.55)]">
                  {hasCuratedHeroMedia && featuredService ? (
                    <PublicMediaPreview
                      autoPlayVideo
                      url={featuredService.previewMediaUrl}
                      type={featuredService.previewMediaType}
                      alt={featuredService.serviceName}
                      className="h-72 w-full object-cover"
                      videoLabel="Verified service story"
                    />
                  ) : (
                    <PublicHeroArtwork serviceName={heroServiceName} vendorName={heroVendorName} />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white/92">
                      {heroVendorName}
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-white/64">
                      {featuredService
                        ? cleanPublicServiceDescription(featuredService.serviceDescription, featuredService.vendorName) ||
                          'Public-safe service listing'
                        : 'Browse local services backed by public videos, reviews, and platform trust signals.'}
                    </p>
                  </div>
                  {featuredService ? (
                    <Link href={`/service/${featuredService.serviceId}`}>
                      <Button className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
                        View Service
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                <div className="reliance-light-card rounded-[28px] px-5 py-5 shadow-[0_18px_45px_rgba(7,16,38,0.08)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Dual-Layer Trust
                  </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Customer Ratings stay visible. Reliance Trust Score stays independent. Verified Service Videos
                      connect the two with real completed-service visibility.
                    </p>
                  <div className="mt-5 space-y-3">
                    {trustMetrics.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="reliance-light-card rounded-[28px] px-5 py-5 shadow-[0_18px_45px_rgba(7,16,38,0.08)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Marketplace Signal
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">
                    {marketplaceLoading ? '...' : totalPublicServices}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Publicly listed services are discoverable as soon as the approved vendor, videos, and listing state are ready.
                  </p>
                  <div className="mt-6 space-y-3">
                    {secondaryServices.length > 0 ? (
                      secondaryServices.map((item) => (
                        <Link
                          key={item.serviceId}
                          href={`/service/${item.serviceId}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-3 transition hover:border-[var(--reliance-blue)] hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{item.serviceName}</div>
                            <div className="truncate text-xs text-slate-500">{item.vendorName}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        Public categories and vendors appear here as listings load.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="reliance-kicker border border-[var(--reliance-border)] bg-white/5 text-white/62">
              Trust System
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold text-slate-950 sm:text-4xl">
              Three signals, one clearer hiring decision
            </h2>
          </div>
          <Link href="/browse" className="text-sm font-semibold text-[var(--reliance-blue)]">
            Browse live marketplace
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {trustPillars.map((item) => (
            <div
              key={item.title}
              className="reliance-light-card rounded-[30px] px-6 py-6"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(36,107,255,0.15),rgba(53,214,165,0.16))] text-[var(--reliance-blue)]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="reliance-light-card rounded-[32px] px-6 py-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Browse by Category
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Public inventory, grouped cleanly</h2>
              </div>
              <Link href="/browse">
                <Button variant="outline" className="rounded-full border-slate-300 bg-white">
                  Open Browse
                </Button>
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {categoriesLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))
              ) : categoriesError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  Category counts are temporarily unavailable, but the marketplace is still browseable.
                </div>
              ) : categoryPreview.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Public categories will appear here as more approved listings go live.
                </div>
              ) : (
                categoryPreview.map((category) => (
                  <Link
                    key={category.key}
                    href={`/browse?category=${encodeURIComponent(category.label)}`}
                    className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 px-4 py-4 transition hover:border-[var(--reliance-blue)] hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-semibold text-slate-950">{category.label}</div>
                      <div className="mt-1 text-sm text-slate-500">Public category inventory</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {category.serviceCount}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="reliance-light-card rounded-[32px] px-6 py-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Newest Public Services
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">Scroll the live marketplace like a premium catalog</h2>
              </div>
              <span className="text-sm text-slate-500">
                {marketplaceLoading ? 'Loading...' : `${totalPublicServices} total public services`}
              </span>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {marketplaceLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden rounded-[26px] border-slate-200">
                    <div className="h-44 animate-pulse bg-slate-100" />
                    <CardContent className="space-y-3 p-5">
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                    </CardContent>
                  </Card>
                ))
              ) : marketplaceError ? (
                <div className="md:col-span-2 rounded-[26px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">
                  We could not load live marketplace services right now. The public catalog is still available through Browse.
                </div>
              ) : marketplaceResults.length === 0 ? (
                <div className="md:col-span-2 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
                  No public services are available yet. Check back as vendors publish approved listings.
                </div>
              ) : (
                marketplaceResults.map((item) => (
                  <Card key={item.serviceId} className="overflow-hidden rounded-[26px] border-slate-200 bg-white shadow-none">
                    <PublicMediaPreview
                      url={item.previewMediaUrl}
                      type={item.previewMediaType}
                      alt={item.serviceName}
                      className="h-48 w-full object-cover"
                      videoLabel="Verified service video"
                    />
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl font-semibold text-slate-950">{item.serviceName}</div>
                          <div className="mt-1 text-sm text-slate-500">{item.vendorName}</div>
                        </div>
                        {item.vendorCategory ? (
                          <Badge variant="outline" className="rounded-full border-slate-300 bg-slate-50 text-slate-700">
                            {item.vendorCategory}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                        {cleanPublicServiceDescription(item.serviceDescription, item.vendorName) || 'Public service listing'}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                            {item.publicListing.hasPublicMedia ? 'Service videos' : 'Verified listing'}
                          </span>
                          {typeof item.rating === 'number' && typeof item.reviewCount === 'number' ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                              {item.rating.toFixed(1)} • {item.reviewCount} reviews
                            </span>
                          ) : null}
                        </div>
                        <Link href={`/service/${item.serviceId}`} className="text-sm font-semibold text-[var(--reliance-blue)]">
                          View
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="reliance-light-card rounded-[32px] px-6 py-7">
            <div className="reliance-kicker border border-[var(--reliance-border)] bg-slate-50 text-slate-600">
              For Customers
            </div>
            <h3 className="mt-5 font-display text-3xl font-semibold text-slate-950">
              Find verified local work with less guesswork
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                'Compare public reviews, service videos, and platform trust separately.',
                'Browse vendor and service pages that feel curated instead of crowded.',
                'Keep the same booking logic and support flows you already built.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--reliance-emerald)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link href="/auth/register?type=user">
                <Button className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
                  Join as Customer
                </Button>
              </Link>
            </div>
          </div>

          <div className="reliance-light-card rounded-[32px] px-6 py-7">
            <div className="reliance-kicker border border-[var(--reliance-border)] bg-slate-50 text-slate-600">
              For Vendors
            </div>
            <h3 className="mt-5 font-display text-3xl font-semibold text-slate-950">
              Present your business like a premium trust brand
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                'Showcase verified service videos instead of relying on text alone.',
                'Benefit from stronger trust-score presentation without altering the score itself.',
                'Keep your vendor, employee, moderation, and review workflows exactly as they are.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--reliance-blue)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link href="/auth/register?type=vendor">
                <Button variant="outline" className="rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50">
                  Join as Vendor
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicSiteFooter />
    </div>
  );
}
