'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Info, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getClientAuthHeaders } from '@/lib/client-session';
import { buildVendorCoachingPlan } from '@/lib/vendor-coaching';
import { deriveVendorAnalyticsMetrics } from '@/lib/vendor-analytics';
import type { VendorDashboardResponse } from '@/types/vendor';

interface TrustScoreComponentMetric {
  pct: number | null;
  numerator: number;
  denominator: number;
  weightPct: number;
}

interface TrustScoreExplanationDetails {
  overview: string;
  coverageSummary: string;
  strongestSignals: string[];
  watchItems: string[];
  methodology: string[];
}

interface VendorTrustScorePayload {
  scored: boolean;
  scoreVersion?: number | null;
  totalScorePct: number | null;
  components: {
    workflowCompletion: TrustScoreComponentMetric;
    videoVerification: TrustScoreComponentMetric;
    disputeFree: TrustScoreComponentMetric;
    operationalReliability: TrustScoreComponentMetric;
  } | null;
  computedAt: string | null;
  presentation?: {
    maturityState: 'not_ready' | 'early_stage' | 'emerging' | 'established';
    maturityLabel: string;
    title: string;
    scoreDisplay: string | null;
    summary: string;
  };
  explanation: string;
  explanationDetails: TrustScoreExplanationDetails;
  separation: string;
  improvementHints: string[];
}

interface VendorCoachingSummaryPayload {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  priorityHeadline: string;
  recommendedFocus: string[];
  positiveSignals: string[];
  watchouts: string[];
  nextCheckIn: string;
}

interface VendorCoachingSummaryResponse {
  model: string | null;
  promptVersion: string | null;
  suggestion: VendorCoachingSummaryPayload;
}

const COMPONENT_ROWS: Array<{
  key: keyof NonNullable<VendorTrustScorePayload['components']>;
  label: string;
}> = [
  { key: 'workflowCompletion', label: 'Verified workflow completion' },
  { key: 'videoVerification', label: 'Video verification success' },
  { key: 'disputeFree', label: 'Dispute-free completion' },
];

