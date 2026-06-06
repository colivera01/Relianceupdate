"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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

const componentLabels: Record<string, string> = {
  workflowCompletion: "Workflow completion",
  videoVerification: "Video verification",
  disputeFree: "Dispute-free completion",
  operationalReliability: "Operational reliability",
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
        const res = await fetch(`/api/vendors/${vendorId}/trust-score`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(String(json?.error || "Trust Score is temporarily unavailable."));
        }
        if (!cancelled) {
          setTrustScore((json?.trustScore as PublicTrustScorePayload) || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Trust Score is temporarily unavailable.");
          setTrustScore(null);
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
              Trust Snapshot
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold">Trust Beyond Reviews</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">Reliance Trust Score</div>
            <div className="mt-1 text-3xl font-semibold text-emerald-300">
              {loading ? "..." : trustScore?.scored && trustScore?.totalScorePct !== null ? `${trustScore.totalScorePct}%` : "N/A"}
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
              Customer Ratings capture opinion. The Reliance Trust Score measures verified platform performance.
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
        ) : error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Trust Score temporarily unavailable
            </div>
            <p className="mt-1 text-amber-800">{error}</p>
          </div>
        ) : !trustScore?.scored ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            {trustScore?.explanationDetails?.coverageSummary || "Reliance has not recorded enough finalized activity to publish this Trust Score yet."}
          </div>
        ) : (
          <>
            {trustScore?.explanationDetails?.overview ? (
              <p className="text-sm leading-6 text-slate-700">
                {trustScore.explanationDetails.overview}
              </p>
            ) : null}

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
                        {component.pct ?? "N/A"}%
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
