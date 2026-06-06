'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { VendorProfile } from '@/types/vendor';

type Props = {
  profile: VendorProfile;
  showActions?: boolean;
};

export default function VendorOnboardingStatusPanel({ profile, showActions = false }: Props) {
  const onboarding = profile.onboarding;
  if (!onboarding) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200/80">
            Vendor onboarding status
          </p>
          <h2 className="text-2xl font-semibold">
            {onboarding.membershipStatus === 'PENDING'
              ? 'Finish setup while admin review is pending'
              : onboarding.vendorVisibleToPublic
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
            {onboarding.serviceDraftCount} service draft{onboarding.serviceDraftCount === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline" className="border-white/15 bg-white/6 text-white/88">
            {onboarding.publishedServiceCount} published service{onboarding.publishedServiceCount === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {onboarding.checklist.map((item) => (
          <div
            key={item.key}
            className={`rounded-2xl border px-4 py-4 ${
              item.complete
                ? 'border-emerald-400/30 bg-emerald-500/10'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  item.complete
                    ? 'bg-emerald-500/18 text-emerald-200'
                    : 'bg-amber-500/18 text-amber-200'
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
            Manage service drafts
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