function formatPct(pct: number | null): string {
  return pct === null || pct === undefined ? 'Not yet measurable' : `${pct}%`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function buildDashboardSnapshot(dashboardData: VendorDashboardResponse) {
  const derived = deriveVendorAnalyticsMetrics(dashboardData);

  return {
    totalBookings: derived.totalBookings,
    totalClients: derived.totalClients,
    rating: derived.rating,
    ratingCount: derived.ratingCount,
    approvedVideos: derived.approvedServiceOrders,
    pendingVideos: derived.pendingServiceOrders,
    archivedVideos: derived.archivedServiceOrders,
    totalVideoAssets: derived.totalProofAssets,
    storagePercentUsed: derived.storagePercent,
    completedJobs: derived.completedJobs,
    inProgressJobs: derived.inProgressJobs,
    scheduledJobs: derived.scheduledJobs,
    reviewCoverage: derived.verifiedRatingCoverage,
  };
}

export function VendorTrustScoreCard({
  dashboardData,
  onRefreshDashboard,
}: {
  dashboardData?: VendorDashboardResponse | null;
  onRefreshDashboard?: () => Promise<unknown> | unknown;
}) {
  const { user } = useAuth();
  const [trustScore, setTrustScore] = useState<VendorTrustScorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<VendorCoachingSummaryResponse | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const loadTrustScore = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setRefreshNotice(null);
    if (refresh) {
      setAiSummary(null);
      setAiSummaryError(null);
    }

    try {
      const response = await fetch('/api/vendor/trust-score', {
        method: refresh ? 'POST' : 'GET',
        headers: getClientAuthHeaders(),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.message || payload?.error || `Status ${response.status}`));
      }
      setTrustScore((payload?.trustScore as VendorTrustScorePayload) || null);
      setVerifiedAt(String(payload?.verifiedAt || '') || null);
      if (refresh && onRefreshDashboard) {
        try {
          await onRefreshDashboard();
        } catch {
          setRefreshNotice(
            'The reliability score refreshed, but the other dashboard metrics could not be refreshed. Try again.',
          );
        }
      }
    } catch (err) {
      setTrustScore(null);
      setError(err instanceof Error ? err.message : 'Failed to load the reliability score');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTrustScore();
  }, [user?.id]);

  const coachingPlan = buildVendorCoachingPlan(trustScore, dashboardData);
  const coachingInputFingerprint = useMemo(
    () =>
      JSON.stringify({
        computedAt: trustScore?.computedAt || null,
        totalScorePct: trustScore?.totalScorePct ?? null,
        components: trustScore?.components || null,
        dashboard: dashboardData
          ? {
              totalBookings: dashboardData.stats?.totalBookings ?? 0,
              completed: dashboardData.lifecycleCounts?.completed ?? 0,
              inProgress: dashboardData.lifecycleCounts?.inProgress ?? 0,
              pendingAudit:
                dashboardData.pendingModerationServiceOrderCount ??
                dashboardData.pendingModerationProofs ??
                0,
              approved:
                dashboardData.approvedServiceOrderCount ?? dashboardData.approvedProofs ?? 0,
              publicReviews:
                dashboardData.stats?.publicWrittenReviewCount ??
                dashboardData.recentReviews?.length ??
                0,
              storagePercentUsed: dashboardData.storagePercentUsed ?? 0,
            }
          : null,
      }),
    [dashboardData, trustScore],
  );

  useEffect(() => {
    setAiSummary(null);
    setAiSummaryError(null);
  }, [user?.id, coachingInputFingerprint]);

  const loadAiSummary = async (refresh = false) => {
    if (!trustScore?.scored || !trustScore.components || !dashboardData) {
      setAiSummaryError('Reliability data is not ready for an AI coaching summary yet.');
      return;
    }

    setAiSummaryError(null);
    setAiSummaryLoading(true);

    try {
      const response = await fetch('/api/vendor/coaching-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuthHeaders(),
        },
        body: JSON.stringify({
          vendorName:
            dashboardData.profile.businessName ||
            `${dashboardData.profile.firstName || ''} ${dashboardData.profile.lastName || ''}`.trim() ||
            'Your business',
          trustScore: {
            scored: trustScore.scored,
            totalScorePct: trustScore.totalScorePct,
            explanationOverview: trustScore.explanationDetails.overview,
            coverageSummary: trustScore.explanationDetails.coverageSummary,
            strongestSignals: trustScore.explanationDetails.strongestSignals,
            watchItems: trustScore.explanationDetails.watchItems,
            improvementHints: trustScore.improvementHints || [],
            components: trustScore.components,
          },
          coachingPlan,
          dashboardSnapshot: buildDashboardSnapshot(dashboardData),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.message || payload?.error || `Status ${response.status}`));
      }
      setAiSummary({
        model: String(payload?.model || ''),
        promptVersion: String(payload?.promptVersion || ''),
        suggestion: payload?.suggestion as VendorCoachingSummaryPayload,
      });
    } catch (err) {
      setAiSummary(null);
      setAiSummaryError(err instanceof Error ? err.message : 'Failed to generate AI coaching summary');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" aria-hidden="true" />
              <CardTitle>Reliance Trust Score</CardTitle>
              <Badge variant="outline">Version {trustScore?.scoreVersion || 2}</Badge>
              <Badge variant="outline">Vendor view</Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              A verified reliability measure based on finalized Reliance work. Customer star
              ratings and written reviews remain separate.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadTrustScore(true)}
            disabled={loading || refreshing}
            className="shrink-0"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {refreshing ? 'Refreshing analytics...' : 'Refresh analytics'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-4 p-5 sm:p-6" aria-label="Loading reliability score">
            <div className="h-12 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ) : error ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-4 text-sm" role="alert">
              <p className="font-semibold">Reliability analytics could not be loaded.</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void loadTrustScore(true)}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : !trustScore?.scored ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-md border border-dashed p-5 text-sm">
              <p className="font-semibold">Reliability score not ready yet</p>
              <p className="mt-1 max-w-3xl text-muted-foreground">
                A score appears after finalized activity exists for workflow completion, video
                verification, and dispute-free completion. Partial evidence is not presented as a
                complete score.
              </p>
              {trustScore?.explanationDetails?.coverageSummary ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {trustScore.explanationDetails.coverageSummary}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            {refreshNotice ? (
              <div className="border-b border-amber-400/30 bg-amber-500/10 px-5 py-3 text-sm sm:px-6" role="status">
                {refreshNotice}
              </div>
            ) : null}
            <section className="grid gap-6 border-b p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
              <div>
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                  <span className="text-5xl font-bold leading-none text-blue-500">
                    {trustScore.totalScorePct ?? 'N/A'}
                  </span>
                  <span className="pb-1 text-lg font-semibold text-muted-foreground">/100</span>
                  {trustScore.presentation?.maturityLabel ? (
                    <Badge className="mb-1">{trustScore.presentation.maturityLabel}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {trustScore.presentation?.summary || trustScore.explanationDetails.overview}
                </p>
              </div>

              <div className="divide-y rounded-md border bg-muted/15 text-sm">
                <div className="flex gap-3 p-4">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium">All finalized activity on record</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {verifiedAt ? 'Last verified' : 'Snapshot updated'}:{' '}
                      {formatDate(verifiedAt || trustScore.computedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" aria-hidden="true" />
                  <p className="text-xs leading-5 text-muted-foreground">{trustScore.separation}</p>
                </div>
              </div>
            </section>

            <section className="border-b p-5 sm:p-6" aria-labelledby="reliability-components-heading">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 id="reliability-components-heading" className="font-semibold">
                    Verified components
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every component must have finalized evidence before a total is shown.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {trustScore.explanationDetails.coverageSummary}
                </p>
              </div>

              <div className="mt-4 divide-y rounded-md border">
                {trustScore.components
                  ? COMPONENT_ROWS.map(({ key, label }) => {
                      const component = trustScore.components![key];
                      const progress = component.pct ?? 0;
                      return (
                        <div key={key} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium">{label}</p>
                              <p className="text-xs text-muted-foreground">
                                Weight {component.weightPct}%
                              </p>
                            </div>
                            <div
                              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                              role="progressbar"
                              aria-label={label}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={component.pct ?? undefined}
                            >
                              <div
                                className="h-full rounded-full bg-blue-500 transition-[width]"
                                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold">{formatPct(component.pct)}</p>
                            <p className="text-xs text-muted-foreground">
                              {component.numerator} of {component.denominator} finalized
                            </p>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            </section>

            <section className="border-b p-5 sm:p-6" aria-labelledby="next-actions-heading">
              <div className="max-w-3xl">
                <h3 id="next-actions-heading" className="font-semibold">Recommended next actions</h3>
                <p className="mt-1 text-sm text-muted-foreground">{coachingPlan.summary}</p>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-3 md:divide-x">
                <div className="md:pr-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    Priority
                  </div>
                  {coachingPlan.priorityActions.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                      {coachingPlan.priorityActions.map((item, index) => (
                        <li key={`priority-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No corrective reliability action is required right now.
                    </p>
                  )}
                </div>

                <div className="md:px-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-blue-500" aria-hidden="true" />
                    Current strengths
                  </div>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {coachingPlan.strengths.map((item, index) => (
                      <li key={`strength-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="md:pl-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4 text-cyan-500" aria-hidden="true" />
                    Current context
                  </div>
                  {coachingPlan.operationalNotes.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                      {coachingPlan.operationalNotes.map((item, index) => (
                        <li key={`note-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No additional operational notes.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="border-b p-5 sm:p-6">
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  How the score is calculated
                  <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                    Show methodology
                  </span>
                </summary>
                <div className="mt-4 grid gap-5 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    <p className="font-medium text-foreground">Evidence interpretation</p>
                    <p className="mt-1">{trustScore.explanationDetails.overview}</p>
                    {trustScore.explanationDetails.watchItems.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {trustScore.explanationDetails.watchItems.map((item, index) => (
                          <li key={`watch-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Methodology</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {trustScore.explanationDetails.methodology.map((item, index) => (
                        <li key={`method-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </section>

            <section className="p-5 sm:p-6" aria-labelledby="ai-coaching-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="ai-coaching-heading" className="font-semibold">Optional AI coaching</h3>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                    This advisory summary uses only the verified score and dashboard signals shown
                    here. It never changes the score or the underlying records.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadAiSummary(Boolean(aiSummary))}
                  disabled={aiSummaryLoading || !dashboardData}
                >
                  {aiSummaryLoading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {aiSummary ? 'Refresh coaching' : 'Generate coaching'}
                </Button>
              </div>

              {aiSummaryLoading ? (
                <div className="mt-4 space-y-2" aria-label="Generating AI coaching">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </div>
              ) : aiSummaryError ? (
                <p className="mt-4 text-sm text-amber-600">{aiSummaryError}</p>
              ) : aiSummary ? (
                <div className="mt-5 grid gap-5 text-sm md:grid-cols-2">
                  <div>
                    <p className="font-medium">{aiSummary.suggestion.priorityHeadline}</p>
                    <p className="mt-1 text-muted-foreground">{aiSummary.suggestion.summary}</p>
                  </div>
                  <div>
                    <p className="font-medium">Recommended focus</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {aiSummary.suggestion.recommendedFocus.map((item, index) => (
                        <li key={`ai-focus-${index}`}>{item}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Confidence {aiSummary.suggestion.confidence}</Badge>
                      <span>Next check-in: {aiSummary.suggestion.nextCheckIn}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VendorTrustScoreCard;
