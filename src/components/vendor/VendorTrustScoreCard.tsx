'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getClientAuthHeaders } from '@/lib/client-session';
import { buildVendorCoachingPlan } from '@/lib/vendor-coaching';
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
  { key: 'operationalReliability', label: 'Operational reliability' },
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

function buildDashboardSnapshot(dashboardData: VendorDashboardResponse) {
  const totalBookings = Number(dashboardData.stats?.totalBookings || 0);
  const completedJobs = Array.isArray(dashboardData.recentJobs)
    ? dashboardData.recentJobs.filter((job) => job.status === 'completed').length
    : 0;

  return {
    totalBookings,
    totalClients: Number(dashboardData.stats?.totalClients || 0),
    rating: Number(dashboardData.stats?.rating || 0),
    ratingCount: Number(dashboardData.stats?.ratingCount || 0),
    approvedVideos: Number(dashboardData.approvedProofs || 0),
    pendingVideos: Number(dashboardData.pendingModerationProofs || 0),
    archivedVideos: Number(dashboardData.archivedProofs || 0),
    totalVideoAssets: Number(dashboardData.totalProofAssets || 0),
    storagePercentUsed: Number(dashboardData.storagePercentUsed || 0),
    completedJobs,
    inProgressJobs: Array.isArray(dashboardData.recentJobs)
      ? dashboardData.recentJobs.filter((job) => job.status === 'in progress').length
      : 0,
    scheduledJobs: Array.isArray(dashboardData.recentJobs)
      ? dashboardData.recentJobs.filter((job) => job.status === 'scheduled').length
      : 0,
    reviewCoverage:
      completedJobs > 0
        ? Math.round(((dashboardData.recentReviews?.length || 0) / completedJobs) * 100)
        : 0,
  };
}

