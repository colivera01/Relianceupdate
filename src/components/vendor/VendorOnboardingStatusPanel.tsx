'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getVendorNextRecommendedAction } from '@/lib/user-guidance';
import type { VendorProfile } from '@/types/vendor';

type Props = {
  profile: VendorProfile;
  showActions?: boolean;
  compact?: boolean;
};

export default function VendorOnboardingStatusPanel({ profile, showActions = false, compact = false }: Props) {
  const onboarding = profile.onboarding;
  if (!onboarding) return null;
  const recommendedAction = getVendorNextRecommendedAction(onboarding);
  const isPending = onboarding.membershipStatus === 'PENDING';
  const isLive = onboarding.vendorVisibleToPublic;
  const statusTitle = isPending
    ? 'Admin review pending'
    : isLive
      ? 'Live and visible'
      : 'Approved, not public yet';

  if (compact) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-white shadow-[0_18px_48px_rgba(15,23,42,0.22)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/75">
              Vendor status
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-white">{statusTitle}</h2>
              <Badge variant="outline" className="border-blue-300/25 bg-blue-500/10 text-blue-100">
                {onboarding.approvalLabel}
              </Badge>
              <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
                {onboarding.publicVisibilityLabel}
              </Badge>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/68">
              {recommendedAction
                ? `${recommendedAction.label}: ${recommendedAction.detail}`
                : onboarding.nextStep}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
              {onboarding.serviceDraftCount} saved service{onboarding.serviceDraftCount === 1 ? '' : 's'}
            </Badge>
            <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
              {onboarding.publishedServiceCount} published
            </Badge>
            {showActions ? (
              <>
                <Link
                  href="/vendor/profile"
                  className="inline-flex items-center rounded-full border border-white/14 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Profile
                </Link>
                <Link
                  href="/vendor/services"
                  className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                >
                  Services
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <details className="group mt-3 border-t border-white/8 pt-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-blue-100/75 transition hover:text-blue-100">
            View setup details
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {onboarding.checklist.map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border px-3 py-3 ${
                  item.complete
                    ? 'border-blue-400/25 bg-blue-500/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      item.complete
                        ? 'bg-blue-500/18 text-blue-100'
                        : 'border border-blue-300/25 bg-slate-900/75 text-blue-100'
                    }`}
                  >
                    {item.complete ? 'Done' : 'Needed'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/62">{item.detail}</p>
              </div>
            ))}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200/80">
            Vendor onboarding status
          </p>
          <h2 className="text-2xl font-semibold">
            {isPending
              ? 'Finish setup while admin review is pending'
              : isLive
                ? 'Your vendor listing is live to the public'
                : 'Your vendor listing is approved, but not public yet'}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-white/72">{onboarding.nextStep}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-blue-300/25 bg-blue-500/10 text-blue-100">
            {onboarding.approvalLabel}
          </Badge>
          <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
            {onboarding.publicVisibilityLabel}
          </Badge>
          <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
            {onboarding.serviceDraftCount} saved service offered{onboarding.serviceDraftCount === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
            {onboarding.publishedServiceCount} published service{onboarding.publishedServiceCount === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      {recommendedAction ? (
        <div className="mt-5 rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/78">
            Next recommended action
          </p>
          <p className="mt-1 text-base font-semibold text-white">{recommendedAction.label}</p>
          <p className="mt-1 text-sm leading-6 text-white/72">{recommendedAction.detail}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {onboarding.checklist.map((item) => (
          <div
            key={item.key}
            className={`rounded-2xl border px-4 py-4 ${
              item.complete
                ? 'border-blue-400/30 bg-blue-500/10'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  item.complete
                    ? 'bg-blue-500/18 text-blue-100'
                    : 'border border-blue-300/25 bg-slate-900/75 text-blue-100'
                }`}
              >
                {item.complete ? 'Complete' : 'Needs action'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/68">{item.detail}</p>
          </div>
        ))}
      </div>

      {showActions ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/vendor/profile"
            className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Update business profile
          </Link>
          <Link
            href="/vendor/services"
            className="inline-flex items-center rounded-full border border-white/14 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Manage services
          </Link>
          <Link
            href="/vendor/support"
            className="inline-flex items-center rounded-full border border-white/14 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Open vendor help
          </Link>
        </div>
      ) : null}
    </section>
  );
}
