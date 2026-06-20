'use client';

import Link from 'next/link';
import { CheckCircle2, Clock3, ShieldCheck, Star, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeroArtwork } from '@/components/public/PublicHeroArtwork';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { HomeStageVideoShowcase } from '@/components/public/HomeStageVideoShowcase';
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
  const heroServiceName = featuredService?.serviceName || 'See trusted work before you choose';
  const heroVendorName = featuredService?.vendorName || 'Reliance proof platform';
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
            ctaLabel="Create Account"
            ctaHref="/auth/register?type=user"
          />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,0.96fr)] lg:items-start">
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
                See local service proof before you <span className="text-[var(--reliance-blue-soft)]">choose</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/76 sm:text-xl">
                Compare completed work, public service videos, customer reviews, and Trust Score
                evidence before choosing a provider.
              </p>

              <div className="mt-8 max-w-[39rem]">
                <div className="reliance-glass rounded-[32px] border border-white/10 p-4 shadow-[0_30px_80px_rgba(4,9,20,0.38)]">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(6,17,31,0.55)]">
                    {hasCuratedHeroMedia && featuredService ? (
                      <PublicMediaPreview
                        autoPlayVideo
                        url={featuredService.previewMediaUrl}
                        type={featuredService.previewMediaType}
                        alt={featuredService.serviceName}
                        className="h-60 w-full object-cover sm:h-64"
                        videoLabel="Recent public service video"
                      />
                    ) : (
                      <PublicHeroArtwork serviceName={heroServiceName} vendorName={heroVendorName} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:pt-2">
              <HomeStageVideoShowcase />
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
            See what matters before you choose
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
                Recent public examples
              </div>
              <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950">
                Completed work customers can review
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                This preview highlights public examples currently visible on Reliance. When an
                approved public service video is available, it appears on the card automatically.
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {marketplaceLoading ? 'Loading services...' : `${totalPublicServices} public services live`}
            </span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {publicServicesLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="overflow-hidden rounded-[26px] border-slate-200">
                  <div className="h-44 bg-[linear-gradient(135deg,#0d1b35,#123b78_60%,#1d6dff)]" />
                  <CardContent className="space-y-3 p-5">
                    <div className="text-sm font-semibold text-slate-900">Loading service examples</div>
                    <div className="text-sm leading-6 text-slate-600">
                      Reliance is checking approved public examples, provider details, and any public
                      service videos.
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : marketplaceError && !hasMarketplaceResults ? (
              <div className="md:col-span-2 xl:col-span-4 rounded-[26px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">
                We could not load public service details right now. You can still open Browse Services.
              </div>
            ) : marketplaceResults.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-4 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
                Public examples will appear here as vendors finish approval and publish
                customer-visible service videos, reviews, and Trust Score context.
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
                      {cleanPublicServiceDescription(item.serviceDescription, item.vendorName) || 'Service offered with proof context pending'}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.publicListing.hasPublicMedia ? 'Public service video' : 'Service offered'}
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
              Choose providers with less guesswork
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                'Compare completed work, public service videos, customer reviews, and provider details in one place.',
                'Review vendor and service-offered pages before deciding who to contact.',
                'Track service records, approved service videos, and reviews from one customer account.',
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
              Turn completed work into proof customers can trust
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {[
                'Share approved public service videos instead of relying on text alone.',
                'Let customer reviews and Trust Score evidence stay separate and clear.',
                'Keep vendor, employee, moderation, and review workflows intact while building public credibility.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--reliance-blue)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link href="/auth/register?type=vendor">
                <Button className="rounded-full bg-[var(--reliance-blue)] text-white hover:bg-[#1a58db]">
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