export function VendorTrustScoreCard({
  dashboardData,
}: {
  dashboardData?: VendorDashboardResponse | null;
}) {
  const { user } = useAuth();
  const [trustScore, setTrustScore] = useState<VendorTrustScorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<VendorCoachingSummaryResponse | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const loadTrustScore = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vendor/trust-score', {
        headers: getClientAuthHeaders(),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.message || payload?.error || `Status ${response.status}`));
      }
      setTrustScore((payload?.trustScore as VendorTrustScorePayload) || null);
    } catch (err) {
      setTrustScore(null);
      setError(err instanceof Error ? err.message : 'Failed to load Trust Score');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTrustScore();
  }, [user?.id]);

  useEffect(() => {
    setAiSummary(null);
    setAiSummaryError(null);
  }, [user?.id, trustScore?.computedAt, dashboardData?.stats?.totalBookings]);

  const coachingPlan = buildVendorCoachingPlan(trustScore, dashboardData);

  const loadAiSummary = async (refresh = false) => {
    if (!trustScore?.scored || !trustScore.components || !dashboardData) {
      setAiSummaryError('Trust Score data is not ready for an AI coaching summary yet.');
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-700" />
            Reliance Trust Score
            <Badge variant="outline">Vendor view</Badge>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadTrustScore(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          This score helps customers understand your reliability from verified Reliance activity.
          It stays separate from star ratings and review sentiment.
        </p>

        {loading ? (
          <div className="space-y-3">
            <div className="h-8 w-28 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-24 w-full animate-pulse rounded bg-slate-200" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">We could not load the Trust Score right now.</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : !trustScore?.scored ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Public Trust Score not ready yet</p>
            <p className="mt-1">
              More verified completed work is needed before this page can show a meaningful public
              Trust Score explanation for your business.
            </p>
            {trustScore?.explanationDetails?.coverageSummary ? (
              <p className="mt-2 text-xs text-slate-500">
                {trustScore.explanationDetails.coverageSummary}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold text-blue-800">
                {trustScore.totalScorePct === null ? 'N/A' : `${trustScore.totalScorePct}%`}
              </div>
              <div className="pb-1 text-sm text-muted-foreground">Current customer-facing Trust Score</div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Why this matters to customers</p>
              <p className="mt-1">
                Customers use this score as a quick read on how reliably your business completes verified work,
                gets service videos approved, and avoids problems that damage trust.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {trustScore.components
                ? COMPONENT_ROWS.map(({ key, label }) => {
                    const component = trustScore.components![key];
                    return (
                      <div key={key} className="rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-900">{label}</p>
                            <p className="text-xs text-muted-foreground">
                              Weight {component.weightPct}% of the score customers see
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-900">{formatPct(component.pct)}</p>
                            <p className="text-xs text-muted-foreground">
                              {component.numerator}/{component.denominator} finalized
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>

            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
              <div>
                <p className="font-medium text-slate-900">How this score builds customer confidence</p>
                <p className="mt-1">{trustScore.explanationDetails.overview}</p>
              </div>

              <div>
                <p className="font-medium text-slate-900">Current confidence context</p>
                <p className="mt-1">{trustScore.explanationDetails.coverageSummary}</p>
              </div>

              {trustScore.explanationDetails.strongestSignals.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-900">Signals that help customers trust you most</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {trustScore.explanationDetails.strongestSignals.map((item, index) => (
                      <li key={`strong-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {trustScore.explanationDetails.watchItems.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-900">Signals that still limit customer confidence</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {trustScore.explanationDetails.watchItems.map((item, index) => (
                      <li key={`watch-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {Array.isArray(trustScore.improvementHints) && trustScore.improvementHints.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-900">How to strengthen public trust next</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {trustScore.improvementHints.map((item, index) => (
                      <li key={`hint-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="font-medium text-slate-900">How Reliance interprets the score</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {trustScore.explanationDetails.methodology.map((item, index) => (
                    <li key={`method-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-700">
              <div>
                <p className="font-medium text-slate-900">Recommended next actions</p>
                <p className="mt-1">{coachingPlan.summary}</p>
              </div>

              {coachingPlan.priorityActions.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-900">Actions that can improve customer confidence fastest</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {coachingPlan.priorityActions.map((item, index) => (
                      <li key={`priority-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {coachingPlan.strengths.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-900">What is already helping your business look credible</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {coachingPlan.strengths.map((item, index) => (
                      <li key={`strength-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {coachingPlan.operationalNotes.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-900">Operational notes that affect public confidence</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {coachingPlan.operationalNotes.map((item, index) => (
                      <li key={`note-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {trustScore?.scored ? (
              <div className="space-y-3 rounded-lg border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Optional AI coaching summary</p>
                    <p className="mt-1 text-xs text-slate-600">
                      This is an advisory summary generated from the deterministic Trust Score and
                      coaching signals already shown above. It does not change your Trust Score.
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
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {aiSummary ? 'Refresh AI Summary' : 'Generate AI Summary'}
                  </Button>
                </div>

                {aiSummaryLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-sky-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-sky-100" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-sky-100" />
                  </div>
                ) : aiSummaryError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {aiSummaryError}
                  </div>
                ) : aiSummary ? (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-slate-900">Summary</p>
                      <p className="mt-1">{aiSummary.suggestion.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-900">Priority headline</p>
                      <p className="mt-1">{aiSummary.suggestion.priorityHeadline}</p>
                    </div>

                    {aiSummary.suggestion.recommendedFocus.length > 0 ? (
                      <div>
                        <p className="font-medium text-slate-900">Recommended focus</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {aiSummary.suggestion.recommendedFocus.map((item, index) => (
                            <li key={`ai-focus-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {aiSummary.suggestion.positiveSignals.length > 0 ? (
                      <div>
                        <p className="font-medium text-slate-900">Positive signals</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {aiSummary.suggestion.positiveSignals.map((item, index) => (
                            <li key={`ai-positive-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {aiSummary.suggestion.watchouts.length > 0 ? (
                      <div>
                        <p className="font-medium text-slate-900">Watchouts</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {aiSummary.suggestion.watchouts.map((item, index) => (
                            <li key={`ai-watch-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge variant="outline">
                        Confidence {aiSummary.suggestion.confidence}
                      </Badge>
                      <span>Next check-in: {aiSummary.suggestion.nextCheckIn}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Generate a concise AI summary when you want an extra coaching readout based on
                    the current Trust Score and dashboard state.
                  </p>
                )}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Last computed: {formatDate(trustScore.computedAt)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VendorTrustScoreCard;
