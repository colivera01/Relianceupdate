"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, Star } from "lucide-react";
import { PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";
import { cn } from "@/lib/utils";
import type {
  PublicTrustEvidenceSummary,
  PublicTrustPresentationSummary,
} from "@/lib/public-trust-score-presentation";

type PublicTrustComponent = {
  pct: number | null;
  numerator: number;
  denominator: number;
  weightPct: number;
};

type PublicTrustScorePayload = {
  scored: boolean;
  totalScorePct: number | null;
  explanation?: string;
  separation?: string;
  evidence?: PublicTrustEvidenceSummary;
  presentation?: PublicTrustPresentationSummary;
  components?: Record<string, PublicTrustComponent> | null;
  explanationDetails?: {
    overview: string;
    coverageSummary: string;
    strongestSignals: string[];
    watchItems: string[];
    methodology: string[];
  };
};

type PublicTrustScorePanelProps = {
  vendorId: string;
  customerRating?: number | null;
  customerReviewCount?: number | null;
  compact?: boolean;
  className?: string;
};

const PUBLIC_TRUST_SCORE_RETRY_ATTEMPTS = 3;
const PUBLIC_TRUST_SCORE_RETRY_DELAY_MS = 1_200;

const componentLabels: Record<string, string> = {
  workflowCompletion: "Workflow completion",
  videoVerification: "Video verification",
  disputeFree: "Dispute-free completion",
  operationalReliability: "Operational reliability",
};

const evidenceDetails: Record<string, string> = {
  verifiedBookings: "Completed bookings verified through Reliance.",
  approvedServiceVideos: "Approved public service videos on this vendor profile.",
  publicReviews: "Published customer reviews customers can read right now.",
  validatedDisputes: "Disputes confirmed through Reliance review records.",
};

const toneClasses: Record<
  NonNullable<PublicTrustScorePayload["presentation"]>["tone"],
  {
    scoreCard: string;
    scoreValue: string;
    maturityBadge: string;
    evidenceCard: string;
  }
> = {
  muted: {
    scoreCard: "border-white/10 bg-white/8",
    scoreValue: "text-white/78",
    maturityBadge: "border-white/12 bg-white/8 text-white/72",
    evidenceCard: "border-slate-200 bg-slate-50",
  },
  calm: {
    scoreCard: "border-blue-200/30 bg-blue-400/12",
    scoreValue: "text-blue-100",
    maturityBadge: "border-blue-200/40 bg-blue-400/12 text-blue-100",
    evidenceCard: "border-blue-100 bg-blue-50",
  },
  balanced: {
    scoreCard: "border-cyan-200/30 bg-cyan-400/12",
    scoreValue: "text-cyan-100",
    maturityBadge: "border-cyan-200/40 bg-cyan-400/12 text-cyan-100",
    evidenceCard: "border-cyan-100 bg-cyan-50",
  },
  strong: {
    scoreCard: "border-emerald-200/30 bg-emerald-400/12",
    scoreValue: "text-emerald-300",
    maturityBadge: "border-emerald-200/40 bg-emerald-400/12 text-emerald-100",
    evidenceCard: "border-emerald-100 bg-emerald-50",
  },
};

export function PublicTrustScorePanel({
  vendorId,
  customerRating = null,
  customerReviewCount = null,
  compact = false,
  className,
}: PublicTrustScorePanelProps) {
  const [trustScore, setTrustScore] = useState<PublicTrustScorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        for (let attempt = 0; attempt < PUBLIC_TRUST_SCORE_RETRY_ATTEMPTS; attempt += 1) {
          const res = await fetch(`/api/vendors/${vendorId}/trust-score`, { cache: "no-store" });
          const json = await res.json().catch(() => ({}));
          const retryableDbUnavailable =
            res.status === 503 || json?.code === PUBLIC_DB_UNAVAILABLE_CODE;

          if (!res.ok || json?.success === false) {
            if (retryableDbUnavailable && attempt < PUBLIC_TRUST_SCORE_RETRY_ATTEMPTS - 1) {
              await new Promise((resolve) => setTimeout(resolve, PUBLIC_TRUST_SCORE_RETRY_DELAY_MS));
              continue;
            }
            throw new Error(String(json?.error || "Trust Score is temporarily unavailable."));
          }

          if (!cancelled) {
            setTrustScore((json?.trustScore as PublicTrustScorePayload) || null);
          }
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Trust Score is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (vendorId) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const componentEntries = useMemo(() => {
    const components = trustScore?.components || {};
    return Object.entries(components).filter(([, value]) => value && value.pct !== null);
  }, [trustScore?.components]);

  const presentation: PublicTrustPresentationSummary = trustScore?.presentation || {
    maturityState: "not_ready",
    maturityLabel: "Building",
    title: "Trust Score building",
    scoreDisplay: null,
    summary: "More verified completed work is needed before a public Trust Score appears.",
    tone: "muted",
    scoreEmphasis: "subtle",
  };
  const evidence = trustScore?.evidence || {
    verifiedBookings: 0,
    approvedServiceVideos: 0,
    validatedDisputes: 0,
  };
  const publicReviewCountValue =
    typeof customerReviewCount === "number" && Number.isFinite(customerReviewCount)
      ? customerReviewCount
      : 0;
  const visualTone = toneClasses[presentation.tone];

  return (
    <section
      className={cn(
        "reliance-light-card overflow-hidden rounded-[28px]",
        className
      )}
    >
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(36,107,255,0.26),transparent_45%),linear-gradient(135deg,#06111f,#10203a_68%,#183d7a)] px-5 py-5 text-white sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/78">
              <ShieldCheck className="h-3.5 w-3.5" />
              Provider trust
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold">{presentation.title}</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/74">
              {loading
                ? "Loading the latest Trust Score context for this provider."
                : presentation.summary}
            </p>
          </div>
          <div className={cn("rounded-2xl border px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]", visualTone.scoreCard)}>
            <div className={cn("inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]", visualTone.maturityBadge)}>
              {loading ? "Loading" : presentation.maturityLabel}
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.24em] text-white/70">Trust Score</div>
            <div
              className={cn(
                "mt-1 font-semibold",
                presentation.scoreEmphasis === "subtle"
                  ? "text-2xl"
                  : presentation.scoreEmphasis === "standard"
                  ? "text-[2rem]"
                  : "text-3xl",
                visualTone.scoreValue
              )}
            >
              {loading ? "..." : presentation.scoreDisplay || "Building"}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              <Star className="h-3.5 w-3.5" />
              Customer Rating
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {typeof customerRating === "number" ? customerRating.toFixed(1) : "New"}
            </div>
            <div className="mt-1 text-sm text-white/72">
              {typeof customerReviewCount === "number"
                ? `${customerReviewCount} public review${customerReviewCount === 1 ? "" : "s"}`
                : "Public reviews are still building"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Separate Systems
            </div>
            <p className="mt-2 text-sm leading-6 text-white/82">
              Customer Rating comes from public reviews. The Reliance Trust Score reflects verified completed work and platform performance.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
          </div>
        ) : error && !trustScore ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Trust Score temporarily unavailable
            </div>
            <p className="mt-1 text-amber-800">{error}</p>
          </div>
        ) : !trustScore?.scored ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            More verified completed work is needed before a public Trust Score appears.
          </div>
        ) : (
          <>
            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Showing the latest available Trust Score
                </div>
                <p className="mt-1 text-amber-800">
                  Live refresh is temporarily unavailable, so this panel is showing the latest
                  confirmed trust view.
                </p>
              </div>
            ) : null}
            <div className={cn("rounded-2xl border px-4 py-4", visualTone.evidenceCard)}>
              <div className="text-sm font-semibold text-slate-950">What this score is based on</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    key: 'verifiedBookings',
                    label: 'Verified bookings',
                    value: evidence.verifiedBookings,
                  },
                  {
                    key: 'approvedServiceVideos',
                    label: 'Approved service videos',
                    value: evidence.approvedServiceVideos,
                  },
                  {
                    key: 'publicReviews',
                    label: 'Public reviews',
                    value: publicReviewCountValue,
                  },
                  {
                    key: 'validatedDisputes',
                    label: 'Validated disputes',
                    value: evidence.validatedDisputes,
                  },
                ].map((item) => (
                  <div key={item.key} className="min-w-0 rounded-2xl border border-white/60 bg-white/80 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.14em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{evidenceDetails[item.key]}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Public reviews help customers compare feedback, but they do not change the Reliance Trust Score.
              </p>
            </div>

            {componentEntries.length > 0 ? (
              <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
                {componentEntries.map(([key, component]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {componentLabels[key] || key}
                        </div>
                        <div className="text-xs text-slate-500">
                          Weight {component.weightPct}%
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-slate-950">
                        {component.pct ?? "Pending"}%
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#246BFF,#35D6A5)]"
                        style={{ width: `${Math.max(0, Math.min(100, component.pct ?? 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!compact && trustScore?.explanationDetails ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {trustScore.explanationDetails.strongestSignals.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="text-sm font-semibold text-emerald-950">Strongest signals</div>
                    <ul className="mt-2 space-y-2 text-sm text-emerald-900">
                      {trustScore.explanationDetails.strongestSignals.slice(0, 2).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {trustScore.explanationDetails.watchItems.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="text-sm font-semibold text-amber-950">Watch items</div>
                    <ul className="mt-2 space-y-2 text-sm text-amber-900">
                      {trustScore.explanationDetails.watchItems.slice(0, 2).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
