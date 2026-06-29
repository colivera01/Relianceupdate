'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicMediaPreview } from '@/components/public/PublicMediaPreview';
import { buildProofCard } from '@/lib/proof-card';
import type { DiscoverServiceResult } from '@/types/api';
import { CheckCircle2, Circle, MapPin, ShieldCheck } from 'lucide-react';

type ProofFirstCardProps = {
  item: DiscoverServiceResult;
  proofHref: string;
  providerHref: string;
  secondaryAction?: ReactNode;
  compact?: boolean;
};

const KIND_STYLES: Record<string, { card: string; badge: string; label: string }> = {
  public_proof: {
    card: 'border-emerald-400/35 bg-[linear-gradient(145deg,rgba(6,78,59,0.72),rgba(8,17,34,0.96)_48%,rgba(15,23,42,0.98))]',
    badge: 'bg-emerald-600 text-white hover:bg-emerald-600',
    label: 'Completed work',
  },
  partial_proof: {
    card: 'border-blue-400/35 bg-[linear-gradient(145deg,rgba(30,64,175,0.54),rgba(8,17,34,0.96)_50%,rgba(15,23,42,0.98))]',
    badge: 'bg-blue-600 text-white hover:bg-blue-600',
    label: 'Trust signals building',
  },
  service_offered_only: {
    card: 'border-slate-700/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(8,17,34,0.98)_54%,rgba(2,6,23,0.98))]',
    badge: 'bg-slate-800 text-white hover:bg-slate-800',
    label: 'Service offered',
  },
};

function formatDistanceMiles(value: number): string {
  return `${value.toFixed(1)} mi away`;
}

function getProofCard(item: DiscoverServiceResult) {
  return (
    item.proofCard ||
    buildProofCard({
      serviceName: item.serviceName,
      vendorName: item.vendorName,
      hasPublicMedia: item.publicListing?.hasPublicMedia,
      reviewCount: item.reviewCount,
      trustScore: item.trustScore,
    })
  );
}

function StageChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100'
          : 'border-white/10 bg-white/[0.05] text-slate-300'
      }`}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function ProofFirstCard({
  item,
  proofHref,
  providerHref,
  secondaryAction,
  compact = false,
}: ProofFirstCardProps) {
  const proofCard = getProofCard(item);
  const styles = KIND_STYLES[proofCard.kind] || KIND_STYLES.service_offered_only;
  const primaryHref = proofCard.primaryCta === 'View Provider' ? providerHref : proofHref;
  const hasProof = proofCard.kind !== 'service_offered_only';

  return (
    <Card
      className={`flex h-full flex-col overflow-hidden rounded-[28px] transition-all hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(7,16,38,0.14)] ${styles.card}`}
    >
      <div className="relative">
        <PublicMediaPreview
          url={item.previewMediaUrl}
          type={item.previewMediaType}
          alt={proofCard.headline}
          className={`${compact ? 'h-40' : 'h-48'} w-full object-cover rounded-t-[28px]`}
          emptyLabel="Service video not available yet"
          videoLabel="Public service video"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className={styles.badge}>{styles.label}</Badge>
          {item.promotion?.label ? (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">{item.promotion.label}</Badge>
          ) : null}
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col p-5">
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
            {proofCard.statusLabel}
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold leading-snug text-white">
            {proofCard.headline}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
            {hasProof
              ? proofCard.evidenceSummary
              : 'This is a service offered by the provider. Customer-visible videos and reviews for this work type are still building.'}
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <StageChip label="Starting Condition" active={proofCard.stageAvailability.startingCondition} />
          <StageChip label="Work In Progress" active={proofCard.stageAvailability.workInProgress} />
          <StageChip label="Final Result" active={proofCard.stageAvailability.finalResult} />
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-white">
            <div className="font-semibold">{proofCard.reviewLabel}</div>
            <div className="mt-1 leading-5 text-slate-300">
              {item.reviewCount && item.reviewCount > 0
                ? 'Customer feedback is visible.'
                : 'Customer reviews stay separate from Trust Score.'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-white">
            <div className="flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />
              {proofCard.trustLabel}
            </div>
            <div className="mt-1 leading-5 text-slate-300">Operational trust context.</div>
          </div>
        </div>

        <div className="mt-4 space-y-1 text-sm text-slate-300">
          <p>
            <span className="font-semibold text-white">Provider:</span> {item.vendorName}
          </p>
          <p>
            <span className="font-semibold text-white">Services Offered / Work Type:</span>{' '}
            {item.vendorCategory || item.vendorBusinessType || 'General service work'}
          </p>
          {item.location ? (
            <p className="flex items-center gap-1 text-slate-300">
              <MapPin className="h-4 w-4" />
              {item.location}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {typeof item.distanceMiles === 'number' ? (
              <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {formatDistanceMiles(item.distanceMiles)}
              </span>
            ) : null}
            {item.businessHours ? (
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                  item.businessHours.openNow === true
                    ? 'bg-emerald-400/15 text-emerald-100'
                    : item.businessHours.openNow === false
                      ? 'bg-amber-400/15 text-amber-100'
                      : 'bg-white/10 text-slate-200'
                }`}
                title={item.businessHours.todayLabel || undefined}
              >
                {item.businessHours.openNow === true ? 'Open now' : item.businessHours.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Link href={primaryHref} className="block">
            <Button size="sm" className="w-full bg-blue-600 text-white hover:bg-blue-700">
              {proofCard.primaryCta}
            </Button>
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <Link href={providerHref} className="flex-1">
              <Button size="sm" variant="outline" className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                View Provider
              </Button>
            </Link>
            {secondaryAction}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
