'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, Star, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeroArtwork } from '@/components/public/PublicHeroArtwork';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { useDiscoverServices } from '@/hooks/useServices';
import { cleanPublicServiceDescription } from '@/lib/launch-content-cleanup';

const HOME_MARKETPLACE_PREVIEW_LIMIT = 4;

const trustPillars = [
  {
    title: 'Customer Reviews',
    description: 'See what past customers chose to say about completed work.',
    icon: Star,
  },
  {
    title: 'Public Service Videos',
    description: 'Watch approved service videos when vendors choose to share them publicly.',
    icon: Video,
  },
  {
    title: 'Reliance Trust Score',
    description: 'See a separate platform signal based on verified completed work.',
    icon: ShieldCheck,
  },
];

const trustMetrics = [
  { label: 'Customer reviews', value: 'Public' },
  { label: 'Service videos', value: 'Approved' },
  { label: 'Provider details', value: 'Visible' },
  { label: 'Trust Score', value: 'Separate' },
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

  const marketplaceResults = marketplaceData?.results || [];
  const featuredService =
    marketplaceResults.find((item) => Boolean(item.previewMediaUrl) && Boolean(item.previewMediaType)) ||
    marketplaceResults[0] ||
    null;
  const totalPublicServices = marketplaceData?.pagination?.total ?? 0;
  const hasCuratedHeroMedia =
    Boolean(featuredService?.previewMediaUrl) &&
    Boolean(featuredService?.previewMediaType) &&
    !isPlaceholderMarketplacePreview(featuredService?.previewMediaUrl);
  const heroServiceName = featuredService?.serviceName || 'See trusted work before you book';
  const heroVendorName = featuredService?.vendorName || 'Reliance marketplace';
  const hasMarketplaceResults = marketplaceResults.length > 0;
  const publicServicesLoading = marketplaceLoading && marketplaceResults.length === 0;

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] text-white">
      <section className="reliance-dark-shell reliance-grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(53,214,165,0.14),transparent_20%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
          <PublicSiteHeader
            tone="dark"
            hideLogo
            links={[]}
            className="mb-10"
            ctaLabel="Find a Service"
            ctaHref="/browse"
          />

          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-7 -mt-1">
                <div className="flex h-[19rem] w-full max-w-[35rem] items-end justify-center overflow-visible sm:h-[20rem] lg:h-[21rem] lg:max-w-[37rem]">
                  <div className="relative w-[25rem] max-w-full -translate-y-5 sm:w-[27rem] lg:w-[29rem]">
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
                  Reviews + Service Videos + Trust Score
                </div>
              </div>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.96] text-white sm:text-6xl lg:text-7xl">
                Find local services you can <span className="text-[var(--reliance-blue-soft)]">trust</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/76 sm:text-xl">
                Compare customer reviews, public service videos, and provider details before you
                decide who to book.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth/register?type=user">
                  <Button className="h-12 rounded-full bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-6 text-white shadow-[0_22px_50px_rgba(36,107,255,0.32)] hover:brightness-110">
                    Create Account
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  disabled
                  className="h-12 rounded-full border-white/16 bg-white/6 px-6 text-white/74 backdrop-blur-md hover:bg-white/6 hover:text-white/74"
                >
                  <Clock3 className="mr-2 h-4 w-4" />
                  Reliance explainer video coming soon
                </Button>
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
                      Recent public service preview
                    </div>
                    <div className="mt-2 font-display text-2xl text-white">{heroServiceName}</div>
                  </div>
                  <Badge className="bg-[var(--reliance-blue)] text-white hover:bg-[var(--reliance-blue)]">
                    {marketplaceLoading ? 'Loading recent listings' : `${totalPublicServices} public services`}
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
                      videoLabel="Recent public service video"
                    />
                  ) : (
                    <PublicHeroArtwork serviceName={heroServiceName} vendorName={heroVendorName} />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white/92">{heroVendorName}</p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-white/64">
                      {featuredService
                        ? cleanPublicServiceDescription(featuredService.serviceDescription, featuredService.vendorName) ||
                          'Newest public service listing'
                        : 'Reliance shows the newest public services here so customers can quickly see what is already public.'}
                    </p>
                  </div>
                  {featuredService ? (
                    <Link href={`/service/${featuredService.serviceId}?returnTo=%2F&returnLabel=Back%20to%20Home%20Page`}>
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
                    What you can compare
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Customer reviews, public service videos, and the Reliance Trust Score each
                    answer a different question before you book.
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
                    See how service videos work
                  </div>
                  <div className="mt-3 text-xl font-semibold text-slate-950">
                    Before, during, and completed service
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Reliance service videos can show a clear before-service, during-service, and
                    completed-service story when a vendor shares approved public clips.
                  </p>
                  <div className="mt-5 space-y-2">
                    {['Before Service', 'During Service', 'Completed Service'].map((stage) => (
                      <div key={stage} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        {stage}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    disabled
                    className="mt-5 w-full rounded-full border-slate-300 bg-white text-slate-500"
                  >
                    Reliance explainer video coming soon
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="reliance-kicker border border-[var(--reliance-border)] bg-white/5 text-white/62">
            How Reliance helps you compare
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold text-slate-950 sm:text-4xl">
            See what matters before you book
          </h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {trustPillars.map((item) => (
            <div key={item.title} className="reliance-light-card rounded-[30px] px-6 py-6">
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
        <div className="reliance-light-card rounded-[32px] px-6 py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                Recent public services
              </div>
              <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">
                Newest services customers can compare right now
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                This preview shows the newest public services currently listed on Reliance. When a
                public service video is available, it appears on the card automatically.
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {marketplaceLoading ? 'Loading recent public services...' : `${totalPublicServices} public services live`}
            </span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {publicServicesLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="overflow-hidden rounded-[26px] border-slate-200">
                  <div className="h-44 bg-[linear-gradient(135deg,#0d1b35,#123b78_60%,#1d6dff)]" />
                  <CardContent className="space-y-3 p-5">
                    <div className="text-sm font-semibold text-slate-900">Loading recent public services</div>
                    <div className="text-sm leading-6 text-slate-600">
                      Reliance is checking the newest public listings, provider details, and any
                      public service videos.
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : marketplaceError && !hasMarketplaceResults ? (
              <div className="md:col-span-2 xl:col-span-4 rounded-[26px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">
                We could not load recent public services right now. You can still open the live
                marketplace from Find a Service.
              </div>
            ) : marketplaceResults.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-4 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
                Public services will appear here as vendors finish approval and publish
                customer-facing listings.
              </div>
            ) : (
              marketplaceResults.map((item) => (
                <Card key={item.serviceId} className="overflow-hidden rounded-[26px] border-slate-200 bg-white shadow-none">
                  <PublicMediaPreview
                    url={item.previewMediaUrl}
                    type={item.previewMediaType}
                    alt={item.serviceName}
                    className="h-44 w-full object-cover"
                    videoLabel="Public service video"
                  />
                  <CardContent className="space-y-3 p-5">
                    <div className="font-display text-xl font-semibold text-slate-950">{item.serviceName}</div>
                    <div className="text-sm text-slate-500">{item.vendorName}</div>
                    <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                      {cleanPublicServiceDescription(item.serviceDescription, item.vendorName) || 'Public service listing'}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.publicListing.hasPublicMedia ? 'Public service video' : 'Public listing'}
                      </span>
                      <Link
                        href={`/service/${item.serviceId}?returnTo=%2F&returnLabel=Back%20to%20Home%20Page`}
                        className="text-sm font-semibold text-[var(--reliance-blue)]"
                      >
                        View
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
              Find local services with less guesswork
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                'Compare customer reviews, public service videos, and provider details in one place.',
                'Browse vendor and service pages before you decide who to book.',
                'Track bookings, approved service videos, and reviews from one customer account.',
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
              Show your business clearly to new customers
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                'Share public service videos instead of relying on text alone.',
                'Let customer reviews and the Reliance Trust Score stay separate and clear.',
                'Keep your vendor, employee, moderation, and review workflows intact.',
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
