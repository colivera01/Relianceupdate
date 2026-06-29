'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LocateFixed, MapPin, ShieldCheck, Star, Video } from 'lucide-react';
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

type BrowserLocationOrigin = {
  latitude: number;
  longitude: number;
};

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

export default function HomePage() {
  const [browserLocationOrigin, setBrowserLocationOrigin] = useState<BrowserLocationOrigin | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>(
    'Use your current location to see how close approved recent posts are.'
  );
  const hasBrowserLocationOrigin = Boolean(browserLocationOrigin);
  const {
    data: marketplaceData,
    isLoading: marketplaceLoading,
    isError: marketplaceError,
  } = useDiscoverServices({
    sortBy: browserLocationOrigin ? 'distance' : 'newest',
    limit: HOME_MARKETPLACE_PREVIEW_LIMIT,
    onlyCompletedPublicProof: true,
    ...(browserLocationOrigin
      ? {
          lat: browserLocationOrigin.latitude,
          lng: browserLocationOrigin.longitude,
          radiusMiles: 50,
        }
      : {}),
  });

  const marketplaceResults = marketplaceData?.results || [];
  const featuredService = marketplaceResults[0] || null;
  const totalPublicServices = marketplaceData?.pagination?.total ?? 0;
  const heroServiceName = featuredService?.serviceName || 'See trusted work before you choose';
  const heroVendorName = featuredService?.vendorName || 'Reliance proof platform';
  const hasMarketplaceResults = marketplaceResults.length > 0;
  const publicServicesLoading = marketplaceLoading && marketplaceResults.length === 0;

  function handleUseCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('Current location is not available in this browser.');
      return;
    }

    setLocationStatus('Checking your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setLocationStatus('Reliance could not read a usable location from this browser.');
          return;
        }
        setBrowserLocationOrigin({ latitude, longitude });
        setLocationStatus('Showing approved recent posts within 50 miles of your current location.');
      },
      () => {
        setLocationStatus('Location was not allowed. Recent posts are shown without distance.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] text-white">
      <section className="reliance-dark-shell reliance-grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(53,214,165,0.14),transparent_20%)]" />
        <div className="relative w-full px-2 pb-20 pt-6 sm:px-6 lg:px-6 lg:pb-24 xl:px-8 2xl:px-10">
          <PublicSiteHeader
            tone="dark"
            links={[]}
            className="mb-10"
            ctaLabel="Create Account"
            ctaHref="/auth/register?type=user"
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(620px,1fr)_minmax(620px,1fr)] lg:items-start xl:gap-10 2xl:grid-cols-[minmax(700px,1fr)_minmax(700px,1fr)]">
            <div className="flex w-full flex-col">
              <div className="reliance-glass -mx-1 overflow-hidden rounded-[26px] border border-white/10 bg-[rgba(6,17,31,0.78)] p-1 shadow-[0_30px_90px_rgba(4,9,20,0.42)] sm:mx-0 sm:rounded-[34px] sm:p-2">
                <img
                  src="/homepage/hero-concepts/reliance-multitrade-collage-hero-v11.png"
                  alt="Reliance proof platform showing local professionals across electrical, plumbing, HVAC, cleaning, lawn care, beauty, auto, and appliance services."
                  className="block w-full rounded-[22px] sm:rounded-[28px]"
                />
              </div>

              <div className="mt-8 w-full lg:mt-24">
                <div className="reliance-glass rounded-[32px] border border-white/10 p-4 shadow-[0_30px_80px_rgba(4,9,20,0.38)]">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(6,17,31,0.55)]">
                    <PublicHeroArtwork serviceName={heroServiceName} vendorName={heroVendorName} />
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

      <section className="w-full px-4 py-28 sm:px-6 lg:px-6 xl:px-8 2xl:px-10">
        <div className="mb-12">
          <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-5 py-2 text-sm font-semibold uppercase tracking-[0.26em] text-white/70">
            How Reliance helps you compare
          </div>
          <h2 className="mt-6 max-w-6xl font-display text-6xl font-semibold leading-tight text-white xl:text-7xl">
            See what matters before you choose
          </h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {trustPillars.map((item) => (
            <div key={item.title} className="reliance-light-card flex min-h-[18rem] flex-col justify-center rounded-[36px] px-12 py-12">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,rgba(36,107,255,0.22),rgba(53,214,165,0.2))] text-[var(--reliance-blue)]">
                <item.icon className="h-9 w-9" />
              </div>
              <h3 className="mt-8 font-display text-5xl font-semibold leading-tight text-white">{item.title}</h3>
              <p className="mt-6 max-w-2xl text-2xl leading-10 text-white/76">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full px-4 pb-20 sm:px-6 lg:px-6 xl:px-8 2xl:px-10">
        <div className="reliance-light-card rounded-[38px] px-12 py-12">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.28em] text-white/62">
                Recent posts
              </div>
              <h2 className="mt-5 max-w-6xl font-display text-6xl font-semibold leading-tight text-white">
                Approved service posts customers can review
              </h2>
              <p className="mt-6 max-w-7xl text-2xl leading-10 text-white/76">
                This preview only shows completed three-stage service video posts after manager
                completion and public approval. Published services without an approved public video
                package stay in Browse, not here.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-4 xl:items-end">
              <span className="text-2xl font-semibold text-white/72">
                {marketplaceLoading ? 'Loading posts...' : `${totalPublicServices} recent posts live`}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentLocation}
                className="h-14 rounded-full border-white/10 bg-white/8 px-6 text-lg font-semibold text-white hover:bg-white/12"
              >
                <LocateFixed className="mr-2 h-5 w-5" />
                Use current location
              </Button>
            </div>
          </div>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/6 px-8 py-6 text-2xl leading-9 text-white/76">
            {locationStatus}
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
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
              <div className="md:col-span-2 xl:col-span-4 rounded-[30px] border border-white/10 bg-white/6 px-8 py-7 text-2xl leading-9 text-white/76">
                Recent posts will appear here after vendors complete all three stage videos and the
                public approval process finishes.
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
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {typeof item.distanceMiles === 'number' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                          <MapPin className="h-3.5 w-3.5" />
                          {item.distanceMiles.toFixed(1)} mi away
                        </span>
                      ) : hasBrowserLocationOrigin ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          Distance unavailable
                        </span>
                      ) : null}
                      {item.businessHours ? (
                        <span
                          className={`rounded-full px-3 py-1 ${
                            item.businessHours.openNow === true
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.businessHours.openNow === false
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                          title={item.businessHours.todayLabel || undefined}
                        >
                          {item.businessHours.openNow === true ? 'Open now' : item.businessHours.label}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Recent post
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

      <section className="w-full px-4 pb-24 sm:px-6 lg:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="reliance-light-card rounded-[38px] px-12 py-12">
            <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-5 py-2 text-sm font-semibold uppercase tracking-[0.26em] text-white/64">
              For Customers
            </div>
            <h3 className="mt-7 font-display text-5xl font-semibold leading-tight text-white">
              Choose providers with less guesswork
            </h3>
            <ul className="mt-8 space-y-5 text-2xl leading-9 text-white/76">
              {[
                'Compare completed work, public service videos, customer reviews, and provider details in one place.',
                'Review vendor and service-offered pages before deciding who to contact.',
                'Track service records, approved service videos, and reviews from one customer account.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-4">
                  <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-[var(--reliance-emerald)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <Link href="/auth/register?type=user">
                <Button className="h-14 rounded-full bg-[var(--reliance-blue)] px-7 text-lg font-semibold text-white hover:bg-[#1a58db]">
                  Join as Customer
                </Button>
              </Link>
            </div>
          </div>

          <div className="reliance-light-card rounded-[38px] px-12 py-12">
            <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-5 py-2 text-sm font-semibold uppercase tracking-[0.26em] text-white/64">
              For Vendors
            </div>
            <h3 className="mt-7 font-display text-5xl font-semibold leading-tight text-white">
              Turn completed work into proof customers can trust
            </h3>
            <ul className="mt-8 space-y-5 text-2xl leading-9 text-white/76">
              {[
                'Share approved public service videos instead of relying on text alone.',
                'Let customer reviews and Trust Score evidence stay separate and clear.',
                'Keep vendor, employee, moderation, and review workflows intact while building public credibility.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-4">
                  <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-[var(--reliance-blue)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <Link href="/auth/register?type=vendor">
                <Button className="h-14 rounded-full bg-[var(--reliance-blue)] px-7 text-lg font-semibold text-white hover:bg-[#1a58db]">
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
